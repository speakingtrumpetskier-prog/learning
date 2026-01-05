const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 1200;
canvas.height = 800;

// ============== GAME STATE ==============
let gameState = {
    score: 0,
    coins: 0,
    lives: 3,
    gameOver: false,
    levelComplete: false,
    time: 0
};

// ============== PLAYER ==============
const player = {
    x: 0,
    y: 0,
    radius: 18,
    angle: -Math.PI / 2, // Angle on current planet
    angularVel: 0,
    normalVel: 0, // Velocity away from planet surface
    grounded: false,
    currentPlanet: null,
    inSpace: false,
    spaceVelX: 0,
    spaceVelY: 0,
    facingRight: true,

    // Physics tuning
    runSpeed: 0.045,
    jumpPower: 12,
    gravity: 0.35,

    // Game feel
    coyoteTime: 0,
    jumpBuffer: 0,
    squash: 1,
    stretch: 1,

    // Spin attack
    spinning: false,
    spinTime: 0,
    spinCooldown: 0,
    spinDuration: 25,

    // Launch star
    launching: false,
    launchTime: 0,
    launchStartX: 0,
    launchStartY: 0,
    launchTargetX: 0,
    launchTargetY: 0,

    // Trail
    trail: [],

    // Animation
    walkFrame: 0,
    walkTimer: 0
};

// ============== CONTROLS ==============
const keys = { left: false, right: false, jump: false, spin: false };
let jumpPressed = false;
let spinPressed = false;

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
        keys.jump = true;
        if (!jumpPressed) {
            player.jumpBuffer = 10;
            jumpPressed = true;
        }
    }
    if (e.key === 'z' || e.key === 'x' || e.key === 'Shift') {
        keys.spin = true;
        if (!spinPressed) {
            trySpinAttack();
            spinPressed = true;
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
        keys.jump = false;
        jumpPressed = false;
    }
    if (e.key === 'z' || e.key === 'x' || e.key === 'Shift') {
        keys.spin = false;
        spinPressed = false;
    }
});

// ============== CAMERA ==============
const camera = { x: 0, y: 0, targetX: 0, targetY: 0, shake: 0 };

// ============== PLANETS ==============
const planets = [
    {
        x: 300, y: 500, radius: 100,
        type: 'grass',
        colors: ['#4ade80', '#22c55e', '#16a34a'],
        atmosphere: 'rgba(134, 239, 172, 0.15)',
        hasRing: false,
        features: []
    },
    {
        x: 700, y: 280, radius: 75,
        type: 'ice',
        colors: ['#7dd3fc', '#38bdf8', '#0ea5e9'],
        atmosphere: 'rgba(186, 230, 253, 0.2)',
        hasRing: true,
        ringColor: 'rgba(186, 230, 253, 0.4)',
        features: []
    },
    {
        x: 1100, y: 550, radius: 120,
        type: 'lava',
        colors: ['#fb923c', '#f97316', '#ea580c'],
        atmosphere: 'rgba(254, 215, 170, 0.2)',
        hasRing: false,
        features: [],
        glowColor: '#ff6b35'
    },
    {
        x: 1550, y: 300, radius: 90,
        type: 'crystal',
        colors: ['#c084fc', '#a855f7', '#9333ea'],
        atmosphere: 'rgba(233, 213, 255, 0.25)',
        hasRing: true,
        ringColor: 'rgba(192, 132, 252, 0.5)',
        features: []
    },
    {
        x: 2050, y: 500, radius: 140,
        type: 'star',
        colors: ['#fde047', '#facc15', '#eab308'],
        atmosphere: 'rgba(254, 249, 195, 0.3)',
        hasRing: false,
        features: [],
        glowColor: '#ffd700',
        isGoal: true
    }
];

// Add surface features to planets
planets.forEach(planet => {
    const numFeatures = Math.floor(planet.radius / 15);
    for (let i = 0; i < numFeatures; i++) {
        planet.features.push({
            angle: Math.random() * Math.PI * 2,
            size: Math.random() * 8 + 4,
            type: Math.random() > 0.5 ? 'crater' : 'bump',
            shade: Math.random() * 0.3 - 0.15
        });
    }
});

