const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Increase canvas size for better experience
canvas.width = 1000;
canvas.height = 700;

// Game state
let gameState = {
    score: 0,
    coins: 0,
    lives: 3,
    gameOver: false,
    levelComplete: false
};

// Camera
const camera = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    smoothing: 0.1
};

// Player object with improved physics
const player = {
    x: 200,
    y: 400,
    width: 32,
    height: 32,
    velX: 0,
    velY: 0,
    acceleration: 0.8,
    maxSpeed: 6,
    jumpPower: 13,
    grounded: false,
    direction: 1,
    rotation: 0,
    targetRotation: 0,

    // Game feel additions
    coyoteTime: 0,
    maxCoyoteTime: 8,
    jumpBuffer: 0,
    maxJumpBuffer: 8,
    squashStretch: 1,
    currentPlanet: null,
    onLaunchStar: false
};

// Controls
const keys = {
    left: false,
    right: false,
    up: false,
    space: false
};

// Physics constants - tuned for feel
const airControl = 0.6;
const friction = 0.85;
const airFriction = 0.95;

// Particles system
const particles = [];
const stars = [];
const nebulaClouds = [];

// Create background stars
for (let i = 0; i < 200; i++) {
    stars.push({
        x: Math.random() * 3000,
        y: Math.random() * 1000,
        size: Math.random() * 2 + 0.5,
        brightness: Math.random(),
        twinkleSpeed: Math.random() * 0.02 + 0.01,
        parallax: Math.random() * 0.3 + 0.1
    });
}

// Create nebula clouds
for (let i = 0; i < 15; i++) {
    nebulaClouds.push({
        x: Math.random() * 3000,
        y: Math.random() * 800,
        size: Math.random() * 200 + 100,
        hue: Math.random() * 60 + 200,
        parallax: Math.random() * 0.15
    });
}

// Planets - circular gravity wells
const planets = [
    {
        x: 300, y: 500, radius: 120,
        color: '#4a90e2', gravityRadius: 250, gravityStrength: 0.4,
        platforms: [
            { angle: 0, length: 100, offset: 0 },
            { angle: 2.5, length: 80, offset: 0 }
        ]
    },
    {
        x: 800, y: 300, radius: 90,
        color: '#e74c3c', gravityRadius: 200, gravityStrength: 0.35,
        platforms: [
            { angle: 1, length: 70, offset: 0 },
            { angle: 4, length: 90, offset: 0 }
        ]
    },
    {
        x: 1300, y: 550, radius: 150,
        color: '#9b59b6', gravityRadius: 300, gravityStrength: 0.45,
        platforms: [
            { angle: 0.5, length: 120, offset: 0 },
            { angle: 3, length: 100, offset: 0 },
            { angle: 5, length: 80, offset: 0 }
        ]
    },
    {
        x: 1800, y: 250, radius: 100,
        color: '#f39c12', gravityRadius: 220, gravityStrength: 0.38,
        platforms: [
            { angle: 2, length: 90, offset: 0 }
        ]
    },
    {
        x: 2300, y: 500, radius: 130,
        color: '#1abc9c', gravityRadius: 270, gravityStrength: 0.42,
        platforms: [
            { angle: 1.5, length: 110, offset: 0 },
            { angle: 4.5, length: 95, offset: 0 }
        ]
    }
];

// Launch Stars - transport between planets
const launchStars = [
    { x: 450, y: 350, radius: 20, targetX: 800, targetY: 200, active: true },
    { x: 900, y: 200, radius: 20, targetX: 1300, targetY: 450, active: true },
    { x: 1450, y: 450, radius: 20, targetX: 1800, targetY: 150, active: true },
    { x: 1900, y: 150, radius: 20, targetX: 2300, targetY: 400, active: true }
];

// Star Bits (coins)
const starBits = [];
for (let i = 0; i < 30; i++) {
    const planetIndex = Math.floor(Math.random() * planets.length);
    const planet = planets[planetIndex];
    const angle = Math.random() * Math.PI * 2;
    const distance = planet.radius + 60 + Math.random() * 40;
    starBits.push({
        x: planet.x + Math.cos(angle) * distance,
        y: planet.y + Math.sin(angle) * distance,
        size: 8,
        collected: false,
        hue: Math.random() * 60 + 40
    });
}

