const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const levelEl = document.querySelector("#level");
const waveEl = document.querySelector("#wave");
const hpEl = document.querySelector("#hp");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PLAYER_RADIUS = 18;
const MAX_HP = 100;

let state;
let lastTime = 0;
let animationId = 0;
let pointerActive = false;
let stars = [];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function makeStars() {
  stars = Array.from({ length: 90 }, () => ({
    x: rand(0, WIDTH),
    y: rand(0, HEIGHT),
    r: rand(0.6, 2),
    speed: rand(18, 86),
    color: Math.random() > 0.82 ? "#5df2ff" : Math.random() > 0.72 ? "#ffd45f" : "#ffffff",
  }));
}

function baseState() {
  return {
    mode: "ready",
    score: 0,
    level: 1,
    wave: 1,
    wavesPerLevel: 3,
    player: {
      x: WIDTH / 2,
      y: HEIGHT - 78,
      targetX: WIDTH / 2,
      targetY: HEIGHT - 78,
      hp: MAX_HP,
      fireTimer: 0,
      invulnerable: 0,
    },
    enemies: [],
    playerBullets: [],
    enemyShots: [],
    particles: [],
    waveDelay: -1,
    messageTimer: 0,
    message: "",
  };
}

function resetGame() {
  state = baseState();
  makeStars();
  spawnWave();
  state.mode = "playing";
  overlay.classList.add("hidden");
  lastTime = performance.now();
  updateHud();
}

function setOverlay(title, body, buttonText) {
  overlay.classList.remove("hidden");
  overlay.querySelector("h1").textContent = title;
  overlay.querySelector("p").textContent = body;
  overlay.querySelector(".small").textContent =
    "Mini boss every 5 levels. Boss every 10 levels.";
  startButton.textContent = buttonText;
}

function enemyCountForWave() {
  return 4 + state.wave + Math.floor(state.level * 0.8);
}

function waveType() {
  if (state.level % 10 === 0 && state.wave === state.wavesPerLevel) return "boss";
  if (state.level % 5 === 0 && state.wave === state.wavesPerLevel) return "miniBoss";
  return "normal";
}

function spawnWave() {
  state.waveDelay = -1;
  const type = waveType();
  state.message = type === "boss" ? "Boss incoming" : type === "miniBoss" ? "Mini boss incoming" : `Wave ${state.wave}`;
  state.messageTimer = 1.6;

  if (type === "boss" || type === "miniBoss") {
    const boss = {
      type,
      x: WIDTH / 2,
      y: type === "boss" ? 92 : 82,
      radius: type === "boss" ? 56 : 42,
      hp: type === "boss" ? 170 + state.level * 22 : 95 + state.level * 14,
      maxHp: type === "boss" ? 170 + state.level * 22 : 95 + state.level * 14,
      speed: type === "boss" ? 70 : 95,
      dir: Math.random() > 0.5 ? 1 : -1,
      fireTimer: 0.3,
      score: type === "boss" ? 850 : 430,
    };
    state.enemies.push(boss);
    return;
  }

  const count = enemyCountForWave();
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / 6);
    state.enemies.push({
      type: "normal",
      x: 90 + (i % 6) * 145 + rand(-12, 12),
      y: -40 - row * 74 - rand(0, 80),
      radius: 20,
      hp: 18 + state.level * 5,
      maxHp: 18 + state.level * 5,
      speed: 38 + state.level * 4 + rand(0, 22),
      sway: rand(1.3, 2.5),
      phase: rand(0, Math.PI * 2),
      fireTimer: rand(0.8, 2.3),
      score: 90 + state.level * 12,
    });
  }
}

function nextWaveOrLevel() {
  if (state.wave < state.wavesPerLevel) {
    state.wave += 1;
  } else {
    state.level += 1;
    state.wave = 1;
    state.player.hp = clamp(state.player.hp + 18, 0, MAX_HP);
  }
  state.waveDelay = 1.2;
  updateHud();
}

