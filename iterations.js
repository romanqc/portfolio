function cubeSketch(p) {
  let canvasObj;

  p.setup = function () {
    // ✅ Responsive square canvas
    const container = document.getElementById("art-canvas");
    const size = container.offsetWidth;
    let cnv = p.createCanvas(size, size);
    cnv.parent("art-canvas");
    p.noLoop(); // only draw when told to

    // ✅ Mobile defaults
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) {
      document.getElementById("cols").value = 6;
      document.getElementById("rows").value = 6;
      document.getElementById("space").value = 40;
      document.getElementById("armLength").value = 20;
      document.getElementById("numArms").value = 2;
      document.getElementById("armAngle").value = 1;
    }

    // ✅ Event listeners
    document.getElementById("rows").addEventListener("input", redrawArt);
    document.getElementById("cols").addEventListener("input", redrawArt);
    document.getElementById("space").addEventListener("input", redrawArt);
    document.getElementById("armLength").addEventListener("input", redrawArt);
    document.getElementById("numArms").addEventListener("input", redrawArt);
    document.getElementById("armAngle").addEventListener("input", redrawArt);

    // ✅ Draw once with defaults
    redrawArt();
  };

  function redrawArt() {
    p.loop();
    p.redraw();   // run draw() once
    p.noLoop();
  }

  p.draw = function () {
    p.background(0);
    p.stroke(255);
    p.strokeWeight(1);

    let rows = parseInt(document.getElementById("rows").value);
    let cols = parseInt(document.getElementById("cols").value);
    let space = parseInt(document.getElementById("space").value);
    let armLength = parseInt(document.getElementById("armLength").value);
    let numArms = parseInt(document.getElementById("numArms").value);
    let armAngle = parseInt(document.getElementById("armAngle").value);

    canvasObj = new Canvas(rows, cols, space, numArms, armLength, armAngle);
    canvasObj.display();

    p.noLoop();
  };

  // ✅ Handle resizing
  p.windowResized = function () {
    const container = document.getElementById("art-canvas");
    const size = container.offsetWidth;
    p.resizeCanvas(size, size);
    redrawArt();
  };

  // ---- Classes ---- //

  class Point {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
    display() {
      p.stroke(0);
      p.point(this.x, this.y);
    }
  }

  class Piece {
    constructor(startingPoint, nArms, lengthArms, phi) {
      this.startingPoint = startingPoint;
      this.nArms = nArms;
      this.lengthArms = lengthArms;
      this.phi = phi;
      this.pointsForArm = this.createPointsForArm();
    }

    display(pointObj) {
      if (this.nArms === 0) {
        p.strokeWeight(2);
        p.point(pointObj.x, pointObj.y);
      }
      for (let i = 0; i < this.nArms; i++) {
        p.strokeWeight(2);
        p.point(pointObj.x, pointObj.y);
        p.line(
          pointObj.x,
          pointObj.y,
          this.pointsForArm[i].x,
          this.pointsForArm[i].y
        );
      }
    }

    createPointsForArm() {
      let arms = [];
      let angles = [0, p.HALF_PI, p.PI, 3 * p.HALF_PI];
      let radius = this.lengthArms;

      for (let i = 0; i < this.nArms; i++) {
        let theta = p.random(angles);
        let x0 = this.startingPoint.x;
        let y0 = this.startingPoint.y;

        let x1 = x0 + p.round(radius * p.cos(theta + this.phi));
        let y1 = y0 + p.round(radius * p.sin(theta + this.phi));

        arms.push(new Point(x1, y1));
      }
      return arms;
    }
  }

  class Canvas {
    constructor(rows, cols, space, nArms, lengthArms, phi) {
      this.rows = rows;
      this.cols = cols;
      this.space = space;
      this.points = [];
      this.nArms = nArms;
      this.lengthArms = lengthArms;
      this.phi = phi;
    }

    fillPointsArray() {
      this.points = [];
      for (let i = 0; i < this.rows; i++) {
        this.points[i] = [];
        for (let j = 0; j < this.cols; j++) {
          this.points[i][j] = new Point(i * this.space, j * this.space);
        }
      }
    }

    display() {
      this.fillPointsArray();
      p.push();
      p.translate(
        p.width / 2 - (this.space * (this.rows - 1)) / 2,
        p.height / 2 - (this.space * (this.cols - 1)) / 2
      );
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          let piece = new Piece(this.points[i][j], this.nArms, this.lengthArms, this.phi);
          piece.display(this.points[i][j]);
        }
      }
      p.pop();
    }
  }
}

// 🔥 Start the sketch in instance mode
new p5(cubeSketch);