// ============== LAUNCH STARS ==============
const launchStars = [
    { x: 450, y: 400, targetPlanet: 1, active: true, angle: 0 },
    { x: 850, y: 200, targetPlanet: 2, active: true, angle: 0 },
    { x: 1300, y: 480, targetPlanet: 3, active: true, angle: 0 },
    { x: 1700, y: 220, targetPlanet: 4, active: true, angle: 0 }
];

// ============== STAR BITS ==============
const starBits = [];
function createStarBits() {
    starBits.length = 0;
    planets.forEach((planet, pIndex) => {
        const count = Math.floor(planet.radius / 20) + 3;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
            const dist = planet.radius + 40 + Math.random() * 30;
            starBits.push({
                x: planet.x + Math.cos(angle) * dist,
                y: planet.y + Math.sin(angle) * dist,
                baseX: planet.x + Math.cos(angle) * dist,
                baseY: planet.y + Math.sin(angle) * dist,
                collected: false,
                color: ['#ff6b9d', '#c084fc', '#60a5fa', '#4ade80', '#fbbf24'][Math.floor(Math.random() * 5)],
                phase: Math.random() * Math.PI * 2,
                orbitSpeed: 0.02 + Math.random() * 0.01
            });
        }
    });
}
createStarBits();

// ============== ENEMIES (Goombas that walk on planets) ==============
const enemies = [];
function createEnemies() {
    enemies.length = 0;
    planets.forEach((planet, pIndex) => {
        if (pIndex === 0 || pIndex === planets.length - 1) return;
        const count = pIndex === 2 ? 3 : 2;
        for (let i = 0; i < count; i++) {
            enemies.push({
                planet: planet,
                angle: (i / count) * Math.PI * 2,
                angularSpeed: 0.015 * (Math.random() > 0.5 ? 1 : -1),
                alive: true,
                squash: 1
            });
        }
    });
}
createEnemies();

// ============== PARTICLES ==============
const particles = [];
const cosmicDust = [];
const shootingStars = [];

// Create cosmic dust
for (let i = 0; i < 300; i++) {
    cosmicDust.push({
        x: Math.random() * 3000 - 500,
        y: Math.random() * 1500 - 300,
        size: Math.random() * 2 + 0.5,
        brightness: Math.random(),
        twinkleSpeed: Math.random() * 0.03 + 0.01,
        parallax: Math.random() * 0.5 + 0.1,
        color: Math.random() > 0.8 ?
            ['#fef3c7', '#ddd6fe', '#bfdbfe', '#bbf7d0'][Math.floor(Math.random() * 4)] :
            '#ffffff'
    });
}

// ============== NEBULA CLOUDS ==============
const nebulae = [
    { x: 400, y: 200, size: 300, hue: 280, opacity: 0.08 },
    { x: 1200, y: 600, size: 400, hue: 320, opacity: 0.06 },
    { x: 1800, y: 150, size: 350, hue: 200, opacity: 0.07 },
    { x: 600, y: 700, size: 250, hue: 260, opacity: 0.05 }
];

// ============== HELPER FUNCTIONS ==============
function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function angleLerp(a, b, t) {
    const diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + diff * t;
}

// ============== SPIN ATTACK ==============
function trySpinAttack() {
    if (player.spinCooldown <= 0 && !player.spinning && !player.launching) {
        player.spinning = true;
        player.spinTime = player.spinDuration;
        player.spinCooldown = 40;

        // Small boost if in air
        if (!player.grounded && player.inSpace) {
            const angle = Math.atan2(player.spaceVelY, player.spaceVelX);
            player.spaceVelX += Math.cos(angle) * 2;
            player.spaceVelY += Math.sin(angle) * 2;
        }

        createSpinParticles();
    }
}

function createSpinParticles() {
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        particles.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(angle) * 4,
            vy: Math.sin(angle) * 4,
            life: 20,
            maxLife: 20,
            size: 6,
            color: '#7dd3fc',
            type: 'spin'
        });
    }
}

// ============== PARTICLE CREATION ==============
function createJumpParticles() {
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI - Math.PI;
        particles.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(angle) * (Math.random() * 3 + 1),
            vy: Math.sin(angle) * (Math.random() * 3 + 1),
            life: 25,
            maxLife: 25,
            size: 4,
            color: '#ffffff',
            type: 'jump'
        });
    }
}

