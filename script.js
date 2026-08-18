'use strict';
/* ============================================================
   STAR CATCHER — NEON ODYSSEY
   ============================================================ */

// ---------- Character definitions ----------
const CHARS = {
    pilot:    { name: 'PILOT',    accent: '#ffb74d', glow: '#ff9800', desc: 'Fast & Nimble', speed: 520, accel: 11, lives: 3, magnet: false, hitR: 32, dash: 1.45 },
    explorer: { name: 'EXPLORER', accent: '#4fc3f7', glow: '#29b6f6', desc: 'Star Magnet',   speed: 400, accel: 9,  lives: 3, magnet: true,  hitR: 34, dash: 1.20 },
    scout:    { name: 'SCOUT',    accent: '#81c784', glow: '#66bb6a', desc: 'Extra Lives',   speed: 430, accel: 10, lives: 5, magnet: false, hitR: 28, dash: 1.20 }
};

// ---------- Falling item definitions ----------
const ITEM_DEFS = {
    star:     { r: 15, v: 1, color: '#ffe95c', glow: '#ffd700', chance: 0.58, drift: 0.35, spin: 0.03 },
    gem:      { r: 13, v: 3, color: '#7df9ff', glow: '#00e5ff', chance: 0.16, drift: 0.30, spin: 0.06 },
    gold:     { r: 19, v: 8, color: '#ffdf00', glow: '#fff59d', chance: 0.05, drift: 0.20, spin: 0.02 },
    heart:    { r: 15, v: 0, heal: 1,           color: '#ff6b81', glow: '#ff8fa3', chance: 0.06, drift: 0.20, spin: 0.02 },
    asteroid: { r: 17, hazard: true,            color: '#a1887f', glow: '#5d4037', chance: 0.15, drift: 0.55, spin: 0.09 }
};

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const menuScreen = $('character-select');
const gameScreen = $('game-screen');
const gameCanvas = $('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const bgCanvas = $('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');
const startBtn = $('startBtn');

// ---------- Image loading ----------
const images = {};
let imagesReady = false;
function loadImages() {
    const pending = Object.keys(CHARS).map(key => new Promise(res => {
        const img = new Image();
        img.onload = () => { images[key] = img; res(); };
        img.onerror = res;
        img.src = CHARS[key].name.toLowerCase() + '.png';
    }));
    Promise.all(pending).then(() => {
        imagesReady = true;
        refreshStartBtn();
    });
}

// ---------- Audio (WebAudio beeps) ----------
let audioCtx = null;
function ensureAudio() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function tone(freq, dur, type = 'sine', vol = 0.14, slideTo = null, delay = 0) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
}
const SFX = {
    select: () => tone(520, 0.08, 'square', 0.08),
    launch: () => { tone(300, 0.3, 'sawtooth', 0.1, 900); tone(600, 0.3, 'sine', 0.08, 1200, 0.05); },
    catch:  combo => tone(420 + Math.min(combo, 12) * 45, 0.09, 'square', 0.1, 620 + Math.min(combo, 12) * 45),
    gem:    () => { tone(880, 0.1, 'triangle', 0.12); tone(1320, 0.12, 'triangle', 0.1, null, 0.06); },
    gold:   () => { [660, 880, 1100, 1480].forEach((f, i) => tone(f, 0.12, 'triangle', 0.12, null, i * 0.06)); },
    heart:  () => { tone(523, 0.12, 'sine', 0.12); tone(784, 0.18, 'sine', 0.12, null, 0.1); },
    boom:   () => { tone(160, 0.35, 'sawtooth', 0.16, 45); tone(90, 0.4, 'square', 0.1, 40, 0.02); },
    miss:   () => tone(240, 0.12, 'sine', 0.06, 150),
    level:  () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'square', 0.09, null, i * 0.08)); },
    dash:   () => tone(200, 0.22, 'sawtooth', 0.1, 1400),
    over:   () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, null, i * 0.18)); }
};

