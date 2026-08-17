// Star Catcher Game

let selectedCharacter = null;
let canvas, ctx;
let player = { x: 0, y: 0, width: 60, height: 20, speed: 8, color: '#fff' };
let stars = [];
let score = 0;
let gameActive = false;
let animationFrameId;
const starRadius = 15;
const starSpeed = 3;
const spawnInterval = 800; // ms
let lastSpawn = 0;

// Character colors mapping
const charColors = {
    explorer: '#4fc3f7',
    scout: '#81c784',
    pilot: '#ffb74d'
};

document.addEventListener('DOMContentLoaded', () => {
    const optionEls = document.querySelectorAll('.option');
    const startBtn = document.getElementById('startBtn');
    
    optionEls.forEach(option => {
        option.addEventListener('click', () => {
            // Deselect all
            optionEls.forEach(opt => opt.classList.remove('selected'));
            // Select this
            option.classList.add('selected');
            selectedCharacter = option.dataset.char;
            player.color = charColors[selectedCharacter] || '#fff';
            startBtn.disabled = false;
        });
    });
    
    startBtn.addEventListener('click', startGame);
});

function startGame() {
    document.getElementById('character-select').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    // Setup canvas
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Position player at bottom center
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - player.height - 10;
    
    // Keyboard controls
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Start game loop
    gameActive = true;
    score = 0;
    stars = [];
    lastSpawn = performance.now();
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    canvas.width = window.innerWidth * 0.9;
    canvas.height = window.innerHeight * 0.8;
    // Max dimensions
    if (canvas.width > 800) canvas.width = 800;
    if (canvas.height > 600) canvas.height = 600;
    // Reposition player if needed
    if (player) {
        player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
        player.y = canvas.height - player.height - 10;
    }
}

let keys = { ArrowLeft: false, ArrowRight: false };
function handleKeyDown(e) {
    if (e.key === 'ArrowLeft') keys.ArrowLeft = true;
    if (e.key === 'ArrowRight') keys.ArrowRight = true;
}
function handleKeyUp(e) {
    if (e.key === 'ArrowLeft') keys.ArrowLeft = false;
    if (e.key === 'ArrowRight') keys.ArrowRight = false;
}

function updatePlayer() {
    if (keys.ArrowLeft) player.x -= player.speed;
    if (keys.ArrowRight) player.x += player.speed;
    // Keep within bounds
    if (player.x < 0) player.x = 0;
    if (player.x > canvas.width - player.width) player.x = canvas.width - player.width;
}

function spawnStar(timestamp) {
    if (timestamp - lastSpawn > spawnInterval) {
        const x = Math.random() * (canvas.width - starRadius * 2) + starRadius;
        stars.push({ x, y: -starRadius, vx: (Math.random() - 0.5) * 2, vy: starSpeed });
        lastSpawn = timestamp;
    }
}

function updateStars() {
    for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.y += s.vy;
        s.x += s.vx;
        
        // Bounce off walls
        if (s.x < starRadius || s.x > canvas.width - starRadius) {
            s.vx = -s.vx;
        }
        
        // Check collision with player
        if (
            s.y + starRadius > player.y &&
            s.y - starRadius < player.y + player.height &&
            s.x + starRadius > player.x &&
            s.x - starRadius < player.x + player.width
        ) {
            score++;
            stars.splice(i, 1);
            continue;
        }
        
        // Remove if off screen bottom
        if (s.y > canvas.height + starRadius) {
            stars.splice(i, 1);
        }
    }
}

function draw() {
    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw stars
    ctx.fillStyle = '#fff';
    for (const s of stars) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, starRadius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw player
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // Optional: draw character icon
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.fillText(selectedCharacter.charAt(0).toUpperCase() + selectedCharacter.slice(1), player.x + player.width/2 - 10, player.y - 5);
}

function gameLoop(timestamp) {
    if (!gameActive) return;
    
    updatePlayer();
    spawnStar(timestamp);
    updateStars();
    draw();
    
    // Update score display
    document.getElementById('score').textContent = `Score: ${score}`;
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

// Stop game (if needed)
function stopGame() {
    gameActive = false;
    cancelAnimationFrame(animationFrameId);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('resize', resizeCanvas);
}