function createLandParticles() {
    for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(angle) * (Math.random() * 2 + 1),
            vy: Math.sin(angle) * (Math.random() * 2 + 1),
            life: 20,
            maxLife: 20,
            size: 3,
            color: player.currentPlanet?.colors[0] || '#ffffff',
            type: 'land'
        });
    }
}

function createCollectParticles(x, y, color) {
    for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * (Math.random() * 5 + 3),
            vy: Math.sin(angle) * (Math.random() * 5 + 3),
            life: 35,
            maxLife: 35,
            size: 5,
            color: color,
            type: 'collect'
        });
    }
}

function createStompParticles(x, y) {
    for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * (Math.random() * 6 + 2),
            vy: Math.sin(angle) * (Math.random() * 6 + 2),
            life: 30,
            maxLife: 30,
            size: 6,
            color: '#fbbf24',
            type: 'stomp'
        });
    }
}

// ============== SHOOTING STARS ==============
function maybeCreateShootingStar() {
    if (Math.random() < 0.003 && shootingStars.length < 3) {
        shootingStars.push({
            x: camera.x + Math.random() * canvas.width,
            y: camera.y - 50,
            vx: (Math.random() - 0.3) * 8,
            vy: Math.random() * 6 + 4,
            life: 60,
            trail: []
        });
    }
}

// ============== PHYSICS UPDATE ==============
function updatePlayer() {
    if (gameState.gameOver || gameState.levelComplete) return;

    // Update timers
    if (player.jumpBuffer > 0) player.jumpBuffer--;
    if (player.coyoteTime > 0) player.coyoteTime--;
    if (player.spinCooldown > 0) player.spinCooldown--;
    if (player.spinning) {
        player.spinTime--;
        if (player.spinTime <= 0) player.spinning = false;
    }

    // Update trail
    player.trail.unshift({ x: player.x, y: player.y, age: 0 });
    if (player.trail.length > 15) player.trail.pop();
    player.trail.forEach(t => t.age++);

    // Handle launching
    if (player.launching) {
        updateLaunch();
        return;
    }

    // Find nearest planet
    let nearestPlanet = null;
    let nearestDist = Infinity;

    planets.forEach(planet => {
        const d = dist(player.x, player.y, planet.x, planet.y);
        if (d < planet.radius + 200 && d < nearestDist) {
            nearestDist = d;
            nearestPlanet = planet;
        }
    });

    // Check if on planet surface
    if (nearestPlanet && nearestDist <= nearestPlanet.radius + player.radius + 2) {
        // On planet surface
        if (!player.grounded) {
            player.grounded = true;
            player.squash = 0.6;
            player.stretch = 1.4;
            createLandParticles();
        }
        player.coyoteTime = 8;
        player.inSpace = false;
        player.currentPlanet = nearestPlanet;

        // Calculate angle on planet
        player.angle = Math.atan2(player.y - nearestPlanet.y, player.x - nearestPlanet.x);

        // Movement on planet surface
        const moveDir = keys.right ? 1 : keys.left ? -1 : 0;
        player.angularVel = lerp(player.angularVel, moveDir * player.runSpeed, 0.2);
        player.angularVel *= 0.9; // Friction

        if (moveDir !== 0) {
            player.facingRight = moveDir > 0;
            player.walkTimer++;
            if (player.walkTimer > 8) {
                player.walkTimer = 0;
                player.walkFrame = (player.walkFrame + 1) % 4;
            }
        }

        // Update angle
        player.angle += player.angularVel;

        // Position on surface
        const surfaceDist = nearestPlanet.radius + player.radius;
        player.x = nearestPlanet.x + Math.cos(player.angle) * surfaceDist;
        player.y = nearestPlanet.y + Math.sin(player.angle) * surfaceDist;

        // Reset space velocity
        player.spaceVelX = 0;
        player.spaceVelY = 0;
        player.normalVel = 0;

        // Jump
        if (player.jumpBuffer > 0 && player.coyoteTime > 0) {
            player.normalVel = player.jumpPower;
            player.grounded = false;
            player.jumpBuffer = 0;
            player.coyoteTime = 0;
            player.squash = 1.3;
            player.stretch = 0.7;
            createJumpParticles();

            // Convert to space velocity
            const outAngle = player.angle;
            player.spaceVelX = Math.cos(outAngle) * player.normalVel + Math.cos(outAngle + Math.PI/2) * player.angularVel * nearestPlanet.radius * 0.5;
            player.spaceVelY = Math.sin(outAngle) * player.normalVel + Math.sin(outAngle + Math.PI/2) * player.angularVel * nearestPlanet.radius * 0.5;
            player.inSpace = true;
        }
    } else {
        // In space
        player.grounded = false;
        player.inSpace = true;

        // Air control
        if (keys.left) player.spaceVelX -= 0.15;
        if (keys.right) player.spaceVelX += 0.15;

        // Apply gravity from nearest planet
        if (nearestPlanet) {
            const dx = nearestPlanet.x - player.x;
            const dy = nearestPlanet.y - player.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const gravityStrength = (nearestPlanet.radius / 100) * player.gravity;
            player.spaceVelX += (dx / d) * gravityStrength;
            player.spaceVelY += (dy / d) * gravityStrength;
        }

        // Variable jump height
        if (!keys.jump && player.spaceVelY < 0) {
            player.spaceVelY *= 0.9;
        }

        // Update position
        player.x += player.spaceVelX;
        player.y += player.spaceVelY;

        // Update facing direction based on velocity
        if (Math.abs(player.spaceVelX) > 0.5) {
            player.facingRight = player.spaceVelX > 0;
        }
    }

    // Squash/stretch recovery
    player.squash = lerp(player.squash, 1, 0.15);
    player.stretch = lerp(player.stretch, 1, 0.15);

    // Check boundaries
    if (player.y > 1000 || player.y < -300 || player.x < -200 || player.x > 2500) {
        loseLife();
    }
}