// ---------- Background starfield ----------
const bg = { stars: [], nebula: [], shooters: [], w: 0, h: 0 };
function initBg() {
    bg.w = window.innerWidth;
    bg.h = window.innerHeight;
    bgCanvas.width = bg.w * devicePixelRatio;
    bgCanvas.height = bg.h * devicePixelRatio;
    bgCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    bg.stars = [];
    const counts = [90, 55, 30]; // deep, mid, near
    counts.forEach((n, layer) => {
        for (let i = 0; i < n; i++) {
            const depth = 0.35 + layer * 0.32;
            bg.stars.push({
                x: Math.random() * bg.w,
                y: Math.random() * bg.h,
                r: (0.4 + Math.random() * 1.5) * depth * 2.4,
                sp: (0.12 + Math.random() * 0.35) * depth * 4,
                tw: Math.random() * Math.PI * 2,
                tws: 0.8 + Math.random() * 2.2,
                hue: Math.random() < 0.18 ? (Math.random() < 0.5 ? 200 : 35) : 0
            });
        }
    });

    const nebCols = ['rgba(88,60,255,', 'rgba(255,50,140,', 'rgba(0,180,255,', 'rgba(120,60,255,'];
    bg.nebula = [];
    for (let i = 0; i < 4; i++) {
        bg.nebula.push({
            x: Math.random() * bg.w,
            y: Math.random() * bg.h,
            r: 130 + Math.random() * 200,
            col: nebCols[i % nebCols.length],
            a: 0.05 + Math.random() * 0.05,
            dx: (Math.random() - 0.5) * 0.15,
            dy: (Math.random() - 0.5) * 0.12
        });
    }

    bg.shooters = [];
}
function spawnShooter() {
    bg.shooters.push({
        x: Math.random() * bg.w * 0.8 + bg.w * 0.1,
        y: Math.random() * bg.h * 0.3,
        vx: -(2.5 + Math.random() * 3.5),
        vy: 1.2 + Math.random() * 1.6,
        life: 1
    });
}
let nextShooter = 2.5;
function drawBg(dt, speedMul = 1) {
    const w = bg.w, h = bg.h;
    const dim = inGameMode ? 0.45 : 1;      // nebula dimming during play
    const starDim = inGameMode ? 0.68 : 1;  // star dimming during play
    const streaking = inGameMode;           // hyperspace streaks during play
    // Nebula
    bgCtx.save();
    bgCtx.globalCompositeOperation = 'lighter';
    for (const n of bg.nebula) {
        n.x += n.dx * dt; n.y += n.dy * dt;
        if (n.x < -n.r) n.x = w + n.r; if (n.x > w + n.r) n.x = -n.r;
        if (n.y < -n.r) n.y = h + n.r; if (n.y > h + n.r) n.y = -n.r;
        const g = bgCtx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        g.addColorStop(0, n.col + (n.a * dim) + ')');
        g.addColorStop(1, n.col + '0)');
        bgCtx.fillStyle = g;
        bgCtx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    // Stars
    for (const s of bg.stars) {
        s.y += s.sp * speedMul * dt;
        if (s.y > h + 2) { s.y = -2; s.x = Math.random() * w; }
        s.tw += s.tws * dt;
        const a = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.tw))) * starDim;
        bgCtx.globalAlpha = a;
        bgCtx.fillStyle = s.hue ? (s.hue === 200 ? '#9fd8ff' : '#ffd9a0') : '#ffffff';
        if (streaking && s.r > 1.5) {
            // Stretch into a vertical streak for a hyperspace feel
            const len = Math.min(26, s.sp * speedMul * 3.2);
            bgCtx.strokeStyle = bgCtx.fillStyle;
            bgCtx.lineWidth = s.r * 0.7;
            bgCtx.beginPath();
            bgCtx.moveTo(s.x, s.y - len);
            bgCtx.lineTo(s.x, s.y);
            bgCtx.stroke();
        } else {
            bgCtx.beginPath();
            bgCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            bgCtx.fill();
        }
    }
    bgCtx.globalAlpha = 1;
    // Shooting stars
    nextShooter -= dt;
    if (nextShooter <= 0) { spawnShooter(); nextShooter = 3 + Math.random() * 5; }
    for (let i = bg.shooters.length - 1; i >= 0; i--) {
        const sh = bg.shooters[i];
        sh.x += sh.vx * dt; sh.y += sh.vy * dt;
        sh.life -= dt * 0.55;
        if (sh.life <= 0 || sh.x < -100 || sh.y > h + 100) { bg.shooters.splice(i, 1); continue; }
        const tail = 12;
        const g = bgCtx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * tail, sh.y - sh.vy * tail);
        g.addColorStop(0, 'rgba(255,255,255,' + (0.8 * sh.life * (inGameMode ? 0.5 : 1)) + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        bgCtx.strokeStyle = g;
        bgCtx.lineWidth = 1.6;
        bgCtx.beginPath();
        bgCtx.moveTo(sh.x, sh.y);
        bgCtx.lineTo(sh.x - sh.vx * tail, sh.y - sh.vy * tail);
        bgCtx.stroke();
    }
    bgCtx.restore();

    // Dark veil over everything while playing (deep space feel)
    if (inGameMode) {
        bgCtx.save();
        bgCtx.globalCompositeOperation = 'source-over';
        const vg = bgCtx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
        vg.addColorStop(0, 'rgba(1,2,10,0.15)');
        vg.addColorStop(1, 'rgba(0,1,8,0.40)');
        bgCtx.fillStyle = vg;
        bgCtx.fillRect(0, 0, w, h);
        bgCtx.restore();
    }
}

