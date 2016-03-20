var Game = function() {
  // Determine what player we are.
  this._player = parseInt(window.location.hash.replace('#', ''), 10);

  // Set the width and height of the scene.
  this._width = 1920;
  this._height = 1080;

  // Make sure we maintain the correct aspect ratio.
  window.addEventListener('resize', function() {
    this.resize();
  }.bind(this), false);

  // Setup the background canvas.
  this.bgRenderer = new PIXI.CanvasRenderer(this._width, this._height);
  document.body.appendChild(this.bgRenderer.view);
  this.bgStage = new PIXI.Stage();

  // Setup the rendering surface.
  this.renderer = new PIXI.CanvasRenderer(this._width, this._height, null, true);
  document.body.appendChild(this.renderer.view);

  // Create the main stage to draw on.
  this.stage = new PIXI.Stage();

  // Setup our physics world simulation.
  this.world = new p2.World({
    gravity: [0, 0]
  });

  // Speed paramters for our ship
  this.speed = 500;
  this.turnSpeed = 3;

  window.addEventListener('keydown', function(event) {
    this.handleKeys(event.keyCode, true);
  }.bind(this), false);
  window.addEventListener('keyup', function(event) {
    this.handleKeys(event.keyCode, false);
  }.bind(this), false);

  this.enemyBodies = [];
  this.enemyGraphics = [];
  this.removeObjs = [];

  // Setup socket.io.
  this.socket = io('http://localhost:2000');

  // Update the score when data receive.
  this.socket.on('score', function(msg) {
    this._score[msg.plr] = msg.score;
    this.score[msg.plr].setText(this._score[msg.plr]);
  }.bind(this));

  // Start running the game.
  this.build();
};