function updateLaunch() {
    player.launchTime++;
    const t = Math.min(player.launchTime / 50, 1);
    const easeT = 1 - Math.pow(1 - t, 3); // Ease out cubic

    // Arc trajectory
    const midX = (player.launchStartX + player.launchTargetX) / 2;
    const midY = Math.min(player.launchStartY, player.launchTargetY) - 150;

    // Quadratic bezier
    const t1 = 1 - easeT;
    player.x = t1 * t1 * player.launchStartX + 2 * t1 * easeT * midX + easeT * easeT * player.launchTargetX;
    player.y = t1 * t1 * player.launchStartY + 2 * t1 * easeT * midY + easeT * easeT * player.launchTargetY;

    // Create trail particles
    if (player.launchTime % 2 === 0) {
        particles.push({
            x: player.x,
            y: player.y,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 30,
            maxLife: 30,
            size: 8,
            color: '#fde047',
            type: 'launch'
        });
    }

    if (t >= 1) {
        player.launching = false;
        player.spaceVelX = 0;
        player.spaceVelY = 0;
        player.inSpace = true;
    }
}

function loseLife() {
    gameState.lives--;
    updateUI();

    if (gameState.lives <= 0) {
        gameState.gameOver = true;
        document.getElementById('finalScore').textContent = gameState.score;
        document.getElementById('gameOver').classList.remove('hidden');
    } else {
        // Respawn
        const spawnPlanet = planets[0];
        player.currentPlanet = spawnPlanet;
        player.angle = -Math.PI / 2;
        player.x = spawnPlanet.x + Math.cos(player.angle) * (spawnPlanet.radius + player.radius);
        player.y = spawnPlanet.y + Math.sin(player.angle) * (spawnPlanet.radius + player.radius);
        player.spaceVelX = 0;
        player.spaceVelY = 0;
        player.angularVel = 0;
        player.grounded = true;
        player.inSpace = false;
        camera.shake = 15;
    }
}