// ---------- Game state ----------
let player, items, particles, texts;
let score = 0, best = 0, bestCombo = 0, combo = 0, mult = 1;
let lives = 0, level = 1, gameActive = false;
let lastTime = 0, spawnTimer = 0, shake = 0, invuln = 0;
let dashT = 0, dashCd = 0, dashDir = 0;
let selected = null;
let keys = {};
let touchTarget = null;
let rafId = null;
let bgRafId = null;
let inGameMode = false;

const MAX_LIVES = 5;

function loadBest() {
    try { best = parseInt(localStorage.getItem('starcatcher_best')) || 0; } catch (e) { best = 0; }
    try { bestCombo = parseInt(localStorage.getItem('starcatcher_bestcombo')) || 0; } catch (e) { bestCombo = 0; }
    $('high').textContent = 'BEST ' + best;
    $('bestLabel').textContent = best > 0 ? '★ PERSONAL BEST: ' + best + ' ★' : '';
}
function saveBest() {
    try {
        localStorage.setItem('starcatcher_best', best);
        localStorage.setItem('starcatcher_bestcombo', bestCombo);
    } catch (e) {}
}

// ---------- Character select ----------
function refreshStartBtn() {
    startBtn.disabled = !(selected && imagesReady);
}

document.querySelectorAll('.option').forEach(opt => {
    opt.addEventListener('click', () => {
        ensureAudio();
        SFX.select();
        document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selected = opt.dataset.char;
        refreshStartBtn();
    });
});

startBtn.addEventListener('click', () => {
    ensureAudio();
    SFX.launch();
    startGame();
});
$('restartBtn').addEventListener('click', () => { ensureAudio(); SFX.launch(); startGame(); });
$('menuBtn').addEventListener('click', () => {
    ensureAudio();
    stopGame();
    inGameMode = false;
    $('dark-veil').classList.remove('on');
    gameScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    $('game-over').classList.add('hidden');
    refreshStartBtn();
});

// ---------- Game setup ----------
function resizeGame() {
    const wrap = gameCanvas.parentElement;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = wrap.clientWidth, ch = wrap.clientHeight;
    gameCanvas.width = cw * dpr;
    gameCanvas.height = ch * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Reposition player if already in play
    if (player) {
        const w = cw, h = ch;
        player.x = Math.max(0, Math.min(w - player.w, player.x));
        player.y = h - player.h - 18;
    }
}