// Enemies on planets
const enemies = [];
planets.forEach((planet, index) => {
    if (index > 0 && index < planets.length - 1) {
        for (let i = 0; i < 2; i++) {
            enemies.push({
                x: planet.x + (i - 0.5) * 80,
                y: planet.y - planet.radius - 30,
                width: 30,
                height: 30,
                velX: 2,
                alive: true,
                planet: planet,
                angle: Math.random() * Math.PI * 2,
                speed: 0.02
            });
        }
    }
});

// Goal - Grand Star
const goal = {
    x: 2450,
    y: 500,
    radius: 40,
    pulsePhase: 0
};

// Event listeners
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'ArrowUp') keys.up = true;
    if (e.key === ' ') keys.space = true;
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'ArrowUp') keys.up = false;
    if (e.key === ' ') keys.space = false;
});

document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('restartFromGameOver').addEventListener('click', restartGame);
document.getElementById('restartFromComplete').addEventListener('click', restartGame);

function restartGame() {
    // Reset player
    player.x = 200;
    player.y = 400;
    player.velX = 0;
    player.velY = 0;
    player.grounded = false;
    player.rotation = 0;
    player.currentPlanet = null;

    // Reset camera
    camera.x = 0;
    camera.y = 0;

    // Reset game state
    gameState.score = 0;
    gameState.coins = 0;
    gameState.lives = 3;
    gameState.gameOver = false;
    gameState.levelComplete = false;

    // Reset star bits
    starBits.forEach(bit => bit.collected = false);

    // Reset launch stars
    launchStars.forEach(star => star.active = true);

    // Reset enemies
    enemies.forEach(enemy => {
        enemy.alive = true;
        enemy.angle = Math.random() * Math.PI * 2;
    });

    // Clear particles
    particles.length = 0;

    // Hide overlays
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('levelComplete').classList.add('hidden');

    updateUI();
}

function updateUI() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('coins').textContent = gameState.coins;
    document.getElementById('lives').textContent = gameState.lives;
}

// Apply planetary gravity
function applyPlanetaryGravity() {
    let strongestGravity = { x: 0, y: 0, strength: 0, planet: null };

    planets.forEach(planet => {
        const dx = planet.x - player.x;
        const dy = planet.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < planet.gravityRadius) {
            const strength = planet.gravityStrength * (1 - dist / planet.gravityRadius);
            if (strength > strongestGravity.strength) {
                strongestGravity = { x: dx, y: dy, strength, planet, dist };
            }
        }
    });

    if (strongestGravity.strength > 0) {
        const angle = Math.atan2(strongestGravity.y, strongestGravity.x);
        player.velX += Math.cos(angle) * strongestGravity.strength;
        player.velY += Math.sin(angle) * strongestGravity.strength;
        player.targetRotation = angle + Math.PI / 2;
        player.currentPlanet = strongestGravity.planet;

        // Check if on planet surface
        if (strongestGravity.dist <= strongestGravity.planet.radius + player.height / 2 + 5) {
            player.grounded = true;
            player.coyoteTime = player.maxCoyoteTime;

            // Squash effect on landing
            if (Math.abs(player.velY) > 3) {
                player.squashStretch = 0.7;
                createLandingParticles();
            }
        }
    }
}

// Update player with improved physics
function updatePlayer() {
    if (gameState.gameOver || gameState.levelComplete) return;

    // Jump buffering - remember jump press
    if ((keys.up || keys.space)) {
        player.jumpBuffer = player.maxJumpBuffer;
    }

    if (player.jumpBuffer > 0) player.jumpBuffer--;
    if (player.coyoteTime > 0) player.coyoteTime--;

    // Improved horizontal movement with acceleration
    const isGrounded = player.grounded || player.coyoteTime > 0;
    const controlPower = isGrounded ? 1 : airControl;

    if (keys.left) {
        player.velX -= player.acceleration * controlPower;
        player.direction = -1;
    } else if (keys.right) {
        player.velX += player.acceleration * controlPower;
        player.direction = 1;
    }

    // Apply friction
    const currentFriction = isGrounded ? friction : airFriction;
    player.velX *= currentFriction;

    // Clamp speed
    player.velX = Math.max(-player.maxSpeed, Math.min(player.maxSpeed, player.velX));

    // Coyote time jumping - can jump shortly after leaving platform
    if (player.jumpBuffer > 0 && player.coyoteTime > 0) {
        player.velY = -player.jumpPower;
        player.jumpBuffer = 0;
        player.coyoteTime = 0;
        player.squashStretch = 1.3;
        createJumpParticles();
    }

    // Variable jump height - release jump early for shorter jump
    if (!keys.up && !keys.space && player.velY < 0) {
        player.velY *= 0.85;
    }

    // Apply planetary gravity
    applyPlanetaryGravity();

    // Update position
    player.x += player.velX;
    player.y += player.velY;

    // Smooth rotation towards gravity direction
    const rotDiff = player.targetRotation - player.rotation;
    const shortestAngle = Math.atan2(Math.sin(rotDiff), Math.cos(rotDiff));
    player.rotation += shortestAngle * 0.15;

    // Squash and stretch recovery
    player.squashStretch += (1 - player.squashStretch) * 0.2;

    // Reset grounded each frame (will be set by gravity check)
    const wasGrounded = player.grounded;
    player.grounded = false;

    // If was grounded last frame but not this frame, start coyote time
    if (wasGrounded && !player.grounded && player.coyoteTime === 0) {
        player.coyoteTime = player.maxCoyoteTime;
    }

    // Check if fell too far
    if (player.y > 900 || player.y < -200) {
        gameState.lives--;
        if (gameState.lives <= 0) {
            endGame();
        } else {
            resetPlayerPosition();
        }
    }
}

