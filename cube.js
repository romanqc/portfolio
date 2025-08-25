function cubeSketch(p) {
  const SIZE = 50;
  const GAP = -25; // smaller gap for tighter look
  let cubelets = [];

  let rotating = false;
  let rotationAxis = null;
  let rotationLayer = null;
  let rotationAngle = 0;
  let rotationSpeed = p.PI / 20;
  let rotationDir = 1;

  const COLORS = {
    U: p.color(255),
    D: p.color(255, 255, 0),
    L: p.color(255, 165, 0),
    R: p.color(255, 0, 0),
    F: p.color(0, 255, 0),
    B: p.color(0, 0, 255),
  };

  class Cubelet {
    constructor(x, y, z) {
      this.pos = p.createVector(x, y, z);

      // Stickers keyed by faces relative to the cubelet
      this.stickers = {};
      if (x === 1) this.stickers.R = COLORS.R;
      if (x === -1) this.stickers.L = COLORS.L;
      if (y === -1) this.stickers.U = COLORS.U;
      if (y === 1) this.stickers.D = COLORS.D;
      if (z === 1) this.stickers.F = COLORS.F;
      if (z === -1) this.stickers.B = COLORS.B;
    }

    draw() {
      p.push();
      p.translate(
        this.pos.x * (SIZE + GAP),
        this.pos.y * (SIZE + GAP),
        this.pos.z * (SIZE + GAP)
      );

      // Draw black cubelet body
      p.noStroke();
      p.fill(0);
      p.box(SIZE);

      let offset = SIZE * 0.51;

      // Draw stickers at their relative positions
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
        p.plane(SIZE * 0.9);
        p.pop();
      }

      p.pop();
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

    // Reset rotation state
    rotating = false;
    rotationAxis = null;
    rotationLayer = null;
    rotationAngle = 0;
  }

  p.setup = function () {
    let container = document.getElementById("cube-container");
    let w = container.offsetWidth;
    let h = container.offsetHeight;

    let canvas = p.createCanvas(w, h, p.WEBGL);
    canvas.parent("cube-container");
    p.noLights();

    buildCube();

    // Reset button hook up
    document.getElementById("reset-cube").addEventListener("click", buildCube);

  };

  p.draw = function () {
    p.background(30);

    // Get canvas bounds relative to the window
    let canvasBounds = p.canvas.getBoundingClientRect();
    let mouseInside =
        p.mouseX >= 0 &&
        p.mouseX <= p.width &&
        p.mouseY >= 0 &&
        p.mouseY <= p.height &&
        p.mouseX + canvasBounds.left >= 0 &&
        p.mouseX + canvasBounds.left <= window.innerWidth &&
        p.mouseY + canvasBounds.top >= 0 &&
        p.mouseY + canvasBounds.top <= window.innerHeight;

    if (mouseInside) {
        p.orbitControl(); // Enable orbit only when mouse is inside canvas
    }

    if (rotating) {
        rotationAngle += rotationSpeed * rotationDir;
        if (Math.abs(rotationAngle) >= p.HALF_PI) finalizeRotation();
    }

    // Draw cubelets
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
        p.translate(
        c.pos.x * (SIZE + GAP),
        c.pos.y * (SIZE + GAP),
        c.pos.z * (SIZE + GAP)
        );
        c.draw();
        p.pop();
    }
  };

  function finalizeRotation() {
    rotationAngle = 0;
    rotating = false;

    // Update cubelet positions & stickers permanently
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
    // Update position
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

    // Rotate stickers on that cubelet
    let newStickers = {};
    for (let face in c.stickers) {
        let newFace = face;
        if (axis === "x") {
        // X-axis rotation (R/L moves)
        if (dir === 1) newFace = { U: "B", B: "D", D: "F", F: "U" }[face] || face;
        else newFace = { U: "F", F: "D", D: "B", B: "U" }[face] || face;
        } else if (axis === "y") {
        // Y-axis rotation (U/D moves)
        if (dir === 1) newFace = { F: "R", R: "B", B: "L", L: "F" }[face] || face;
        else newFace = { F: "L", L: "B", B: "R", R: "F" }[face] || face;
        } else if (axis === "z") {
        // Z-axis rotation (F/B moves)
        if (dir === 1) newFace = { U: "R", R: "D", D: "L", L: "U" }[face] || face;
        else newFace = { U: "L", L: "D", D: "R", R: "U" }[face] || face;
        }
        newStickers[newFace] = c.stickers[face];
    }
    c.stickers = newStickers;
    }


    function startRotation(face, dir) {
        if (rotating) return;

        switch (face) {
            case "R": rotationAxis = "x"; rotationLayer = 1; rotationDir = dir; break;
            case "L": rotationAxis = "x"; rotationLayer = -1; rotationDir = dir; break;
            case "U": rotationAxis = "y"; rotationLayer = -1; rotationDir = dir; break;
            case "D": rotationAxis = "y"; rotationLayer = 1; rotationDir = dir; break;
            case "F": rotationAxis = "z"; rotationLayer = 1; rotationDir = dir; break;
            case "B": rotationAxis = "z"; rotationLayer = -1; rotationDir = dir; break;
        }

        rotating = true;
        rotationAngle = 0;
    }

    p.keyPressed = function () {
        let k = p.key;
        let face = k.toUpperCase();

        if ("RLUDFB".includes(face)) {
            // Lowercase = Clockwise (+1), Uppercase = Counterclockwise (-1)
            let dir = (k === face) ? -1 : 1;
            startRotation(face, dir);
        }
    };

  p.windowResized = function () {
    let container = document.getElementById("cube-container");
    p.resizeCanvas(container.offsetWidth, container.offsetHeight);
  };
}

new p5(cubeSketch);