function updateHud() {
  scoreEl.textContent = state.score;
  levelEl.textContent = state.level;
  waveEl.textContent = `${state.wave}/${state.wavesPerLevel}`;
  hpEl.textContent = Math.max(0, Math.ceil(state.player.hp));
  hpEl.style.color = state.player.hp <= 30 ? "var(--danger)" : "var(--text)";
}

function addParticles(x, y, color, amount = 12) {
  for (let i = 0; i < amount; i += 1) {
    state.particles.push({
      x,
      y,
      vx: rand(-120, 120),
      vy: rand(-120, 80),
      life: rand(0.3, 0.8),
      maxLife: 0.8,
      r: rand(2, 5),
      color,
    });
  }
}

function playerFire(dt) {
  state.player.fireTimer -= dt;
  if (state.player.fireTimer > 0) return;
  state.player.fireTimer = 0.12;
  state.playerBullets.push({
    x: state.player.x - 9,
    y: state.player.y - 22,
    radius: 4,
    vy: -620,
    damage: 11,
  });
  state.playerBullets.push({
    x: state.player.x + 9,
    y: state.player.y - 22,
    radius: 4,
    vy: -620,
    damage: 11,
  });
}

function enemyFire(enemy, dt) {
  enemy.fireTimer -= dt;
  if (enemy.fireTimer > 0 || enemy.y < 0) return;

  const boss = enemy.type !== "normal";
  enemy.fireTimer = boss ? rand(0.35, 0.7) : rand(1.0, 2.2);
  const dx = state.player.x - enemy.x;
  const dy = state.player.y - enemy.y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = boss ? 225 + state.level * 5 : 165 + state.level * 4;

  state.enemyShots.push({
    x: enemy.x,
    y: enemy.y + enemy.radius * 0.7,
    vx: (dx / len) * speed,
    vy: (dy / len) * speed,
    radius: boss ? 8 : 6,
    damage: boss ? 15 : 10,
    color: boss ? "#ffd166" : "#ff4e72",
  });

  if (boss) {
    for (const angle of [-0.35, 0.35]) {
      state.enemyShots.push({
        x: enemy.x,
        y: enemy.y + enemy.radius * 0.5,
        vx: Math.sin(angle) * speed,
        vy: Math.cos(angle) * speed,
        radius: 7,
        damage: 12,
        color: "#b788ff",
      });
    }
  }
}

function update(dt) {
  if (state.mode !== "playing") return;

  for (const star of stars) {
    star.y += star.speed * dt;
    if (star.y > HEIGHT + 4) {
      star.y = -4;
      star.x = rand(0, WIDTH);
    }
  }

  const p = state.player;
  p.x += (p.targetX - p.x) * Math.min(1, dt * 18);
  p.y += (p.targetY - p.y) * Math.min(1, dt * 18);
  p.x = clamp(p.x, PLAYER_RADIUS, WIDTH - PLAYER_RADIUS);
  p.y = clamp(p.y, PLAYER_RADIUS + 28, HEIGHT - PLAYER_RADIUS);
  p.invulnerable = Math.max(0, p.invulnerable - dt);

  playerFire(dt);

  for (const bullet of state.playerBullets) {
    bullet.y += bullet.vy * dt;
  }

  for (const enemy of state.enemies) {
    if (enemy.type === "normal") {
      enemy.phase += enemy.sway * dt;
      enemy.y += enemy.speed * dt;
      enemy.x += Math.sin(enemy.phase) * 48 * dt;
      if (enemy.y > HEIGHT + 50) {
        enemy.y = -40;
        enemy.x = rand(70, WIDTH - 70);
      }
    } else {
      enemy.x += enemy.speed * enemy.dir * dt;
      if (enemy.x < enemy.radius + 20 || enemy.x > WIDTH - enemy.radius - 20) {
        enemy.dir *= -1;
      }
      enemy.y += Math.sin(performance.now() / 700) * 10 * dt;
    }
    enemyFire(enemy, dt);
  }

  for (const shot of state.enemyShots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
  }

  handleCollisions();

  state.playerBullets = state.playerBullets.filter((b) => b.y > -20);
  state.enemyShots = state.enemyShots.filter(
    (s) => s.x > -60 && s.x < WIDTH + 60 && s.y > -60 && s.y < HEIGHT + 60,
  );
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);

  if (state.enemies.length === 0) {
    if (state.waveDelay < 0) {
      nextWaveOrLevel();
    } else {
      state.waveDelay -= dt;
      if (state.waveDelay <= 0) {
        spawnWave();
      }
    }
  }

  state.messageTimer = Math.max(0, state.messageTimer - dt);
  updateHud();
}

