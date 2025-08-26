let canvas;

function setup() {
  canvas = createCanvas(window.innerWidth, window.innerHeight);
  canvas.id('graphCanvas');
  canvas.style('position', 'fixed');
  canvas.style('top', '0px');
  canvas.style('left', '0px');
  canvas.style('margin', '0');     // prevent white gap
  canvas.style('padding', '0');    // prevent white gap
  canvas.style('z-index', '-10');  // behind content
}


function draw() {
  clear();
  stroke(0, 0, 0, 20); // faint black lines
  strokeWeight(1);
  let spacing = 30; // smaller squares for graph paper feel

  for (let x = 0; x < width; x += spacing) {
    line(x, 0, x, height);
  }
  for (let y = 0; y < height; y += spacing) {
    line(0, y, width, y);
  }
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
}