// ============== COLLISIONS ==============
function checkCollisions() {
    // Star bits
    starBits.forEach(bit => {
        if (bit.collected) return;
        const d = dist(player.x, player.y, bit.x, bit.y);
        if (d < player.radius + 15) {
            bit.collected = true;
            gameState.coins++;
            gameState.score += 50;
            createCollectParticles(bit.x, bit.y, bit.color);
            updateUI();
        }
    });

    // Launch stars
    launchStars.forEach(star => {
        if (!star.active || player.launching) return;
        const d = dist(player.x, player.y, star.x, star.y);
        if (d < 35) {
            const targetPlanet = planets[star.targetPlanet];
            player.launching = true;
            player.launchTime = 0;
            player.launchStartX = player.x;
            player.launchStartY = player.y;
            player.launchTargetX = targetPlanet.x;
            player.launchTargetY = targetPlanet.y - targetPlanet.radius - 50;
            player.grounded = false;
            gameState.score += 100;
            createCollectParticles(star.x, star.y, '#fde047');
            updateUI();
        }
    });

    // Enemies
    enemies.forEach(enemy => {
        if (!enemy.alive) return;
        const ex = enemy.planet.x + Math.cos(enemy.angle) * (enemy.planet.radius + 15);
        const ey = enemy.planet.y + Math.sin(enemy.angle) * (enemy.planet.radius + 15);
        const d = dist(player.x, player.y, ex, ey);

        if (d < player.radius + 15) {
            // Check if stomping (player above enemy relative to planet)
            const playerToPlanet = Math.atan2(player.y - enemy.planet.y, player.x - enemy.planet.x);
            const playerApproachAngle = Math.atan2(player.spaceVelY, player.spaceVelX);
            const towardPlanet = Math.abs(angleDiff(playerApproachAngle, playerToPlanet)) < Math.PI / 2;

            if ((player.inSpace && towardPlanet && !player.grounded) || player.spinning) {
                // Stomp or spin kill
                enemy.alive = false;
                enemy.squash = 0.2;
                gameState.score += 200;
                createStompParticles(ex, ey);

                // Bounce
                if (!player.spinning) {
                    player.spaceVelY = -10;
                }
                updateUI();
            } else if (!player.spinning) {
                // Take damage
                loseLife();
            }
        }
    });

    // Goal (final planet)
    const goalPlanet = planets[planets.length - 1];
    if (player.currentPlanet === goalPlanet && player.grounded) {
        gameState.levelComplete = true;
        document.getElementById('completeScore').textContent = gameState.score;
        document.getElementById('levelComplete').classList.remove('hidden');
    }
}

function angleDiff(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

// ============== UPDATE ENTITIES ==============
function updateEnemies() {
    enemies.forEach(enemy => {
        if (!enemy.alive) {
            enemy.squash = lerp(enemy.squash, 0, 0.1);
            return;
        }
        enemy.angle += enemy.angularSpeed;
    });
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // Shooting stars
    maybeCreateShootingStar();
    for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.trail.unshift({ x: s.x, y: s.y });
        if (s.trail.length > 20) s.trail.pop();
        s.x += s.vx;
        s.y += s.vy;
        s.life--;
        if (s.life <= 0) shootingStars.splice(i, 1);
    }
}

function updateCamera() {
    camera.targetX = player.x - canvas.width / 2;
    camera.targetY = player.y - canvas.height / 2;
    camera.x = lerp(camera.x, camera.targetX, 0.08);
    camera.y = lerp(camera.y, camera.targetY, 0.08);

    // Clamp
    camera.x = Math.max(-100, Math.min(camera.x, 1700));
    camera.y = Math.max(-200, Math.min(camera.y, 400));

    // Shake
    if (camera.shake > 0) camera.shake *= 0.9;
}

function updateStarBits() {
    gameState.time += 0.02;
    starBits.forEach(bit => {
        if (bit.collected) return;
        bit.x = bit.baseX + Math.sin(gameState.time * 2 + bit.phase) * 5;
        bit.y = bit.baseY + Math.cos(gameState.time * 2 + bit.phase) * 5;
    });
}

