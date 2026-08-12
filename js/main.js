import { Game } from './engine.js';
import { renderGame, updateUI } from './renderer.js';
import { LEVELS } from './levels.js';
import { TILE_SIZE } from './utils.js';

// ===== GAME INSTANCE =====
const game = new Game();

// ===== SCREEN MANAGEMENT =====
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(id);
    if (screen) screen.classList.add('active');
}

// ===== INIT =====
function init() {
    const canvas = document.getElementById('game-canvas');
    const minimap = document.getElementById('minimap-canvas');
    game.init(canvas, minimap);

    setupMenuListeners();
    setupGameListeners();
    setupLevelSelect();

    // Start game loop
    requestAnimationFrame(gameLoop);
}

function setupMenuListeners() {
    // New Game
    document.getElementById('btn-new-game')?.addEventListener('click', () => {
        game.audio.resume();
        startLevel(1);
    });

    // Level Select
    document.getElementById('btn-select-level')?.addEventListener('click', () => {
        showScreen('level-select');
    });

    // How to Play
    document.getElementById('btn-how-to-play')?.addEventListener('click', () => {
        showScreen('how-to-play');
    });

    // Back buttons
    document.getElementById('btn-back-menu')?.addEventListener('click', () => showScreen('main-menu'));
    document.getElementById('btn-back-menu2')?.addEventListener('click', () => showScreen('main-menu'));

    // Start Mission
    document.getElementById('btn-start-mission')?.addEventListener('click', () => {
        startCurrentLevel();
    });

    // Game Over buttons
    document.getElementById('btn-retry')?.addEventListener('click', () => {
        document.getElementById('game-over').classList.add('hidden');
        startCurrentLevel();
    });

    document.getElementById('btn-next-mission')?.addEventListener('click', () => {
        document.getElementById('game-over').classList.add('hidden');
        const next = game.currentLevelIndex + 1;
        if (next <= 20) {
            startLevel(next);
        } else {
            showScreen('main-menu');
        }
    });

    document.getElementById('btn-to-menu')?.addEventListener('click', () => {
        document.getElementById('game-over').classList.add('hidden');
        document.getElementById('pause-overlay').classList.add('hidden');
        game.state = 'menu';
        showScreen('main-menu');
    });

    // Pause
    document.getElementById('btn-resume')?.addEventListener('click', () => {
        document.getElementById('pause-overlay').classList.add('hidden');
        game.state = 'playing';
    });

    document.getElementById('btn-quit-game')?.addEventListener('click', () => {
        document.getElementById('pause-overlay').classList.add('hidden');
        game.state = 'menu';
        showScreen('main-menu');
    });

    // Build tabs
    document.querySelectorAll('.build-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.build-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            game.buildTab = tab.dataset.tab;
            updateUI(game);
        });
    });

    // Build items
    document.getElementById('build-contents')?.addEventListener('click', (e) => {
        const item = e.target.closest('.build-item');
        if (!item || item.classList.contains('disabled')) return;

        const type = item.dataset.type;
        const category = item.dataset.category;

        if (category === 'building') {
            game.startPlacingBuilding(type);
            updateUI(game);
        } else if (category === 'unit') {
            // Find producer
            const def = window.UNITS_CACHE?.[type]; // Will be set in import
            // Find appropriate producer
            let producer = null;
            if (game.selectedEntities.length === 1 && game.selectedEntities[0].isBuilding) {
                producer = game.selectedEntities[0];
            } else {
                // Auto-find producer
                const unitDef = { infantry: 'barracks', rocket_soldier: 'barracks', grenadier: 'barracks', 
                    engineer: 'barracks', spy: 'barracks',
                    light_tank: 'war_factory', heavy_tank: 'war_factory', mammoth_tank: 'war_factory',
                    harvester: 'war_factory', artillery: 'war_factory', helicopter: 'war_factory', apc: 'war_factory' };
                const prodType = unitDef[type];
                if (prodType) {
                    producer = game.entities.find(e => 
                        e.type === prodType && e.team === 0 && !e.dead && !e.beingBuilt && e.buildProgress >= 100
                    );
                }
            }
            if (producer) {
                game.trainUnit(type, producer);
                updateUI(game);
            }
        }
    });
}