function resetPlayerPosition() {
    player.x = 200;
    player.y = 400;
    player.velX = 0;
    player.velY = 0;
    player.rotation = 0;
    updateUI();
}

// Particle creation
function createParticle(x, y, velX, velY, color, life) {
    particles.push({ x, y, velX, velY, color, life, maxLife: life, size: 4 });
}

function createJumpParticles() {
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1;
        createParticle(
            player.x + player.width / 2,
            player.y + player.height,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            '#ffffff',
            30
        );
    }
}

function createLandingParticles() {
    for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI - Math.PI / 2;
        const speed = Math.random() * 3 + 2;
        createParticle(
            player.x + player.width / 2,
            player.y + player.height,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            '#87ceeb',
            25
        );
    }
}

function createCollectParticles(x, y, color) {
    for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        createParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 40);
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.velX;
        p.y += p.velY;
        p.velX *= 0.95;
        p.velY *= 0.95;
        p.life--;

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Check star bit collection
function checkStarBits() {
    starBits.forEach(bit => {
        if (bit.collected) return;

        const dx = player.x - bit.x;
        const dy = player.y - bit.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 25) {
            bit.collected = true;
            gameState.coins++;
            gameState.score += 50;
            createCollectParticles(bit.x, bit.y, `hsl(${bit.hue}, 100%, 60%)`);
            updateUI();
        }
    });
}

// Check launch stars
function checkLaunchStars() {
    launchStars.forEach(star => {
        if (!star.active) return;

        const dx = player.x - star.x;
        const dy = player.y - star.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < star.radius + 20) {
            // Launch player to target
            const targetDx = star.targetX - player.x;
            const targetDy = star.targetY - player.y;
            const targetDist = Math.sqrt(targetDx * targetDx + targetDy * targetDy);
            const launchSpeed = 15;

            player.velX = (targetDx / targetDist) * launchSpeed;
            player.velY = (targetDy / targetDist) * launchSpeed;

            createCollectParticles(star.x, star.y, '#ffff00');
            gameState.score += 100;
            updateUI();
        }
    });
}

// Update enemies
function updateEnemies() {
    enemies.forEach(enemy => {
        if (!enemy.alive) return;

        // Move enemy around its planet
        if (enemy.planet) {
            enemy.angle += enemy.speed;
            const dist = enemy.planet.radius + enemy.height / 2 + 5;
            enemy.x = enemy.planet.x + Math.cos(enemy.angle) * dist;
            enemy.y = enemy.planet.y + Math.sin(enemy.angle) * dist;
        }

        // Check collision with player
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < (player.width + enemy.width) / 2) {
            // Jump on enemy
            const playerToEnemy = Math.atan2(dy, dx);
            const playerVelAngle = Math.atan2(player.velY, player.velX);
            const approachingFromAbove = Math.abs(playerToEnemy - playerVelAngle) < Math.PI / 3;

            if (approachingFromAbove && player.velY > 0) {
                enemy.alive = false;
                player.velY = -8;
                gameState.score += 200;
                createCollectParticles(enemy.x, enemy.y, '#8B4513');
                updateUI();
            } else {
                // Hit by enemy
                gameState.lives--;
                if (gameState.lives <= 0) {
                    endGame();
                } else {
                    resetPlayerPosition();
                }
            }
        }
    });
}