// ============== DRAWING ==============
function drawBackground() {
    // Deep space gradient
    const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width
    );
    gradient.addColorStop(0, '#1a1a3e');
    gradient.addColorStop(0.5, '#0f0f2d');
    gradient.addColorStop(1, '#050510');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Nebulae
    nebulae.forEach(neb => {
        const x = neb.x - camera.x * 0.1;
        const y = neb.y - camera.y * 0.1;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, neb.size);
        grad.addColorStop(0, `hsla(${neb.hue}, 70%, 50%, ${neb.opacity})`);
        grad.addColorStop(0.5, `hsla(${neb.hue}, 60%, 40%, ${neb.opacity * 0.5})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(x - neb.size, y - neb.size, neb.size * 2, neb.size * 2);
    });

    // Stars
    cosmicDust.forEach(star => {
        const x = star.x - camera.x * star.parallax;
        const y = star.y - camera.y * star.parallax;
        if (x < -10 || x > canvas.width + 10 || y < -10 || y > canvas.height + 10) return;

        const twinkle = (Math.sin(gameState.time * star.twinkleSpeed * 50 + star.brightness * 10) + 1) / 2;
        const alpha = 0.3 + twinkle * 0.7;

        ctx.fillStyle = star.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Glow on bright stars
        if (star.size > 1.5) {
            ctx.globalAlpha = alpha * 0.3;
            ctx.beginPath();
            ctx.arc(x, y, star.size * 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    });

    // Shooting stars
    shootingStars.forEach(star => {
        const x = star.x - camera.x * 0.3;
        const y = star.y - camera.y * 0.3;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        star.trail.forEach((t, i) => {
            const tx = t.x - camera.x * 0.3;
            const ty = t.y - camera.y * 0.3;
            ctx.globalAlpha = 1 - i / star.trail.length;
            ctx.lineTo(tx, ty);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
    });
}

function drawPlanets() {
    planets.forEach(planet => {
        const x = planet.x - camera.x;
        const y = planet.y - camera.y;

        // Ring (behind planet)
        if (planet.hasRing) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(1, 0.3);
            ctx.strokeStyle = planet.ringColor;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.arc(0, 0, planet.radius * 1.6, Math.PI, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Atmosphere glow
        const atmosGrad = ctx.createRadialGradient(x, y, planet.radius * 0.8, x, y, planet.radius * 1.4);
        atmosGrad.addColorStop(0, 'transparent');
        atmosGrad.addColorStop(0.5, planet.atmosphere);
        atmosGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = atmosGrad;
        ctx.beginPath();
        ctx.arc(x, y, planet.radius * 1.4, 0, Math.PI * 2);
        ctx.fill();

        // Special glow for lava/star planets
        if (planet.glowColor) {
            const glowGrad = ctx.createRadialGradient(x, y, planet.radius * 0.5, x, y, planet.radius * 2);
            glowGrad.addColorStop(0, planet.glowColor + '40');
            glowGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(x, y, planet.radius * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Planet body
        const bodyGrad = ctx.createRadialGradient(
            x - planet.radius * 0.3, y - planet.radius * 0.3, 0,
            x, y, planet.radius
        );
        bodyGrad.addColorStop(0, planet.colors[0]);
        bodyGrad.addColorStop(0.7, planet.colors[1]);
        bodyGrad.addColorStop(1, planet.colors[2]);
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(x, y, planet.radius, 0, Math.PI * 2);
        ctx.fill();

        // Surface features
        planet.features.forEach(f => {
            const fx = x + Math.cos(f.angle) * (planet.radius - f.size);
            const fy = y + Math.sin(f.angle) * (planet.radius - f.size);
            ctx.fillStyle = f.type === 'crater' ?
                `rgba(0,0,0,${0.15 + f.shade})` :
                `rgba(255,255,255,${0.1 + f.shade})`;
            ctx.beginPath();
            ctx.arc(fx, fy, f.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // Highlight
        const highlightGrad = ctx.createRadialGradient(
            x - planet.radius * 0.4, y - planet.radius * 0.4, 0,
            x - planet.radius * 0.4, y - planet.radius * 0.4, planet.radius * 0.8
        );
        highlightGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
        highlightGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = highlightGrad;
        ctx.beginPath();
        ctx.arc(x, y, planet.radius, 0, Math.PI * 2);
        ctx.fill();

        // Ring (in front of planet)
        if (planet.hasRing) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(1, 0.3);
            ctx.strokeStyle = planet.ringColor;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.arc(0, 0, planet.radius * 1.6, 0, Math.PI);
            ctx.stroke();
            ctx.restore();
        }

        // Goal indicator
        if (planet.isGoal) {
            const pulse = Math.sin(gameState.time * 3) * 0.2 + 1;
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            ctx.arc(x, y, planet.radius + 30 * pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // "GOAL" text
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('★ GOAL ★', x, y - planet.radius - 50);
        }
    });
}

function drawLaunchStars() {
    launchStars.forEach(star => {
        if (!star.active) return;
        const x = star.x - camera.x;
        const y = star.y - camera.y;

        star.angle += 0.05;
        const pulse = Math.sin(gameState.time * 4) * 0.15 + 1;

        // Outer glow
        const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, 50 * pulse);
        glowGrad.addColorStop(0, 'rgba(253, 224, 71, 0.6)');
        glowGrad.addColorStop(0.5, 'rgba(253, 224, 71, 0.2)');
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, 50 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Star shape
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = star.angle + (i * Math.PI * 2 / 5) - Math.PI / 2;
            const r = i % 2 === 0 ? 25 * pulse : 12 * pulse;
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Inner glow
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 8 * pulse, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawStarBits() {
    starBits.forEach(bit => {
        if (bit.collected) return;
        const x = bit.x - camera.x;
        const y = bit.y - camera.y;

        const pulse = Math.sin(gameState.time * 3 + bit.phase) * 0.2 + 1;

        // Glow
        const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, 20);
        glowGrad.addColorStop(0, bit.color + 'aa');
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fill();

        // Crystal shape
        ctx.fillStyle = bit.color;
        ctx.beginPath();
        ctx.moveTo(x, y - 10 * pulse);
        ctx.lineTo(x + 7 * pulse, y);
        ctx.lineTo(x, y + 10 * pulse);
        ctx.lineTo(x - 7 * pulse, y);
        ctx.closePath();
        ctx.fill();

        // Highlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x - 2, y - 3, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawEnemies() {
    enemies.forEach(enemy => {
        if (!enemy.alive && enemy.squash < 0.1) return;

        const ex = enemy.planet.x + Math.cos(enemy.angle) * (enemy.planet.radius + 15);
        const ey = enemy.planet.y + Math.sin(enemy.angle) * (enemy.planet.radius + 15);
        const x = ex - camera.x;
        const y = ey - camera.y;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(enemy.angle + Math.PI / 2);
        ctx.scale(1, enemy.squash);

        // Goomba body
        ctx.fillStyle = '#8b5a2b';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 16, 0, 0, Math.PI * 2);
        ctx.fill();

        // Goomba cap
        ctx.fillStyle = '#5d3a1a';
        ctx.beginPath();
        ctx.ellipse(0, -10, 16, 10, 0, Math.PI, Math.PI * 2);
        ctx.fill();

        if (enemy.alive) {
            // Eyes
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(-5, -2, 5, 6, 0, 0, Math.PI * 2);
            ctx.ellipse(5, -2, 5, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Pupils
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(-4, -1, 2, 0, Math.PI * 2);
            ctx.arc(6, -1, 2, 0, Math.PI * 2);
            ctx.fill();

            // Eyebrows (angry)
            ctx.strokeStyle = '#5d3a1a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-9, -8);
            ctx.lineTo(-2, -5);
            ctx.moveTo(9, -8);
            ctx.lineTo(2, -5);
            ctx.stroke();

            // Feet
            ctx.fillStyle = '#4a3520';
            ctx.beginPath();
            ctx.ellipse(-8, 14, 6, 4, 0, 0, Math.PI * 2);
            ctx.ellipse(8, 14, 6, 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    });
}

function drawPlayer() {
    const x = player.x - camera.x + (Math.random() - 0.5) * camera.shake;
    const y = player.y - camera.y + (Math.random() - 0.5) * camera.shake;

    // Trail
    ctx.globalAlpha = 0.5;
    player.trail.forEach((t, i) => {
        const tx = t.x - camera.x;
        const ty = t.y - camera.y;
        const alpha = (1 - t.age / 15) * 0.3;
        if (alpha <= 0) return;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = player.spinning ? '#7dd3fc' : '#ef4444';
        ctx.beginPath();
        ctx.arc(tx, ty, player.radius * (1 - t.age / 20), 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(x, y);

    // Rotate to face away from planet center
    if (player.currentPlanet && !player.inSpace) {
        ctx.rotate(player.angle + Math.PI / 2);
    } else if (player.inSpace) {
        const vel = Math.atan2(player.spaceVelY, player.spaceVelX);
        ctx.rotate(vel + Math.PI / 2);
    }

    // Flip based on facing
    ctx.scale(player.facingRight ? 1 : -1, 1);
    ctx.scale(player.stretch, player.squash);

    // Spin effect
    if (player.spinning) {
        const spinAngle = (player.spinDuration - player.spinTime) * 0.5;
        ctx.rotate(spinAngle);

        // Spin aura
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, player.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // Glow
    const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, player.radius * 2);
    glowGrad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius * 2, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 2, player.radius - 2, 0, Math.PI * 2);
    ctx.fill();

    // Overalls
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(0, 6, player.radius - 4, 0.3, Math.PI - 0.3);
    ctx.fill();

    // Cap
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.ellipse(0, -10, 14, 8, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Cap brim
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.ellipse(6, -6, 10, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Face
    ctx.fillStyle = '#fcd9b6';
    ctx.beginPath();
    ctx.arc(0, -2, 9, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.ellipse(-3, -4, 2, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(3, -4, 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-2, -5, 1, 0, Math.PI * 2);
    ctx.arc(4, -5, 1, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#f4a460';
    ctx.beginPath();
    ctx.ellipse(0, -1, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mustache
    ctx.fillStyle = '#4a3728';
    ctx.beginPath();
    ctx.ellipse(-4, 2, 5, 3, 0.2, 0, Math.PI * 2);
    ctx.ellipse(4, 2, 5, 3, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // M on cap
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 6px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('M', 0, -10);

    ctx.restore();
}

function drawParticles() {
    particles.forEach(p => {
        const x = p.x - camera.x;
        const y = p.y - camera.y;
        const alpha = p.life / p.maxLife;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;

        if (p.type === 'launch' || p.type === 'collect') {
            // Sparkle shape
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2 + gameState.time * 5;
                const r = i % 2 === 0 ? p.size : p.size * 0.4;
                const px = x + Math.cos(angle) * r;
                const py = y + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(x, y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.globalAlpha = 1;
}

// ============== UI ==============
function updateUI() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('coins').textContent = gameState.coins;
    document.getElementById('lives').textContent = gameState.lives;
}

function restartGame() {
    // Reset game state
    gameState.score = 0;
    gameState.coins = 0;
    gameState.lives = 3;
    gameState.gameOver = false;
    gameState.levelComplete = false;
    gameState.time = 0;

    // Reset player
    const spawnPlanet = planets[0];
    player.currentPlanet = spawnPlanet;
    player.angle = -Math.PI / 2;
    player.x = spawnPlanet.x + Math.cos(player.angle) * (spawnPlanet.radius + player.radius);
    player.y = spawnPlanet.y + Math.sin(player.angle) * (spawnPlanet.radius + player.radius);
    player.angularVel = 0;
    player.spaceVelX = 0;
    player.spaceVelY = 0;
    player.grounded = true;
    player.inSpace = false;
    player.launching = false;
    player.spinning = false;
    player.trail = [];

    // Reset camera
    camera.x = 0;
    camera.y = 0;
    camera.shake = 0;

    // Reset entities
    createStarBits();
    createEnemies();
    particles.length = 0;

    // Reset launch stars
    launchStars.forEach(star => star.active = true);

    // Hide overlays
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('levelComplete').classList.add('hidden');

    updateUI();
}

// Event listeners
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('restartFromGameOver').addEventListener('click', restartGame);
document.getElementById('restartFromComplete').addEventListener('click', restartGame);

// ============== GAME LOOP ==============
function gameLoop() {
    updatePlayer();
    updateEnemies();
    updateParticles();
    updateStarBits();
    updateCamera();
    checkCollisions();

    drawBackground();
    drawPlanets();
    drawLaunchStars();
    drawStarBits();
    drawEnemies();
    drawParticles();
    drawPlayer();

    requestAnimationFrame(gameLoop);
}

// Initialize
restartGame();
gameLoop();