function handleCollisions() {
  for (const bullet of state.playerBullets) {
    if (bullet.hit) continue;
    for (const enemy of state.enemies) {
      if (distance(bullet, enemy) < bullet.radius + enemy.radius) {
        enemy.hp -= bullet.damage;
        bullet.hit = true;
        addParticles(bullet.x, bullet.y, "#49d2ff", 3);
        if (enemy.hp <= 0) {
          state.score += enemy.score;
          addParticles(enemy.x, enemy.y, enemy.type === "normal" ? "#7dff9f" : "#ffd166", enemy.type === "normal" ? 18 : 36);
        }
        break;
      }
    }
  }
  state.playerBullets = state.playerBullets.filter((bullet) => !bullet.hit);

  if (state.player.invulnerable <= 0) {
    for (const shot of state.enemyShots) {
      if (shot.hit) continue;
      if (distance(shot, state.player) < shot.radius + PLAYER_RADIUS * 0.8) {
        shot.hit = true;
        state.player.hp -= shot.damage;
        state.player.invulnerable = 0.55;
        addParticles(state.player.x, state.player.y, "#ff4e72", 14);
        if (state.player.hp <= 0) {
          endGame();
        }
        break;
      }
    }
  }
  state.enemyShots = state.enemyShots.filter((shot) => !shot.hit);

  for (const enemy of state.enemies) {
    if (distance(enemy, state.player) < enemy.radius + PLAYER_RADIUS) {
      enemy.hp = 0;
      state.player.hp -= enemy.type === "normal" ? 18 : 35;
      addParticles(state.player.x, state.player.y, "#ff4e72", 20);
      addParticles(enemy.x, enemy.y, "#ffd166", 20);
      if (state.player.hp <= 0) {
        endGame();
      }
    }
  }
}

function endGame() {
  state.mode = "gameover";
  setOverlay(
    "Mission Failed",
    `Final score: ${state.score}. You reached level ${state.level}, wave ${state.wave}.`,
    "Restart",
  );
}

