const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let gameState = {
    score: 0,
    coins: 0,
    lives: 3,
    gameOver: false,
    levelComplete: false
};

// Player object
const player = {
    x: 50,
    y: 400,
    width: 32,
    height: 32,
    velX: 0,
    velY: 0,
    speed: 5,
    jumpPower: 12,
    grounded: false,
    direction: 1
};

// Controls
const keys = {
    left: false,
    right: false,
    up: false,
    space: false
};

// Gravity
const gravity = 0.5;
const friction = 0.8;

// Level design
const platforms = [
    { x: 0, y: 550, width: 800, height: 50, color: '#27ae60' }, // Ground
    { x: 200, y: 450, width: 100, height: 20, color: '#c0392b' },
    { x: 350, y: 370, width: 100, height: 20, color: '#c0392b' },
    { x: 500, y: 290, width: 100, height: 20, color: '#c0392b' },
    { x: 150, y: 250, width: 80, height: 20, color: '#c0392b' },
    { x: 650, y: 350, width: 120, height: 20, color: '#c0392b' }
];

// Blocks (question marks and bricks)
const blocks = [
    { x: 150, y: 350, width: 30, height: 30, color: '#f39c12', type: 'coin', active: true },
    { x: 250, y: 300, width: 30, height: 30, color: '#f39c12', type: 'coin', active: true },
    { x: 400, y: 220, width: 30, height: 30, color: '#f39c12', type: 'coin', active: true },
    { x: 320, y: 220, width: 30, height: 30, color: '#95a5a6', type: 'brick', active: true },
    { x: 350, y: 220, width: 30, height: 30, color: '#95a5a6', type: 'brick', active: true },
    { x: 550, y: 200, width: 30, height: 30, color: '#f39c12', type: 'coin', active: true }
];

// Coins
const coins = [
    { x: 230, y: 420, width: 20, height: 20, collected: false },
    { x: 380, y: 340, width: 20, height: 20, collected: false },
    { x: 530, y: 260, width: 20, height: 20, collected: false },
    { x: 180, y: 220, width: 20, height: 20, collected: false },
    { x: 680, y: 320, width: 20, height: 20, collected: false },
    { x: 450, y: 500, width: 20, height: 20, collected: false }
];

// Enemies
const enemies = [
    { x: 300, y: 518, width: 30, height: 30, velX: 2, direction: 1, alive: true },
    { x: 600, y: 518, width: 30, height: 30, velX: 2, direction: 1, alive: true },
    { x: 500, y: 258, width: 30, height: 30, velX: 1.5, direction: 1, alive: true }
];