Game.prototype = {
  /**
   * Build the scene and begin animating.
   */
  build: function() {
    this.resize();

    // Draw the star-field in the background.
    this.drawStars();

    // Setup the boundaries of the game's arena.
    this.setupBoundaries();

    // Draw the ship to the scene.
    this.createShip();

    // Spawn random enemy ships.
    this.createEnemies();

    // Setup howler.js audio.
    this.setupAudio();

    // Setup score views.
    this.setupScores();

    // Begin the first frame.
    requestAnimationFrame(this.tick.bind(this));
  },

  /**
   * Setup the howler.js audio object.
   */
  setupAudio: function() {
    this.sounds = new Howl({
      urls: ['sounds.mp3', 'sounds.ogg'],
      sprite: {
        boom1: [0, 640],
        boom2: [2000, 2140],
        boom3: [5000, 2180]
      }
    });

    this.music = new Howl({
      urls: ['music.mp3', 'music.ogg'],
      buffer: true,
      autoplay: true,
      volume: 0.7,
      loop: true
    });
  },

  /**
   * Draw the field of stars behind all of the action.
   */
  drawStars: function() {
    // Draw randomly positioned stars.
    for (var i=0; i<1500; i++) {
      // Generate random parameters for the stars.
      var x = Math.round(Math.random() * this._width);
      var y = Math.round(Math.random() * this._height);
      var rad = Math.ceil(Math.random() * 2);
      var alpha = Math.min(Math.random() + 0.25, 1);

      // Draw the star.
      var star  = new PIXI.Graphics();
      star.beginFill(0xFFFFFF, alpha);
      star.drawCircle(x, y, rad);
      star.endFill();

      // Attach the star to the stage.
      this.bgStage.addChild(star);
    }

    // Render the stars once.
    this.bgRenderer.render(this.bgStage);
  },

  /**
   * Draw the boundaries of the space arena.
   */
  setupBoundaries: function() {
    var walls = new PIXI.Graphics();
    walls.beginFill(0xFFFFFF, 0.5);
    walls.drawRect(0, 0, this._width, 10);
    walls.drawRect(this._width - 10, 10, 10, this._height - 20);
    walls.drawRect(0, this._height - 10, this._width, 10);
    walls.drawRect(0, 10, 10, this._height - 20);
    
    // Attach the walls to the stage.
    this.bgStage.addChild(walls);

    // Render the boundaries once.
    this.bgRenderer.render(this.bgStage);
  },

  /**
   * Setup our player's spaceship and draw to the stage.
   */
  createShip: function() {
    // Create the ship object.
    this.ship = new p2.Body({
      mass: 1,
      angularVelocity: 0,
      damping: 0,
      angularDamping: 0,
      position: [Math.round(this._width / 2), Math.round(this._height / 2)]
    });
    this.shipShape = new p2.Rectangle(52, 69);
    this.ship.addShape(this.shipShape);
    this.world.addBody(this.ship);

    // Create ship graphics object.
    var shipGraphics = new PIXI.Graphics();

    // Draw the ship's body.
    shipGraphics.beginFill(this._player === 0 ? 0x20d3fe : 0xffe400);
    shipGraphics.moveTo(26, 0);
    shipGraphics.lineTo(0, 60);
    shipGraphics.lineTo(52, 60);
    shipGraphics.endFill();

    // Add engine to our ship.
    shipGraphics.beginFill(this._player === 0 ? 0x1495d1 : 0xffc000);
    shipGraphics.drawRect(7, 60, 38, 8);
    shipGraphics.endFill();

    // Cache the ship to only use one draw call per tick.
    var shipCache = new PIXI.CanvasRenderer(52, 69, null, true);
    var shipCacheStage = new PIXI.Stage();
    shipCacheStage.addChild(shipGraphics);
    shipCache.render(shipCacheStage);
    var shipTexture = PIXI.Texture.fromCanvas(shipCache.view);
    this.shipGraphics = new PIXI.Sprite(shipTexture);

    // Attach the ship to the sage.
    this.stage.addChild(this.shipGraphics);
  },

  /**
   * Create a new enemy every 1000ms with random params.
   */
  createEnemies: function() {
    // Create the graphics object.
    var enemyGraphics = new PIXI.Graphics();
    enemyGraphics.beginFill(0x38d41a);
    enemyGraphics.drawCircle(20, 20, 20);
    enemyGraphics.endFill();
    enemyGraphics.beginFill(0x2aff00);
    enemyGraphics.lineStyle(1, 0x239d0b, 1);
    enemyGraphics.drawCircle(20, 20, 10);
    enemyGraphics.endFill();

    // Create the enmy cache.
    var enemyCache = new PIXI.CanvasRenderer(40, 40, null, true);
    var enemyCacheStage = new PIXI.Stage();
    enemyCacheStage.addChild(enemyGraphics);
    enemyCache.render(enemyCacheStage);
    var enemyTexture = PIXI.Texture.fromCanvas(enemyCache.view);

    // Create random interval to generate new enemies.
    this.enemyTimer = setInterval(function() {
      // Create the enemy physics body.
      var x = Math.round(Math.random() * this._width);
      var y = Math.round(Math.random() * this._height);
      var vx = (Math.random() - 0.5) * this.speed;
      var vy = (Math.random() - 0.5) * this.speed;
      var va = (Math.random() - 0.5) * this.speed;
      var enemy = new p2.Body({
        position: [x, y],
        mass: 1,
        damping: 0,
        angularDamping: 0,
        velocity: [vx, vy],
        angularVelocity: va
      });
      var enemyShape = new p2.Circle(20);
      enemyShape.sensor = true;
      enemy.addShape(enemyShape);
      this.world.addBody(enemy);

      var enemySprite = new PIXI.Sprite(enemyTexture);
      this.stage.addChild(enemySprite);

      // Keep track of these enemies.
      this.enemyBodies.push(enemy);
      this.enemyGraphics.push(enemySprite);
    }.bind(this), 1000);

    this.world.on('beginContact', function(event) {
      if (event.bodyB.id === this.ship.id) {
        event.bodyA._sound = true;
        this.removeObjs.push(event.bodyA);

        // Add a point to the score.
        this._score[this._player]++;
        this.score[this._player].setText(this._score[this._player]);

        // Broadcast the score update to all clients.
        this.socket.emit('score', {
          score: this._score[this._player],
          plr: this._player
        });
      }
    }.bind(this));
  },

  /**
   * Setup the text to display scores.
   */
  setupScores: function() {
    this._score = [0, 0];
    this.score = [];

    // Setup the score text for player 1.
    this.score[0] = new PIXI.Text(this._score[0], {
      font: 'bold 40px Arial',
      fill: 'cyan',
      align: 'left'
    });
    this.score[0].x = 20;
    this.score[0].y = 1025;

    // Setup the score text for player 2.
    this.score[1] = new PIXI.Text(this._score[1], {
      font: 'bold 40px Arial',
      fill: 'yellow',
      align: 'right'
    });
    this.score[1].x = 1880;
    this.score[1].y = 1025;

    // Add the text to the stage.
    this.stage.addChild(this.score[0]);
    this.stage.addChild(this.score[1]);
  },

  /**
   * Handle key presses and filter them.
   * @param  {Number} code  Key code pressed.
   * @param  {Boolean} state true/false
   */
  handleKeys: function(code, state) {
    switch (code) {
      case 65: // A
        this.keyLeft = state;
        break;

      case 68: // D
        this.keyRight = state;
        break;

      case 87: // W
        this.keyUp = state;
        break;
    }
  },

  /**
   * Update physics within the game loop.
   */
  updatePhysics: function() {
    // Update the ship's angular velocities for rotation.
    if (this.keyLeft) {
      this.ship.angularVelocity = -1 * this.turnSpeed;
    } else if (this.keyRight) {
      this.ship.angularVelocity = this.turnSpeed;
    } else {
      this.ship.angularVelocity = 0;
    }

    // Apply the force vector to ship.
    if (this.keyUp) {
      var angle = this.ship.angle + Math.PI / 2;
      this.ship.force[0] -= this.speed * Math.cos(angle);
      this.ship.force[1] -= this.speed * Math.sin(angle);
    }

    // Update the position of the graphics based on the
    // physics simulation position.
    this.shipGraphics.x = this.ship.position[0];
    this.shipGraphics.y = this.ship.position[1];
    this.shipGraphics.rotation = this.ship.angle;

    // Warp the ship to the other side if it is out of bounds.
    if (this.ship.position[0] > this._width) {
      this.ship.position[0] = 0;
    } else if (this.ship.position[0] < 0) {
      this.ship.position[0] = this._width;
    }
    if (this.ship.position[1] > this._height) {
      this.ship.position[1] = 0;
    } else if (this.ship.position[1] < 0) {
      this.ship.position[1] = this._height;
    }

    // Update enemy positions.
    for (var i=0; i<this.enemyBodies.length; i++) {
      var x = this.enemyBodies[i].position[0];
      var y = this.enemyBodies[i].position[1];
      this.enemyGraphics[i].x = x;
      this.enemyGraphics[i].y = y;

      // Remove enemy bodies that are off the map.
      if (x < 0 || y < 0 || x > this._width || y > this._height) {
        this.removeObjs.push(this.enemyBodies[i]);
      }
    }

    // Step the physics simulation forward.
    this.world.step(1 / 60);

    // Remove enemy bodies.
    for (i=0; i<this.removeObjs.length; i++) {
      this.world.removeBody(this.removeObjs[i]);

      // Play random boom sound.
      if (this.removeObjs[i]._sound) {
        this.sounds.play('boom' + (Math.ceil(Math.random() * 3)));
      }

      var index = this.enemyBodies.indexOf(this.removeObjs[i]);
      if (index) {
        this.enemyBodies.splice(index, 1);
        this.stage.removeChild(this.enemyGraphics[index]);
        this.enemyGraphics.splice(index, 1);
      }
    }

    this.removeObjs.length = 0;
  },

  /**
   * Fired on the resize event.
   */
  resize: function() {
    var ratio = 1080 / 1920;
    var docWidth = document.body.clientWidth;
    var docHeight = document.body.clientHeight;

    if (docHeight / docWidth < ratio) {
      this.bgRenderer.view.style.height = '100%';
      this.renderer.view.style.height = '100%';
      this.bgRenderer.view.style.width = 'auto';
      this.renderer.view.style.width = 'auto';
    } else {
      this.bgRenderer.view.style.width = '100%';
      this.renderer.view.style.width = '100%';
      this.bgRenderer.view.style.height = 'auto';
      this.renderer.view.style.height = 'auto';
    }
  },

  /**
   * Fires at the end of the gameloop to reset and redraw the canvas.
   */
  tick: function() {
    this.updatePhysics();

    // Render the stage for the current frame.
    this.renderer.render(this.stage);

    // Begin the next frame.
    requestAnimationFrame(this.tick.bind(this));
  }
};