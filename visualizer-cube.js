function cubeSketch(p) {
  // ===== HUD waves config (globals) =====
  let recording = false;
  let waveHistoryLength = 170;   // width of each waveform in pixels
  let waveLaneHeight    = 48;    // vertical space per band row
  let hudRightPad       = 16;    // padding from right edge
  let hudTopOffset      = 200;   // top padding (leave room for stats)
  let waveGain          = 1200;  // scales audio amplitude -> pixels (tweak)

  // Colors per band = the Rubik's face colors
  // b1→F, b2→B, b3→U, b4→D, b5→L, b6→R
  let bandColors = [];

  let waitTimeSeconds = 20;
  let waitTimeMillis = waitTimeSeconds * 1000;

  // ---------------- AUDIO VISUALIZER RUBIK'S CUBE ----------------
  let song;
  let fft;

  // ===== Adaptive triggering for 6 bands =====
  let b1EMA = 1, b2EMA = 1, b3EMA = 1, b4EMA = 1, b5EMA = 1, b6EMA = 1;
  let emaAlpha = 0.08;

  // multipliers: trigger when current > EMA * multiplier
  let multB1 = 1.6, multB2 = 1.6, multB3 = 1.6;
  let multB4 = 1.6, multB5 = 1.6, multB6 = 1.6;

  // minimal floors so silence doesn't trigger
  let floorB1 = 0.003, floorB2 = 0.003, floorB3 = 0.003;
  let floorB4 = 0.003, floorB5 = 0.003, floorB6 = 0.003;

  let cooldown = 0;         // frames to wait after a move
  let cooldownFrames = 10;  // ~10 frames at default frameRate
  let lastTriggered = "";   // HUD text

  // ---------------- RUBIK'S CUBE ----------------
  let SIZE = 50;
  let GAP = 2;
  let cubelets = [];

  // --- Move history ---
  let moveHistory = [];
  let undoStack = []; // stack of inverses
  let maxMovesShown = 12;
  let moveCount = 0;
  let solverActive = false;
  let solverCooldown = 0;
  let solverStartTime = 0;  // will set at sketch start
  let moveStats = {};       // like HashMap<String,Integer>
  let pendingMoves = [];    // queue of moves ("R", "R'")
  let solverDelay = 5000;
  let scrambleDoneTime = -1;

  let showButton = false;
  let scrambleMoves = [];
  let scrambleIndex = 0;

  let rotating = false;
  let rotationAxis = null;
  let rotationLayer = 0;
  let rotationAngle = 0;
  let rotationSpeed = p.PI/20;
  let rotationDir = 1;

  // cube orbit control
  let globalRotX = -p.PI/4;
  let globalRotY = p.PI/4;
  let t;

  let COLORS = {}; // HashMap<String,Integer> → JS object

  p.setup = function () {
    // Canvas setup
    // ✅ Responsive square canvas
    const container = document.getElementById("art-canvas-2");
    const size = container.offsetWidth; // make it a square based on div width
    let cnv = p.createCanvas(size, size, p.WEBGL);
    cnv.parent("art-canvas-2");
    // ⚠️ p5 doesn’t have surface.setTitle, but you can set document.title
    document.title = "Audio-Driven Rubik's Cube";

    // Define face colors
    COLORS["U"] = p.color(255);         // Up = white
    COLORS["D"] = p.color(255, 255, 0); // Down = yellow
    COLORS["L"] = p.color(255, 165, 0); // Left = orange
    COLORS["R"] = p.color(255, 0, 0);   // Right = red
    COLORS["F"] = p.color(0, 255, 0);   // Front = green
    COLORS["B"] = p.color(0, 0, 255);   // Back = blue

    // Band colors (b1–b6)
    bandColors = [
        COLORS["F"], // Sub-bass → Front (green)
        COLORS["B"], // Bass     → Back (blue)
        COLORS["U"], // Low-mids → Up (white)
        COLORS["D"], // Mids     → Down (yellow)
        COLORS["L"], // Upper-mids → Left (orange)
        COLORS["R"]  // Highs    → Right (red)
    ];

    // Build cube (we’ll implement this later)
    buildCube();

    // Solver start time
    solverStartTime = p.millis();

    // --- AUDIO SETUP ---
    // don’t auto-loop
    song = p.loadSound("media/Lost In Cyberspace.mp3", () => {
    // song.loop();   <-- remove this
    });

        // Instead, trigger playback on user gesture
    p.mousePressed = () => {
        if (song && !song.isPlaying()) song.play();
    };


    fft = new p5.FFT();
    fft.setInput(song);
  };

  p.draw = function () {
    p.background(10);
    p.lights();

    // --- Trigger next pending move ---
    if (!rotating && pendingMoves.length > 0) {
        let tagged = pendingMoves.shift();
        let fromMusic = tagged.startsWith("M:");
        let move = tagged.substring(2); // e.g. "R" or "R'"
        let face = move.substring(0, 1);
        let dir = move.endsWith("'") ? -1 : 1;
        startRotation(face, dir);
    }

    // --- AUDIO ANALYSIS ---
    if (song && song.isPlaying()) {
        fft.analyze();
    }

    let spectrum = fft.analyze();
    let specSize = spectrum.length;

    // Split spectrum into 6 ranges
    let i0 = 0;
    let i1 = Math.max(1, Math.floor(specSize * 0.04));
    let i2 = Math.max(i1 + 1, Math.floor(specSize * 0.10));
    let i3 = Math.max(i2 + 1, Math.floor(specSize * 0.20));
    let i4 = Math.max(i3 + 1, Math.floor(specSize * 0.35));
    let i5 = Math.max(i4 + 1, Math.floor(specSize * 0.55));
    let i6 = Math.max(i5 + 1, Math.floor(specSize * 0.80));

    let b1 = avgBand(spectrum, i0, i1);
    let b2 = avgBand(spectrum, i1, i2);
    let b3 = avgBand(spectrum, i2, i3);
    let b4 = avgBand(spectrum, i3, i4);
    let b5 = avgBand(spectrum, i4, i5);
    let b6 = avgBand(spectrum, i5, i6);

    // --- EMAs for adaptive thresholds ---
    b1EMA = Math.max(1e-6, p.lerp(b1EMA, b1, emaAlpha));
    b2EMA = Math.max(1e-6, p.lerp(b2EMA, b2, emaAlpha));
    b3EMA = Math.max(1e-6, p.lerp(b3EMA, b3, emaAlpha));
    b4EMA = Math.max(1e-6, p.lerp(b4EMA, b4, emaAlpha));
    b5EMA = Math.max(1e-6, p.lerp(b5EMA, b5, emaAlpha));
    b6EMA = Math.max(1e-6, p.lerp(b6EMA, b6, emaAlpha));

    if (cooldown > 0) cooldown--;

    // --- Mapping bands to cube faces ---
    if (!rotating && cooldown === 0) {
        let did = false;

        if (b1 > b1EMA * 1.5) {
        let clockwise = p.random(1) > 0.5;
        onMusicMove("F" + (clockwise ? "" : "'"));
        lastTriggered = "Sub-bass → F";
        did = true;
        } else if (b2 > b2EMA * 1.5) {
        let clockwise = p.random(1) > 0.5;
        onMusicMove("B" + (clockwise ? "" : "'"));
        lastTriggered = "Bass → B";
        did = true;
        } else if (b3 > b3EMA * 1.5) {
        let clockwise = p.random(1) > 0.5;
        onMusicMove("U" + (clockwise ? "" : "'"));
        lastTriggered = "Low mids → U";
        did = true;
        } else if (b4 > b4EMA * 1.5) {
        let clockwise = p.random(1) > 0.5;
        onMusicMove("D" + (clockwise ? "" : "'"));
        lastTriggered = "Mids → D";
        did = true;
        } else if (b5 > b5EMA * 1.5) {
        let clockwise = p.random(1) > 0.5;
        onMusicMove("L" + (clockwise ? "" : "'"));
        lastTriggered = "Upper mids → L";
        did = true;
        } else if (b6 > b6EMA * 1.5) {
        let clockwise = p.random(1) > 0.5;
        onMusicMove("R" + (clockwise ? "" : "'"));
        lastTriggered = "Highs → R";
        did = true;
        }

        if (did) cooldown = cooldownFrames;
    }

    // --- Solver activation ---
    if (!solverActive && p.millis() - solverStartTime > waitTimeMillis) {
        solverActive = true;
        solverStartTime = p.millis();
    }

    // --- Solver loop ---
    if (solverActive && !rotating && solverCooldown === 0 && undoStack.length > 0) {
        let activeTime = (p.millis() - solverStartTime) / 1000.0;

        let effectiveCooldown = cooldownFrames;
        if (activeTime > 40) effectiveCooldown = Math.max(1, Math.floor(cooldownFrames / 4));
        else if (activeTime > 30) effectiveCooldown = Math.max(1, Math.floor(cooldownFrames / 3));
        else if (activeTime > 20) effectiveCooldown = Math.max(1, Math.floor(cooldownFrames / 2));

        let movesThisTurn = 1;
        if (activeTime > 40) movesThisTurn = 4;
        else if (activeTime > 30) movesThisTurn = 3;
        else if (activeTime > 20) movesThisTurn = 2;

        stepSolver(movesThisTurn);
        solverCooldown = effectiveCooldown;
    }
    if (solverCooldown > 0) solverCooldown--;

    // --- Cube rendering ---
    p.push();
    p.translate(p.width/2, p.height/2, -200);
    p.rotateX(globalRotX);
    p.rotateY(globalRotY + t);
    t += p.PI/100;

    if (rotating) {
        rotationAngle += rotationSpeed * rotationDir;
        if (Math.abs(rotationAngle) >= p.HALF_PI) finalizeRotation();
    }

    for (let c of cubelets) {
        let affected = false;
        if (rotating) {
        if (rotationAxis === "x" && c.pos.x === rotationLayer) affected = true;
        if (rotationAxis === "y" && c.pos.y === rotationLayer) affected = true;
        if (rotationAxis === "z" && c.pos.z === rotationLayer) affected = true;
        }

        p.push();
        if (affected) {
            if (rotationAxis === "x") p.rotateX(rotationAngle);
            if (rotationAxis === "y") p.rotateY(rotationAngle);
            if (rotationAxis === "z") p.rotateZ(rotationAngle);
        }
        p.translate(c.pos.x * (SIZE + GAP), c.pos.y * (SIZE + GAP), c.pos.z * (SIZE + GAP));
        c.draw(p); // pass p into Cubelet draw()
        p.pop();
    }
    p.pop();

    // --- HUD Overlay ---
    p.resetMatrix();
    p.camera();
    p.noLights();

    p.push();
    p.fill(255);
    p.textAlign(p.LEFT, p.TOP);
    p.textSize(16);
    let gainVis = 800.0;

    p.text(
        "specSize: " + fft.bins +
        "\nB1 Sub   : " + (b1 * gainVis).toFixed(1) + "  EMA: " + (b1EMA * gainVis).toFixed(1) +
        "\nB2 Bass  : " + (b2 * gainVis).toFixed(1) + "  EMA: " + (b2EMA * gainVis).toFixed(1) +
        "\nB3 L-Mid : " + (b3 * gainVis).toFixed(1) + "  EMA: " + (b3EMA * gainVis).toFixed(1) +
        "\nB4 Mid   : " + (b4 * gainVis).toFixed(1) + "  EMA: " + (b4EMA * gainVis).toFixed(1) +
        "\nB5 U-Mid : " + (b5 * gainVis).toFixed(1) + "  EMA: " + (b5EMA * gainVis).toFixed(1) +
        "\nB6 High  : " + (b6 * gainVis).toFixed(1) + "  EMA: " + (b6EMA * gainVis).toFixed(1) +
        "\nTriggered: " + lastTriggered,
        12, 12
    );
    p.pop();

    // Move history HUD
    p.push();
    p.fill(200);
    p.textAlign(p.LEFT, p.BOTTOM);
    p.textSize(16);

    let start = Math.max(0, moveHistory.length - 350);
    let allMoves = moveHistory.slice(start).join(" ");
    let margin = 12;
    let maxWidth = p.width - margin * 2;

    let words = allMoves.split(" ");
    let line = "";
    let lines = [];

    for (let w of words) {
        let testLine = line + w + " ";
        if (p.textWidth(testLine) > maxWidth) {
        lines.push(line);
        line = w + " ";
        } else {
        line = testLine;
        }
    }
    lines.push(line);

    let y = p.height - margin;
    for (let i = lines.length - 1; i >= 0; i--) {
        p.text(lines[i], margin, y);
        y -= p.textAscent() + p.textDescent() + 4;
    }
    p.pop();

    // Stats HUD (top-right)
    p.push();
    p.textAlign(p.RIGHT, p.TOP);
    p.textSize(14);
    p.fill(255);

    let stats = "Total Moves: " + moveCount;
    for (let face in moveStats) {
        stats += "\n" + face + ": " + moveStats[face];
    }
    p.text(stats, p.width - 12, 12);
    p.pop();

    // --- Sine-wave HUD ---
    let startX = p.width - waveHistoryLength - hudRightPad;
    let startY = hudTopOffset;

    let timeFactor = 0.12;
    let xFactor = 0.05;

    p.push();
    p.translate(startX, startY);

    for (let b = 0; b < 6; b++) {
        let amp = [b1, b2, b3, b4, b5, b6][b];
        let mag = p.constrain(amp * waveGain, 0, waveLaneHeight * 0.45);

        p.stroke(bandColors[b]);
        p.strokeWeight(3);
        p.noFill();
        p.beginShape();
        for (let i = 0; i < waveHistoryLength; i++) {
        let xPos = i;
        let phase = p.frameCount * timeFactor + i * xFactor + b * 0.6;
        let yPos = b * waveLaneHeight + p.sin(phase) * mag;
        p.vertex(xPos, yPos);
        }
        p.endShape();
    }
    p.pop();

    // Solver HUD (top-center)
    p.push();
    p.textAlign(p.CENTER, p.TOP);
    p.textSize(14);
    p.fill(255);
    p.text("Backlog: " + undoStack.length, p.width / 2, 12);
    p.pop();

    // Optional recording
    if (recording) {
        p.saveCanvas("frame-" + p.frameCount, "png");
    }
  };

  // ---------------- AUDIO HELPERS ----------------
  function avgBand(spectrum, start, end) {
    start = p.constrain(start, 0, spectrum.length);
    end   = p.constrain(end,   0, spectrum.length);
    if (end <= start) return 0;

    let sum = 0;
    for (let i = start; i < end; i++) {
        sum += spectrum[i];
    }
    return sum / (end - start) / 255.0;
    }

    // p5 handles cleanup automatically, so we don’t need stop().
    // If you want an explicit one:
    function stop() {
    if (song && song.isPlaying()) {
        song.stop();
    }
  }
  
  class Cubelet {
    constructor(x, y, z) {
        this.pos = p.createVector(x, y, z);
        this.stickers = {};

        if (x === 1) this.stickers["R"] = COLORS["R"];
        if (x === -1) this.stickers["L"] = COLORS["L"];
        if (y === -1) this.stickers["U"] = COLORS["U"];
        if (y === 1) this.stickers["D"] = COLORS["D"];
        if (z === 1) this.stickers["F"] = COLORS["F"];
        if (z === -1) this.stickers["B"] = COLORS["B"];
    }

    draw() {
        p.noStroke();
        p.fill(0);
        p.box(SIZE);

        let offset = SIZE * 0.51;

        for (let face in this.stickers) {
            p.push();
            p.fill(this.stickers[face]);
            switch (face) {
                case "U": p.translate(0, -offset, 0); p.rotateX(-p.HALF_PI); break;
                case "D": p.translate(0, offset, 0); p.rotateX(p.HALF_PI); break;
                case "L": p.translate(-offset, 0, 0); p.rotateY(p.HALF_PI); break;
                case "R": p.translate(offset, 0, 0); p.rotateY(-p.HALF_PI); break;
                case "F": p.translate(0, 0, offset); break;
                case "B": p.translate(0, 0, -offset); p.rotateY(p.PI); break;
            }
            p.noStroke();
            let s = SIZE * 0.9;
            p.beginShape(p.QUADS);
            p.vertex(-s/2, -s/2, 0);
            p.vertex( s/2, -s/2, 0);
            p.vertex( s/2,  s/2, 0);
            p.vertex(-s/2,  s/2, 0);
            p.endShape();
            p.pop();
        }
    }
  }
  
  function buildCube() {
    cubelets = [];
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          cubelets.push(new Cubelet(x, y, z));
        }
      }
    }
    rotating = false;
    rotationAxis = null;
    rotationAngle = 0;
    }

  function finalizeRotation() {
    rotationAngle = 0;
    rotating = false;

    for (let c of cubelets) {
        if (rotationAxis === "x" && c.pos.x === rotationLayer) {
            rotateCubelet(c, "x", rotationDir);
        } else if (rotationAxis === "y" && c.pos.y === rotationLayer) {
            rotateCubelet(c, "y", rotationDir);
        } else if (rotationAxis === "z" && c.pos.z === rotationLayer) {
            rotateCubelet(c, "z", rotationDir);
        }
    }
  }


  function rotateCubelet(c, axis, dir) {
    if (axis === "x") {
        let y = c.pos.y;
        c.pos.y = -c.pos.z * dir;
        c.pos.z = y * dir;
    } else if (axis === "y") {
        let x = c.pos.x;
        c.pos.x = c.pos.z * dir;
        c.pos.z = -x * dir;
    } else if (axis === "z") {
        let x = c.pos.x;
        c.pos.x = -c.pos.y * dir;
        c.pos.y = x * dir;
    }

    let newStickers = {};
    for (let face of Object.keys(c.stickers)) {
        let newFace = face;

        if (axis === "x") {
        if (dir === 1) {
            if (face === "U") newFace = "B";
            else if (face === "B") newFace = "D";
            else if (face === "D") newFace = "F";
            else if (face === "F") newFace = "U";
        } else {
            if (face === "U") newFace = "F";
            else if (face === "F") newFace = "D";
            else if (face === "D") newFace = "B";
            else if (face === "B") newFace = "U";
        }
        } else if (axis === "y") {
        if (dir === 1) {
            if (face === "F") newFace = "R";
            else if (face === "R") newFace = "B";
            else if (face === "B") newFace = "L";
            else if (face === "L") newFace = "F";
        } else {
            if (face === "F") newFace = "L";
            else if (face === "L") newFace = "B";
            else if (face === "B") newFace = "R";
            else if (face === "R") newFace = "F";
        }
        } else if (axis === "z") {
        if (dir === 1) {
            if (face === "U") newFace = "R";
            else if (face === "R") newFace = "D";
            else if (face === "D") newFace = "L";
            else if (face === "L") newFace = "U";
        } else {
            if (face === "U") newFace = "L";
            else if (face === "L") newFace = "D";
            else if (face === "D") newFace = "R";
            else if (face === "R") newFace = "U";
        }
        }

        newStickers[newFace] = c.stickers[face];
    }
    c.stickers = newStickers;
  }
  
  p.keyPressed = function() {
    let k = p.key;
    let face = ("" + k.toUpperCase());

    if ("RLUDFB".includes(face)) {
        let dir = (k === k.toUpperCase()) ? -1 : 1;
        startRotation(face, dir);
    }
    };

    function startRotation(face, dir) {
        if (rotating) return;

        // Flip direction for B, L, U to match visual expectations
        if ("BLU".includes(face)) {
            dir *= -1;
        }

        switch (face) {
            case "R": rotationAxis = "x"; rotationLayer = 1; break;
            case "L": rotationAxis = "x"; rotationLayer = -1; break;
            case "U": rotationAxis = "y"; rotationLayer = -1; break;
            case "D": rotationAxis = "y"; rotationLayer = 1; break;
            case "F": rotationAxis = "z"; rotationLayer = 1; break;
            case "B": rotationAxis = "z"; rotationLayer = -1; break;
        }

        rotationDir = dir;
        rotating = true;
        rotationAngle = 0;

        // Build move string
        let move = face + (dir === 1 ? "" : "'");
        
        // Always record to moveHistory
        moveHistory.push(move);
        if (moveHistory.length > 200) {
            moveHistory.shift();
        }

        // Update counters
        moveCount++;
        if (!(face in moveStats)) moveStats[face] = 0;
            moveStats[face] = moveStats[face] + 1;
        }

        function enqueueMove(notation, fromMusic) {
            pendingMoves.push((fromMusic ? "M:" : "S:") + notation);
        }

        // Map: if move == "R" -> "R'", if "U'" -> "U", "F2" returns "F2"
        function inverseNotation(move) {
            if (move.endsWith("'")) return move.substring(0, move.length - 1);
            if (move.endsWith("2")) return move; // optional if you add 2-turns
            return move + "'";
        }

        // Called whenever MUSIC decides a move
        function onMusicMove(move) {
        // 1) Perform the music move visibly
        enqueueMove(move, true);

        // 2) Maintain the undoStack (the debt we must undo)
        if (!solverActive) {
            // Still in scramble window: just accumulate the inverse
            undoStack.push(inverseNotation(move));
        } else {
            // Active solver: try to cancel the next planned inverse
            if (undoStack.length > 0 && undoStack[undoStack.length - 1] === move) {
            undoStack.pop(); // cancellation!
            } else {
            undoStack.push(inverseNotation(move));
            }
        }
    }

    // Pop up to N inverses from undoStack and enqueue them as solver moves ("S:")
    function stepSolver(movesThisTurn) {
        for (let i = 0; i < movesThisTurn; i++) {
            if (undoStack.length === 0) break;
            let nextInverse = undoStack.pop();
            enqueueMove(nextInverse, false); // false = solver
        }
    }

    p.mouseDragged = function() {
        let sensitivity = 0.01;
        globalRotY += (p.mouseX - p.pmouseX) * sensitivity;
        globalRotX -= (p.mouseY - p.pmouseY) * sensitivity;
    };

}

new p5(cubeSketch);