// Goal flag
const goal = {
    x: 750,
    y: 470,
    width: 40,
    height: 80
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
    player.x = 50;
    player.y = 400;
    player.velX = 0;
    player.velY = 0;
    player.grounded = false;

    // Reset game state
    gameState.score = 0;
    gameState.coins = 0;
    gameState.lives = 3;
    gameState.gameOver = false;
    gameState.levelComplete = false;

    // Reset coins
    coins.forEach(coin => coin.collected = false);

    // Reset blocks
    blocks.forEach(block => block.active = true);

    // Reset enemies
    enemies.forEach((enemy, i) => {
        enemy.alive = true;
        if (i === 0) enemy.x = 300;
        if (i === 1) enemy.x = 600;
        if (i === 2) enemy.x = 500;
    });

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

// Update player
function updatePlayer() {
    if (gameState.gameOver || gameState.levelComplete) return;

    // Horizontal movement
    if (keys.left) {
        player.velX = -player.speed;
        player.direction = -1;
    } else if (keys.right) {
        player.velX = player.speed;
        player.direction = 1;
    } else {
        player.velX *= friction;
    }

    // Jumping
    if ((keys.up || keys.space) && player.grounded) {
        player.velY = -player.jumpPower;
        player.grounded = false;
    }

    // Apply gravity
    player.velY += gravity;

    // Update position
    player.x += player.velX;
    player.y += player.velY;

    // Boundary check
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Check if fell off
    if (player.y > canvas.height) {
        gameState.lives--;
        if (gameState.lives <= 0) {
            endGame();
        } else {
            resetPlayerPosition();
        }
    }

    player.grounded = false;
}

function resetPlayerPosition() {
    player.x = 50;
    player.y = 400;
    player.velX = 0;
    player.velY = 0;
    updateUI();
}

// Collision detection
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Platform collision
function checkPlatforms() {
    platforms.forEach(platform => {
        if (checkCollision(player, platform)) {
            // Landing on top
            if (player.velY > 0 && player.y + player.height - player.velY <= platform.y) {
                player.y = platform.y - player.height;
                player.velY = 0;
                player.grounded = true;
            }
            // Hitting from bottom
            else if (player.velY < 0 && player.y - player.velY >= platform.y + platform.height) {
                player.y = platform.y + platform.height;
                player.velY = 0;
            }
        }
    });
}

// Block collision
function checkBlocks() {
    blocks.forEach(block => {
        if (!block.active) return;

        if (checkCollision(player, block)) {
            // Hit from bottom
            if (player.velY < 0 && player.y - player.velY >= block.y + block.height) {
                player.y = block.y + block.height;
                player.velY = 0;

                if (block.type === 'coin') {
                    block.active = false;
                    gameState.coins++;
                    gameState.score += 100;
                    updateUI();
                }
            }
            // Landing on top
            else if (player.velY > 0 && player.y + player.height - player.velY <= block.y) {
                player.y = block.y - player.height;
                player.velY = 0;
                player.grounded = true;
            }
        }
    });
}

// Coin collection
function checkCoins() {
    coins.forEach(coin => {
        if (!coin.collected && checkCollision(player, coin)) {
            coin.collected = true;
            gameState.coins++;
            gameState.score += 50;
            updateUI();
        }
    });
}

// Enemy collision
function updateEnemies() {
    enemies.forEach(enemy => {
        if (!enemy.alive) return;

        // Move enemy
        enemy.x += enemy.velX * enemy.direction;

        // Bounce off walls
        if (enemy.x <= 0 || enemy.x + enemy.width >= canvas.width) {
            enemy.direction *= -1;
        }

        // Check platform edges for enemies
        let onPlatform = false;
        platforms.forEach(platform => {
            if (enemy.y + enemy.height >= platform.y - 5 &&
                enemy.y + enemy.height <= platform.y + 5) {
                if (enemy.x + enemy.width > platform.x && enemy.x < platform.x + platform.width) {
                    onPlatform = true;
                }
            }
        });

        // Turn around at platform edges
        if (!onPlatform && enemy.y + enemy.height < canvas.height) {
            enemy.direction *= -1;
        }

        // Check collision with player
        if (checkCollision(player, enemy)) {
            // Jump on enemy
            if (player.velY > 0 && player.y + player.height - player.velY <= enemy.y + 10) {
                enemy.alive = false;
                player.velY = -8;
                gameState.score += 200;
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

// Check goal
function checkGoal() {
    if (checkCollision(player, goal)) {
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

// Drawing functions
function drawPlayer() {
    // Draw Mario
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Cap
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(player.x + 5, player.y, player.width - 10, 10);

    // Face
    ctx.fillStyle = '#f5b7b1';
    ctx.fillRect(player.x + 8, player.y + 10, player.width - 16, 12);

    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(player.x + 10, player.y + 12, 3, 3);
    ctx.fillRect(player.x + 19, player.y + 12, 3, 3);

    // Mustache
    ctx.fillRect(player.x + 8, player.y + 18, player.width - 16, 4);
}

function drawPlatforms() {
    platforms.forEach(platform => {
        ctx.fillStyle = platform.color;
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);

        // Add texture
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        for (let i = 0; i < platform.width; i += 20) {
            ctx.fillRect(platform.x + i, platform.y, 2, platform.height);
        }
    });
}

function drawBlocks() {
    blocks.forEach(block => {
        if (!block.active) return;

        ctx.fillStyle = block.color;
        ctx.fillRect(block.x, block.y, block.width, block.height);

        // Question mark for coin blocks
        if (block.type === 'coin') {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px Arial';
            ctx.fillText('?', block.x + 8, block.y + 23);
        }

        // Border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(block.x, block.y, block.width, block.height);
    });
}

function drawCoins() {
    coins.forEach(coin => {
        if (coin.collected) return;

        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(coin.x + coin.width / 2, coin.y + coin.height / 2, coin.width / 2, 0, Math.PI * 2);
        ctx.fill();

        // Inner circle
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(coin.x + coin.width / 2, coin.y + coin.height / 2, coin.width / 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawEnemies() {
    enemies.forEach(enemy => {
        if (!enemy.alive) return;

        // Draw Goomba
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(enemy.x + 5, enemy.y + 8, 8, 8);
        ctx.fillRect(enemy.x + 17, enemy.y + 8, 8, 8);

        // Pupils
        ctx.fillStyle = '#000';
        ctx.fillRect(enemy.x + 8, enemy.y + 11, 3, 3);
        ctx.fillRect(enemy.x + 20, enemy.y + 11, 3, 3);

        // Frown
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x + 15, enemy.y + 22, 5, 0, Math.PI);
        ctx.stroke();
    });
}

function drawGoal() {
    // Flag pole
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(goal.x + 15, goal.y, 5, goal.height);

    // Flag
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.moveTo(goal.x + 20, goal.y);
    ctx.lineTo(goal.x + 40, goal.y + 10);
    ctx.lineTo(goal.x + 20, goal.y + 20);
    ctx.closePath();
    ctx.fill();
}

// Main game loop
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update
    updatePlayer();
    checkPlatforms();
    checkBlocks();
    checkCoins();
    updateEnemies();
    checkGoal();

    // Draw
    drawPlatforms();
    drawBlocks();
    drawCoins();
    drawEnemies();
    drawGoal();
    drawPlayer();

    requestAnimationFrame(gameLoop);
}

// Start game
updateUI();
gameLoop();