function drawBackground() {
  const backdrop = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  backdrop.addColorStop(0, "#07132a");
  backdrop.addColorStop(0.52, "#080c1d");
  backdrop.addColorStop(1, "#160924");
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.18;
  const glow = ctx.createRadialGradient(WIDTH * 0.72, HEIGHT * 0.18, 20, WIDTH * 0.72, HEIGHT * 0.18, 360);
  glow.addColorStop(0, "#ff4f8b");
  glow.addColorStop(0.5, "#38d5ff");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();

  for (const star of stars) {
    ctx.globalAlpha = star.r / 2.2;
    ctx.fillStyle = star.color;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.invulnerable > 0 && Math.floor(p.invulnerable * 18) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

  ctx.shadowColor = "#38d5ff";
  ctx.shadowBlur = 18;

  const body = ctx.createLinearGradient(0, -30, 0, 24);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.42, "#58e0ff");
  body.addColorStop(1, "#2456ff");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(16, 18);
  ctx.lineTo(0, 10);
  ctx.lineTo(-16, 18);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ff4f8b";
  ctx.beginPath();
  ctx.moveTo(-13, 5);
  ctx.lineTo(-33, 22);
  ctx.lineTo(-10, 17);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ff4f8b";
  ctx.beginPath();
  ctx.moveTo(13, 5);
  ctx.lineTo(33, 22);
  ctx.lineTo(10, 17);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#07132a";
  ctx.beginPath();
  ctx.moveTo(0, -19);
  ctx.lineTo(7, 7);
  ctx.lineTo(0, 3);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.fill();

  const flame = ctx.createLinearGradient(0, 21, 0, 42);
  flame.addColorStop(0, "#ffffff");
  flame.addColorStop(0.35, "#ffd45f");
  flame.addColorStop(1, "#ff4f8b");
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(-7, 20);
  ctx.lineTo(0, 40 + Math.sin(performance.now() / 45) * 5);
  ctx.lineTo(7, 20);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(enemy) {
  const boss = enemy.type !== "normal";
  ctx.save();
  ctx.translate(enemy.x, enemy.y);

  const hull = ctx.createLinearGradient(-enemy.radius, -enemy.radius, enemy.radius, enemy.radius);
  hull.addColorStop(0, boss ? (enemy.type === "boss" ? "#f16cff" : "#ffe16b") : "#7cf66b");
  hull.addColorStop(1, boss ? (enemy.type === "boss" ? "#6d45ff" : "#ff7a59") : "#15bda6");
  ctx.shadowColor = boss ? "#a87cff" : "#7cf66b";
  ctx.shadowBlur = boss ? 20 : 10;
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.ellipse(0, 0, enemy.radius * 1.25, enemy.radius * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = boss ? "#24113f" : "#0b3424";
  ctx.beginPath();
  ctx.arc(0, -4, enemy.radius * 0.38, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff4e72";
  ctx.fillRect(-enemy.radius * 0.7, enemy.radius * 0.36, enemy.radius * 0.35, 5);
  ctx.fillRect(enemy.radius * 0.35, enemy.radius * 0.36, enemy.radius * 0.35, 5);

  if (boss) {
    const barW = enemy.radius * 2.2;
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(-barW / 2, -enemy.radius - 15, barW, 7);
    ctx.fillStyle = "#ff4e72";
    ctx.fillRect(-barW / 2, -enemy.radius - 15, barW * Math.max(0, enemy.hp / enemy.maxHp), 7);
  }

  ctx.restore();
}

function drawBullets() {
  ctx.shadowColor = "#38d5ff";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#38d5ff";
  for (const bullet of state.playerBullets) {
    ctx.beginPath();
    ctx.roundRect(bullet.x - 3, bullet.y - 12, 6, 18, 3);
    ctx.fill();
  }

  ctx.shadowBlur = 10;
  for (const shot of state.enemyShots) {
    ctx.shadowColor = shot.color;
    ctx.fillStyle = shot.color;
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMessage() {
  if (state.messageTimer <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, state.messageTimer);
  ctx.fillStyle = "#f5fbff";
  ctx.shadowColor = "#38d5ff";
  ctx.shadowBlur = 20;
  ctx.font = "800 34px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(state.message, WIDTH / 2, 92);
  ctx.restore();
}

function draw() {
  drawBackground();
  if (!state) return;
  for (const enemy of state.enemies) drawEnemy(enemy);
  drawBullets();
  drawPlayer();
  drawParticles();
  drawMessage();
}

function loop(time) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
  animationId = requestAnimationFrame(loop);
}

function pointerToCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
  };
}

function setPlayerTarget(event) {
  if (!state || state.mode !== "playing") return;
  const point = pointerToCanvas(event);
  state.player.targetX = clamp(point.x, PLAYER_RADIUS, WIDTH - PLAYER_RADIUS);
  state.player.targetY = clamp(point.y, PLAYER_RADIUS, HEIGHT - PLAYER_RADIUS);
}

canvas.addEventListener("pointerdown", (event) => {
  pointerActive = true;
  canvas.setPointerCapture(event.pointerId);
  setPlayerTarget(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (pointerActive || event.pointerType === "mouse") {
    setPlayerTarget(event);
  }
});

canvas.addEventListener("pointerup", (event) => {
  pointerActive = false;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener("pointercancel", () => {
  pointerActive = false;
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "r") {
    resetGame();
  }
});

startButton.addEventListener("click", resetGame);

state = baseState();
makeStars();
draw();
animationId = requestAnimationFrame(loop);

window.addEventListener("beforeunload", () => cancelAnimationFrame(animationId));