function startGame() {
    menuScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    inGameMode = true;
    $('dark-veil').classList.add('on');
    $('game-over').classList.add('hidden');
    $('level-flash').classList.add('hidden');
    clearTimeout(flashLevel._t);

    resizeGame();

    const def = CHARS[selected];
    player = {
        x: 0, y: 0, vx: 0,
        speed: def.speed, accel: def.accel,
        hitR: def.hitR, magnet: def.magnet, dash: def.dash,
        w: 86, h: 86,
        img: images[selected]
    };
    player.x = gameCanvas.width / 2 / (devicePixelRatio || 1) - player.w / 2;
    player.y = gameCanvas.height / (devicePixelRatio || 1) - player.h - 18;

    items = []; particles = []; texts = [];
    score = 0; combo = 0; mult = 1;
    lives = def.lives;
    level = 1; spawnTimer = 0.6; shake = 0; invuln = 0; dashT = 0; dashCd = 0;
    touchTarget = null;
    gameActive = true;
    lastTime = performance.now();

    updateHUD();
    updateDashBar(1);

    rafId = requestAnimationFrame(gameLoop);
}

function stopGame() {
    gameActive = false;
    cancelAnimationFrame(rafId);
}

// ---------- Input ----------
document.addEventListener('keydown', e => {
    ensureAudio();
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
    keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true;
    if ((e.key === ' ' || e.key === 'Shift') && gameActive && dashCd <= 0 && dashT <= 0) startDash();
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape')) togglePause();
});
document.addEventListener('keyup', e => { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });

// Touch / mouse drag
gameCanvas.addEventListener('pointerdown', e => { touchTarget = pointerX(e); });
gameCanvas.addEventListener('pointermove', e => { if (e.buttons > 0) touchTarget = pointerX(e); });
gameCanvas.addEventListener('pointerup', () => { touchTarget = null; });
gameCanvas.addEventListener('pointerleave', () => { touchTarget = null; });
function pointerX(e) {
    const rect = gameCanvas.getBoundingClientRect();
    const scale = rect.width / gameCanvas.width * (devicePixelRatio || 1);
    return (e.clientX - rect.left) / scale;
}

let paused = false;
function togglePause() {
    if (!gameActive) return;
    paused = !paused;
    if (!paused) lastTime = performance.now();
}

// ---------- Dash ----------
function startDash() {
    dashT = 0.18;
    dashCd = 1.6;
    const dir = (keys['ArrowLeft'] || keys['a']) ? -1 : (keys['ArrowRight'] || keys['d']) ? 1 : (player.vx >= 0 ? 1 : -1);
    dashDir = dir;
    SFX.dash();
    burst(player.x + player.w / 2, player.y + player.h / 2, 14, '#7df9ff', 3.5);
}

// ---------- Spawning ----------
function spawnItem() {
    const pool = Object.keys(ITEM_DEFS);
    let total = 0;
    for (const t of pool) total += ITEM_DEFS[t].chance;
    let roll = Math.random() * total;
    let type = pool[0];
    for (const t of pool) { roll -= ITEM_DEFS[t].chance; if (roll <= 0) { type = t; break; } }
    const def = ITEM_DEFS[type];
    const w = gameCanvas.width / (devicePixelRatio || 1);
    items.push({
        type, x: 20 + Math.random() * (w - 40),
        y: -def.r - 8,
        r: def.r,
        vy: fallSpeed() * (0.85 + Math.random() * 0.3),
        vx: (Math.random() - 0.5) * def.drift,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * def.spin,
        t: 0
    });
}
function fallSpeed() { return Math.min(8.2, 2.7 + (level - 1) * 0.5); }
function spawnInterval() { return Math.max(430, 780 - (level - 1) * 38); }

// ---------- Particles / texts ----------
function burst(x, y, n, color, speed = 3) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (0.5 + Math.random()) * speed;
        particles.push({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 0.5 + Math.random() * 0.5, max: 1, r: 1.5 + Math.random() * 2.5,
            color
        });
    }
}
function floatText(x, y, text, color, size = 20) {
    texts.push({ x, y, text, color, size, life: 1 });
}

