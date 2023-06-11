var CIRCLE = Math.PI * 2;

class Player {
  constructor(x, y, direction) {
    this.x = x;
    this.y = y;
    this.direction = direction;
  }

  rotate(angle) {
    this.direction = (this.direction + angle + CIRCLE) % CIRCLE;
  }

  walk(distance, map) {
    let dx = Math.cos(this.direction) * distance;
    let dy = Math.sin(this.direction) * distance;
    if (map.canGo(this.x + dx, this.y)) {
      this.x += dx;
    }
    if (map.canGo(this.x, this.y + dy)) {
      this.y += dy;
    }
  }

  update(input, map, seconds) {
    if (input.left) this.rotate(-Math.PI * seconds);
    if (input.right) this.rotate(Math.PI * seconds);
    if (input.forward) this.walk(3 * seconds, map);
    if (input.backward) this.walk(-3 * seconds, map);
  }
}

class Input {
  constructor() {
    this.codes = {
      37: "left",
      39: "right",
      38: "forward",
      40: "backward",
      65: "left",
      68: "right",
      87: "forward",
      83: "backward",
    };

    this.states = {
      left: false,
      right: false,
      forward: false,
      backward: false,
    };

    document.addEventListener("keydown", (e) => this.onKey(true, e));
    document.addEventListener("keyup", (e) => this.onKey(false, e));
  }

  onKey(val, e) {
    let stateKey = this.codes[e.keyCode];
    if (typeof stateKey === "undefined") return;

    this.states[stateKey] = val;
    e.preventDefault && e.preventDefault();
    e.stopPropagation && e.stopPropagation();
  }
}

class Bitmap {
  constructor(src, width, height) {
    this.image = new Image();
    this.image.src = src;
    this.width = width;
    this.height = height;
  }
}

class Map {
  constructor(size) {
    this.size = size;
    this.wallGrid = new Uint8Array(size * size);
    this.wallTexture = new Bitmap("wall_texture.jpg", 1024, 1024);
  }

  get(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1) return -1;
    return this.wallGrid[y * this.size + x];
  }

  canGo(x, y) {
    return this.get(x, y) <= 0;
  }

  randomize() {
    for (var i = 0; i < this.size * this.size; i++) {
      this.wallGrid[i] = Math.random() < 0.3 ? 1 : 0;
    }
  }

  cast(point, angle, range) {
    var self = this;
    var sin = Math.sin(angle);
    var cos = Math.cos(angle);
    var noWall = { length2: Infinity };

    return ray({ x: point.x, y: point.y, height: 0, distance: 0 });

    function ray(origin) {
      var stepX = step(sin, cos, origin.x, origin.y);
      var stepY = step(cos, sin, origin.y, origin.x, true);
      var nextStep =
        stepX.length2 < stepY.length2
          ? inspect(stepX, 1, 0, origin.distance, stepX.y)
          : inspect(stepY, 0, 1, origin.distance, stepY.x);

      if (nextStep.distance > range) return [origin];
      return [origin].concat(ray(nextStep));
    }

    function step(rise, run, x, y, inverted) {
      if (run === 0) return noWall;
      var dx = run > 0 ? Math.floor(x + 1) - x : Math.ceil(x - 1) - x;
      var dy = dx * (rise / run);
      return {
        x: inverted ? y + dy : x + dx,
        y: inverted ? x + dx : y + dy,
        length2: dx * dx + dy * dy,
      };
    }

    function inspect(step, shiftX, shiftY, distance, offset) {
      var dx = cos < 0 ? shiftX : 0;
      var dy = sin < 0 ? shiftY : 0;
      step.height = self.get(step.x - dx, step.y - dy);
      step.distance = distance + Math.sqrt(step.length2);
      if (shiftX) step.shading = cos < 0 ? 2 : 0;
      else step.shading = sin < 0 ? 2 : 1;
      step.offset = offset - Math.floor(offset);
      return step;
    }
  }
}

class Camera {
  constructor(canvas, resolution, focalLength) {
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width = window.innerWidth * 0.5;
    this.height = canvas.height = window.innerHeight * 0.5;
    this.resolution = resolution;
    this.spacing = this.width / resolution;
    this.focalLength = focalLength || 0.8;
    this.range = 14;
    this.lightRange = 5;
    this.scale = (this.width + this.height) / 1200;
  }

  render(player, map) {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.wrapDraw(() => this.drawColumns(player, map));
  }

  wrapDraw(callback) {
    this.ctx.save();
    callback();
    this.ctx.restore();
  }

  drawColumns(player, map) {
    for (let column = 0; column < this.resolution; column++) {
      let x = column / this.resolution - 0.5;
      let angle = Math.atan2(x, this.focalLength);
      let ray = map.cast(player, player.direction + angle, this.range);

      this.drawColumn(column, ray, angle, map);
    }
  }

  drawColumn(column, ray, angle, map) {
    var ctx = this.ctx;
    var texture = map.wallTexture;
    var left = Math.floor(column * this.spacing);
    var width = Math.ceil(this.spacing);
    var hit = -1;

    while (++hit < ray.length && ray[hit].height <= 0);

    for (var s = ray.length - 1; s >= 0; s--) {
      var step = ray[s];
      if (s === hit) {
        var textureX = Math.floor(texture.width * step.offset);
        var wall = this.project(step.height, angle, step.distance);

        ctx.globalAlpha = 1;
        ctx.drawImage(
          texture.image,
          textureX,
          0,
          1,
          texture.height,
          left,
          wall.top,
          width,
          wall.height
        );

        ctx.fillStyle = "#000000";
        ctx.globalAlpha = Math.max(
          (step.distance + step.shading) / this.lightRange,
          0
        );
        ctx.fillRect(left, wall.top, width, wall.height);
      }

      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.15;
    }
  }

  project(height, angle, distance) {
    var z = distance * Math.cos(angle);
    var wallHeight = (this.height * height) / z;
    var bottom = (this.height / 2) * (1 + 1 / z);
    return {
      top: bottom - wallHeight,
      height: wallHeight,
    };
  }
}

class GameLoop {
  constructor() {
    this.frame = this.frame.bind(this);
    this.lastTime = 0;
    this.callback = function () {};
  }

  start(callback) {
    this.callback = callback;
    requestAnimationFrame(this.frame);
  }

  frame(time) {
    var seconds = (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (seconds < 0.2) this.callback(seconds);
    requestAnimationFrame(this.frame);
  }
}

const display = document.getElementById("display");
const player = new Player(15.3, -1.2, Math.PI * 0.3);
const map = new Map(32);
const input = new Input();
const camera = new Camera(display, 320, 0.8);
const loop = new GameLoop();

map.randomize();

loop.start((seconds) => {
  player.update(input.states, map, seconds);
  camera.render(player, map);
});