// Update camera with smooth following
function updateCamera() {
    camera.targetX = player.x - canvas.width / 2;
    camera.targetY = player.y - canvas.height / 2;

    camera.x += (camera.targetX - camera.x) * camera.smoothing;
    camera.y += (camera.targetY - camera.y) * camera.smoothing;

    // Clamp camera to level bounds
    camera.x = Math.max(0, Math.min(camera.x, 2800 - canvas.width));
    camera.y = Math.max(-100, Math.min(camera.y, 900 - canvas.height));
}

// Check goal
function checkGoal() {
    const dx = player.x - goal.x;
    const dy = player.y - goal.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < goal.radius + player.width / 2) {
        gameState.levelComplete = true;
        document.getElementById('completeScore').textContent = gameState.score;
        document.getElementById('levelComplete').classList.remove('hidden');
    }
}

function endGame() {
    gameState.gameOver = true;
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('gameOver').classList.remove('hidden');
}

// === DRAWING FUNCTIONS ===

function drawBackground() {
    // Space gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0a0a1f');
    gradient.addColorStop(0.5, '#1a0a2e');
    gradient.addColorStop(1, '#0f0520');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw nebula clouds with parallax
    nebulaClouds.forEach(cloud => {
        const x = cloud.x - camera.x * cloud.parallax;
        const y = cloud.y - camera.y * cloud.parallax;

        const nebulaGrad = ctx.createRadialGradient(x, y, 0, x, y, cloud.size);
        nebulaGrad.addColorStop(0, `hsla(${cloud.hue}, 70%, 50%, 0.15)`);
        nebulaGrad.addColorStop(0.5, `hsla(${cloud.hue}, 60%, 40%, 0.08)`);
        nebulaGrad.addColorStop(1, `hsla(${cloud.hue}, 50%, 30%, 0)`);
        ctx.fillStyle = nebulaGrad;
        ctx.fillRect(x - cloud.size, y - cloud.size, cloud.size * 2, cloud.size * 2);
    });

    // Draw stars with parallax and twinkling
    const time = Date.now() * 0.001;
    stars.forEach(star => {
        const x = star.x - camera.x * star.parallax;
        const y = star.y - camera.y * star.parallax;

        star.brightness += star.twinkleSpeed;
        const brightness = (Math.sin(star.brightness) + 1) / 2;

        ctx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.8 + 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawPlanets() {
    planets.forEach(planet => {
        const x = planet.x - camera.x;
        const y = planet.y - camera.y;

        // Planet shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(x + 5, y + 5, planet.radius, 0, Math.PI * 2);
        ctx.fill();

        // Planet glow
        const glowGrad = ctx.createRadialGradient(x, y, planet.radius * 0.7, x, y, planet.radius * 1.3);
        glowGrad.addColorStop(0, planet.color);
        glowGrad.addColorStop(0.7, planet.color);
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, planet.radius * 1.3, 0, Math.PI * 2);
        ctx.fill();

        // Planet body
        ctx.fillStyle = planet.color;
        ctx.beginPath();
        ctx.arc(x, y, planet.radius, 0, Math.PI * 2);
        ctx.fill();

        // Planet highlight
        const highlightGrad = ctx.createRadialGradient(x - planet.radius * 0.3, y - planet.radius * 0.3, 0, x, y, planet.radius);
        highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        highlightGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = highlightGrad;
        ctx.beginPath();
        ctx.arc(x, y, planet.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawLaunchStars() {
    const time = Date.now() * 0.001;

    launchStars.forEach(star => {
        if (!star.active) return;

        const x = star.x - camera.x;
        const y = star.y - camera.y;
        const pulse = Math.sin(time * 3) * 0.3 + 1;

        // Outer glow
        const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, star.radius * pulse * 2);
        glowGrad.addColorStop(0, 'rgba(255, 255, 0, 0.6)');
        glowGrad.addColorStop(0.5, 'rgba(255, 200, 0, 0.3)');
        glowGrad.addColorStop(1, 'rgba(255, 255, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, star.radius * pulse * 2, 0, Math.PI * 2);
        ctx.fill();

        // Star body
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI / 5) - Math.PI / 2 + time;
            const radius = i % 2 === 0 ? star.radius * pulse : star.radius * pulse * 0.5;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    });
}

function drawStarBits() {
    const time = Date.now() * 0.001;

    starBits.forEach(bit => {
        if (bit.collected) return;

        const x = bit.x - camera.x;
        const y = bit.y - camera.y;
        const float = Math.sin(time * 2 + bit.x) * 3;

        // Glow
        const glowGrad = ctx.createRadialGradient(x, y + float, 0, x, y + float, bit.size * 2);
        glowGrad.addColorStop(0, `hsla(${bit.hue}, 100%, 70%, 0.6)`);
        glowGrad.addColorStop(1, `hsla(${bit.hue}, 100%, 50%, 0)`);
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y + float, bit.size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Star bit
        ctx.fillStyle = `hsl(${bit.hue}, 100%, 70%)`;
        ctx.beginPath();
        ctx.arc(x, y + float, bit.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawEnemies() {
    enemies.forEach(enemy => {
        if (!enemy.alive) return;

        const x = enemy.x - camera.x;
        const y = enemy.y - camera.y;

        ctx.save();
        ctx.translate(x + enemy.width / 2, y + enemy.height / 2);
        if (enemy.planet) {
            ctx.rotate(enemy.angle + Math.PI / 2);
        }

        // Goomba body
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(-enemy.width / 2 + 5, -enemy.height / 2 + 8, 8, 8);
        ctx.fillRect(-enemy.width / 2 + 17, -enemy.height / 2 + 8, 8, 8);

        // Pupils
        ctx.fillStyle = '#000';
        ctx.fillRect(-enemy.width / 2 + 8, -enemy.height / 2 + 11, 3, 3);
        ctx.fillRect(-enemy.width / 2 + 20, -enemy.height / 2 + 11, 3, 3);

        ctx.restore();
    });
}

function drawPlayer() {
    const x = player.x - camera.x;
    const y = player.y - camera.y;

    ctx.save();
    ctx.translate(x + player.width / 2, y + player.height / 2);
    ctx.rotate(player.rotation);

    // Apply squash and stretch
    const scaleX = player.direction;
    const scaleY = player.squashStretch;
    ctx.scale(scaleX, scaleY);

    // Draw Mario with glow
    const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, player.width);
    glowGrad.addColorStop(0, 'rgba(231, 76, 60, 0.5)');
    glowGrad.addColorStop(1, 'rgba(231, 76, 60, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(-player.width, -player.height, player.width * 2, player.height * 2);

    // Body
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);

    // Cap
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-player.width / 2 + 5, -player.height / 2, player.width - 10, 10);

    // Face
    ctx.fillStyle = '#f5b7b1';
    ctx.fillRect(-player.width / 2 + 8, -player.height / 2 + 10, player.width - 16, 12);

    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(-player.width / 2 + 10, -player.height / 2 + 12, 3, 3);
    ctx.fillRect(-player.width / 2 + 19, -player.height / 2 + 12, 3, 3);

    // Mustache
    ctx.fillRect(-player.width / 2 + 8, -player.height / 2 + 18, player.width - 16, 4);

    ctx.restore();
}

function drawParticles() {
    particles.forEach(p => {
        const x = p.x - camera.x;
        const y = p.y - camera.y;
        const alpha = p.life / p.maxLife;

        ctx.fillStyle = p.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba').replace('#', 'rgba(');
        if (ctx.fillStyle.indexOf('rgba') === -1) {
            // Fallback for hex colors
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
        }

        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
    });
}

function drawGoal() {
    const x = goal.x - camera.x;
    const y = goal.y - camera.y;
    goal.pulsePhase += 0.05;
    const pulse = Math.sin(goal.pulsePhase) * 0.2 + 1;

    // Grand Star glow
    const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, goal.radius * pulse * 2);
    glowGrad.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
    glowGrad.addColorStop(0.5, 'rgba(255, 165, 0, 0.4)');
    glowGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(x, y, goal.radius * pulse * 2, 0, Math.PI * 2);
    ctx.fill();

    // Grand Star
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI / 5) - Math.PI / 2 + goal.pulsePhase;
        const radius = i % 2 === 0 ? goal.radius * pulse : goal.radius * pulse * 0.5;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Center glow
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, goal.radius * 0.3 * pulse, 0, Math.PI * 2);
    ctx.fill();
}

// Main game loop
function gameLoop() {
    // Update
    updatePlayer();
    updateEnemies();
    updateParticles();
    updateCamera();
    checkStarBits();
    checkLaunchStars();
    checkGoal();

    // Draw
    drawBackground();
    drawPlanets();
    drawLaunchStars();
    drawStarBits();
    drawEnemies();
    drawParticles();
    drawPlayer();
    drawGoal();

    requestAnimationFrame(gameLoop);
}

// Start game
updateUI();
gameLoop();