// ---------- Update ----------
function updatePlayer(dt) {
    const w = gameCanvas.width / (devicePixelRatio || 1);
    let dir = 0;
    if (keys['ArrowLeft'] || keys['a']) dir -= 1;
    if (keys['ArrowRight'] || keys['d']) dir += 1;

    if (dashT > 0) {
        dashT -= dt;
        player.x += player.speed * player.dash * 6 * dashDir * dt;
        // afterimage
        if (Math.random() < 0.7) {
            particles.push({
                x: player.x + player.w / 2 + (Math.random() - 0.5) * 14,
                y: player.y + player.h / 2 + (Math.random() - 0.5) * 14,
                vx: 0, vy: 0, life: 0.3, max: 0.3, r: 20, color: '#7df9ff', ghost: true
            });
        }
    } else if (touchTarget != null) {
        const diff = touchTarget - (player.x + player.w / 2);
        const maxMove = player.speed * 2.0 * dt;
        const move = Math.max(-maxMove, Math.min(maxMove, diff));
        player.x += move;
        player.vx = diff > 0 ? 1 : -1;
    } else {
        // Ease toward target velocity (snappy but no runaway momentum)
        const maxV = player.speed / 60;
        const targetV = dir * maxV;
        const k = Math.min(1, player.accel * dt);
        player.vx += (targetV - player.vx) * k;
        if (Math.abs(player.vx) < 0.05) player.vx = 0;
        player.x += player.vx * dt * 60;
    }

    if (player.x < 0) { player.x = 0; player.vx = Math.max(0, player.vx); }
    if (player.x > w - player.w) { player.x = w - player.w; player.vx = Math.min(0, player.vx); }

    // Engine particles
    if (Math.random() < 0.85) {
        particles.push({
            x: player.x + player.w / 2 + (Math.random() - 0.5) * 8,
            y: player.y + player.h - 4,
            vx: (Math.random() - 0.5) * 0.6,
            vy: 1.5 + Math.random() * 2.2,
            life: 0.3 + Math.random() * 0.3, max: 0.6,
            r: 2 + Math.random() * 2.5,
            color: '#ffb74d'
        });
    }

    // Dash cooldown
    if (dashCd > 0) {
        dashCd -= dt;
        updateDashBar(1 - dashCd / 1.6);
    } else {
        updateDashBar(1);
    }
    if (invuln > 0) invuln -= dt;
}

function updateItems(dt) {
    const h = gameCanvas.height / (devicePixelRatio || 1);
    const pxc = player.x + player.w / 2, pyc = player.y + player.h / 2;

    for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.t += dt;
        it.rot += it.spin * dt * 60;

        // Explorer magnet: pull nearby pickups toward player
        if (player.magnet && !ITEM_DEFS[it.type].hazard && it.y > 0) {
            const dx = pxc - it.x, dy = pyc - it.y;
            const d = Math.hypot(dx, dy);
            if (d < 170 && d > 1) {
                const pull = (1 - d / 170) * 10;
                it.x += (dx / d) * pull * dt * 60;
                it.y += (dy / d) * pull * dt * 60;
            }
        }

        it.x += it.vx * dt * 60;
        it.y += it.vy * dt * 60;

        // Wall bounce
        const w = gameCanvas.width / (devicePixelRatio || 1);
        if (it.x < it.r) { it.x = it.r; it.vx = Math.abs(it.vx); }
        if (it.x > w - it.r) { it.x = w - it.r; it.vx = -Math.abs(it.vx); }

        // Collision with player
        if (invuln <= 0 || ITEM_DEFS[it.type].hazard) {
            const d = Math.hypot(it.x - pxc, it.y - pyc);
            if (d < it.r + player.hitR) {
                handleCatch(it);
                items.splice(i, 1);
                continue;
            }
        }

        // Missed bottom
        if (it.y > h + it.r + 10) {
            if (!ITEM_DEFS[it.type].hazard) breakCombo(false);
            items.splice(i, 1);
        }
    }
}