function setupGameListeners() {
    const canvas = document.getElementById('game-canvas');

    // Mouse
    canvas.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (game.state !== 'playing') return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        game.handleMouseDown(x, y, e.button);
    });

    canvas.addEventListener('mouseup', (e) => {
        e.preventDefault();
        if (game.state !== 'playing') return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        game.handleMouseUp(x, y, e.button);
        updateUI(game);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (game.state !== 'playing') return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        game.handleMouseMove(x, y);
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Minimap click
    const minimap = document.getElementById('minimap-canvas');
    minimap?.addEventListener('mousedown', (e) => {
        if (game.state !== 'playing') return;
        const rect = minimap.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Convert minimap coordinates to world coordinates
        const sx = minimap.width / (game.mapW * TILE_SIZE);
        const sy = minimap.height / (game.mapH * TILE_SIZE);
        const s = Math.min(sx, sy);

        const worldX = x / s;
        const worldY = y / s;

        // Center camera
        game.targetCamera.x = worldX - canvas.width / 2;
        game.targetCamera.y = worldY - canvas.height / 2;
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (game.state !== 'playing') return;

        if (e.code === 'Escape') {
            e.preventDefault();
            game.state = 'paused';
            document.getElementById('pause-overlay').classList.remove('hidden');
        }

        game.handleKeyDown(e);
    });

    document.addEventListener('keyup', (e) => {
        game.handleKeyUp(e);
    });

    // Scroll edge
    canvas.addEventListener('mousemove', (e) => {
        if (game.state !== 'playing') return;
        const edge = 30;
        const rect = canvas.getBoundingClientRect();

        if (e.clientX < rect.left + edge) game.keys['ArrowLeft'] = true;
        else if (!game.keys['KeyA']) game.keys['ArrowLeft'] = false;

        if (e.clientX > rect.right - edge) game.keys['ArrowRight'] = true;
        else if (!game.keys['KeyD']) game.keys['ArrowRight'] = false;

        if (e.clientY < rect.top + edge) game.keys['ArrowUp'] = true;
        else if (!game.keys['KeyW']) game.keys['ArrowUp'] = false;

        if (e.clientY > rect.bottom - edge) game.keys['ArrowDown'] = true;
        else if (!game.keys['KeyS']) game.keys['ArrowDown'] = false;
    });

    // Resize
    window.addEventListener('resize', () => {
        game.resize();
    });
}

function setupLevelSelect() {
    const grid = document.getElementById('level-grid');
    if (!grid) return;

    grid.innerHTML = '';

    for (let i = 1; i <= 20; i++) {
        const level = LEVELS[i - 1];
        const unlocked = i <= game.levelProgress.maxUnlocked;
        const completed = game.levelProgress.completed.includes(i);

        const card = document.createElement('div');
        card.className = `level-card${!unlocked ? ' locked' : ''}${completed ? ' completed' : ''}`;
        card.innerHTML = `
            <div class="level-num">${unlocked ? i : '🔒'}</div>
            <div class="level-name">${unlocked ? level.name : 'Locked'}</div>
        `;

        if (unlocked) {
            card.addEventListener('click', () => {
                game.audio.resume();
                startLevel(i);
            });
        }

        grid.appendChild(card);
    }
}

function startLevel(levelIndex) {
    showScreen('mission-briefing');
    const level = LEVELS[levelIndex - 1];
    if (!level) return;

    game.currentLevelIndex = levelIndex;

    document.getElementById('briefing-title').textContent = `Mission ${level.id}: ${level.name}`;
    document.getElementById('briefing-faction').textContent = `Mission ${level.id} of 20 — ${level.subtitle}`;
    document.getElementById('briefing-text').textContent = level.briefing;

    let objectivesHtml = '<h3>OBJECTIVES</h3><ul>';
    for (const obj of level.objectives) {
        objectivesHtml += `<li>${obj}</li>`;
    }
    if (level.timeLimit > 0) {
        objectivesHtml += `<li>Time Limit: ${Math.floor(level.timeLimit / 60)} minutes</li>`;
    }
    objectivesHtml += '</ul>';
    document.getElementById('briefing-objectives').innerHTML = objectivesHtml;

    document.getElementById('btn-next-mission').style.display = levelIndex < 20 ? '' : 'none';
}

function startCurrentLevel() {
    showScreen('game-screen');
    game.state = 'playing';
    game.loadLevel(game.currentLevelIndex);
    game.resize();

    // Set victory/defeat callbacks
    game.onVictory = () => {
        setTimeout(() => {
            showGameOver(true);
        }, 1000);
    };
    game.onDefeat = () => {
        setTimeout(() => {
            showGameOver(false);
        }, 1000);
    };

    updateUI(game);
}

function showGameOver(victory) {
    game.state = 'gameover';
    const overlay = document.getElementById('game-over');
    const title = document.getElementById('game-over-title');
    const text = document.getElementById('game-over-text');

    overlay.classList.remove('hidden');

    if (victory) {
        title.textContent = 'VICTORY!';
        title.className = 'victory';
        const m = Math.floor(game.gameTime / 60);
        const s = Math.floor(game.gameTime % 60);
        text.textContent = `Mission completed in ${m}m ${s}s`;
    } else {
        title.textContent = 'DEFEAT';
        title.className = 'defeat';
        text.textContent = 'Your forces have been destroyed.';
    }

    document.getElementById('btn-next-mission').style.display = victory && game.currentLevelIndex < 20 ? '' : 'none';
}

// ===== GAME LOOP =====
let lastUIUpdate = 0;

function gameLoop(timestamp) {
    // Update game
    game.update(timestamp);

    // Render
    if (game.state === 'playing' || game.state === 'paused' || game.state === 'gameover') {
        renderGame(game);

        // Update UI periodically
        if (timestamp - lastUIUpdate > 200) {
            updateUI(game);
            lastUIUpdate = timestamp;
        }
    }

    // Check for victory/defeat display
    if (game.state === 'playing' && game.victory) {
        setTimeout(() => showGameOver(true), 500);
        game.state = 'gameover';
    }
    if (game.state === 'playing' && game.defeat) {
        setTimeout(() => showGameOver(false), 500);
        game.state = 'gameover';
    }

    requestAnimationFrame(gameLoop);
}

// ===== START =====
document.addEventListener('DOMContentLoaded', init);