function handleCatch(it) {
    const def = ITEM_DEFS[it.type];
    const pxc = player.x + player.w / 2, pyc = player.y + player.h / 2;

    if (def.hazard) {
        // Asteroid hit
        lives--;
        shake = 14;
        invuln = 1.5;
        combo = 0; mult = 1;
        SFX.boom();
        burst(pxc, pyc, 22, '#a1887f', 4);
        burst(pxc, pyc, 10, '#ff7043', 3);
        floatText(pxc, pyc - 30, 'HIT!', '#ff5d6c', 26);
        navigator.vibrate && navigator.vibrate(80);
        updateHUD();
        if (lives <= 0) endGame();
        return;
    }

    if (def.heal) {
        if (lives < MAX_LIVES) {
            lives++;
            SFX.heart();
            floatText(pxc, pyc - 30, '+1 LIFE', '#ff6b81', 22);
            burst(pxc, pyc, 14, '#ff6b81', 3);
        } else {
            score += 5;
            SFX.gold();
            floatText(pxc, pyc - 30, '+5', '#ffe95c', 20);
            burst(pxc, pyc, 14, '#ff6b81', 3);
        }
        updateHUD();
        return;
    }

    combo++;
    if (combo > bestCombo) { bestCombo = combo; saveBest(); }
    mult = Math.min(5, 1 + Math.floor(combo / 4));
    const gained = def.v * mult;
    score += gained;

    if (def.v >= 8) SFX.gold(); else if (def.v >= 3) SFX.gem(); else SFX.catch(combo);

    floatText(pxc, pyc - 30, '+' + gained, def.color, def.v >= 8 ? 26 : 20);
    if (mult > 1) floatText(pxc, pyc - 52, 'x' + mult, '#fff', 14);
    burst(pxc, pyc, def.v >= 8 ? 20 : (def.v >= 3 ? 14 : 9), def.color, def.v >= 8 ? 4 : 3);

    // Level up
    const newLevel = 1 + Math.floor(score / 25);
    if (newLevel > level) {
        level = newLevel;
        SFX.level();
        flashLevel();
        burst(player.x + player.w / 2, player.y, 30, '#7df9ff', 5);
    }
    updateHUD();
}

function breakCombo(sound = true) {
    if (combo >= 4 && sound) SFX.miss();
    combo = 0; mult = 1;
}

// ---------- Particles / texts update ----------
function updateFx(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vy += 0.08 * dt * 60;
        p.vx *= 0.96;
    }
    for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i];
        t.life -= dt * 0.9;
        t.y -= dt * 40;
        if (t.life <= 0) texts.splice(i, 1);
    }
    if (shake > 0) shake -= dt * 30;
}

// ---------- Draw ----------
function draw() {
    const w = gameCanvas.width / (devicePixelRatio || 1);
    const h = gameCanvas.height / (devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // --- Items ---
    for (const it of items) {
        const def = ITEM_DEFS[it.type];
        const pulse = 1 + 0.08 * Math.sin(it.t * 6);
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot);

        // Glow
        ctx.shadowColor = def.glow;
        ctx.shadowBlur = 18;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(0, 0, it.r * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Inner detail
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(-it.r * 0.25, -it.r * 0.25, it.r * 0.28, 0, Math.PI * 2);
        ctx.fill();

        if (def.v >= 8) {
            ctx.strokeStyle = '#fff59d';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, it.r + 5 + Math.sin(it.t * 8) * 3, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (def.heal) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('♥', 0, 1);
        }
        ctx.restore();
    }

    // --- Player ship ---
    if (player && gameActive) {
        const bob = Math.sin(performance.now() / 400) * 3;
        const tilt = Math.max(-0.35, Math.min(0.35, (player.vx || 0) * 0.09));
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2 + bob;

        // Engine glow
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const eg = ctx.createRadialGradient(px, player.y + player.h - 6, 2, px, player.y + player.h - 6, 26);
        eg.addColorStop(0, 'rgba(255,180,80,0.9)');
        eg.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = eg;
        ctx.fillRect(px - 30, player.y + player.h - 30, 60, 34);
        ctx.restore();

        // Blink while invulnerable
        if (invuln <= 0 || Math.floor(performance.now() / 90) % 2 === 0) {
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(tilt);
            ctx.shadowColor = CHARS[selected].glow;
            ctx.shadowBlur = 22;
            ctx.drawImage(player.img, -player.w / 2, -player.h / 2, player.w, player.h);
            ctx.restore();
        }

        // Hit circle debug-free: draw soft ring
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(125,249,255,0.12)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, player.hitR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // --- Particles ---
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
        const a = Math.max(0, p.life / p.max);
        ctx.globalAlpha = a;
        if (p.ghost) {
            ctx.drawImage(player.img, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        } else {
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();

    // --- Floating texts ---
    for (const t of texts) {
        ctx.globalAlpha = Math.max(0, t.life);
        ctx.fillStyle = t.color;
        ctx.font = '900 ' + t.size + 'px Orbitron, Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 12;
        ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
}

// ---------- HUD ----------
function updateHUD() {
    $('score').textContent = score;
    $('level').textContent = 'LV ' + level;
    $('high').textContent = 'BEST ' + Math.max(best, score);
    // Lives
    const livesEl = $('lives');
    let html = '';
    for (let i = 0; i < MAX_LIVES; i++) {
        html += '<span class="life' + (i < lives ? '' : ' lost') + '">♥</span>';
    }
    livesEl.innerHTML = html;
    // Combo
    const comboEl = $('combo');
    if (mult > 1) {
        comboEl.textContent = 'x' + mult + ' COMBO';
        comboEl.classList.remove('hidden');
        if (mult !== comboEl._lastMult) {
            comboEl._lastMult = mult;
            comboEl.style.animation = 'none';
            void comboEl.offsetWidth;
            comboEl.style.animation = '';
        }
    } else {
        comboEl.classList.add('hidden');
        comboEl._lastMult = 0;
    }
}
function updateDashBar(f) {
    $('dash-bar').style.setProperty('--dash', Math.round(f * 100) + '%');
}
function flashLevel() {
    const el = $('level-flash');
    el.textContent = 'LEVEL ' + level;
    el.classList.remove('hidden');
    void el.offsetWidth; // restart CSS animation
    clearTimeout(flashLevel._t);
    flashLevel._t = setTimeout(() => el.classList.add('hidden'), 1200);
}

// ---------- Game over ----------
function endGame() {
    gameActive = false;
    cancelAnimationFrame(rafId);
    const newBest = score > best;
    if (newBest) {
        best = score;
        saveBest();
    }
    $('final-score').textContent = score;
    $('new-best').classList.toggle('hidden', !newBest);
    $('final-stats').textContent = 'Level ' + level + '   ·   Best Combo x' + Math.max(bestCombo, combo);
    $('game-over').classList.remove('hidden');
    SFX.over();
}

// ---------- Main loop ----------
function gameLoop(now) {
    if (!gameActive) return;
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    dt = Math.min(dt, 0.05);

    if (paused) {
        rafId = requestAnimationFrame(gameLoop);
        return;
    }

    // Spawn
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        spawnItem();
        // Occasionally double-spawn at higher levels
        if (level >= 3 && Math.random() < 0.35) spawnItem();
        spawnTimer = spawnInterval() / 1000;
    }

    updatePlayer(dt);
    updateItems(dt);
    updateFx(dt);
    draw();
    updateHUD();

    rafId = requestAnimationFrame(gameLoop);
}

// ---------- Background loop (always running) ----------
function bgLoop(now) {
    const dt = Math.min((now - (bgLoop.last || now)) / 1000, 0.05);
    bgLoop.last = now;
    drawBg(dt, gameActive ? 2.2 : 1);
    bgRafId = requestAnimationFrame(bgLoop);
}

// ---------- Init ----------
window.addEventListener('resize', () => {
    initBg();
    if (gameActive) resizeGame();
});
window.addEventListener('load', () => {
    initBg();
    loadImages();
    loadBest();
    bgRafId = requestAnimationFrame(bgLoop);
});
