import { Game } from './engine.js';
import { renderGame, updateUI } from './renderer.js';
import { LEVELS } from './levels.js';
import { TILE_SIZE } from './utils.js';

const game = new Game();

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(id);
    if (screen) screen.classList.add('active');
}

function hideAllOverlays() {
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('pause-overlay').classList.add('hidden');
}

function init() {
    const canvas = document.getElementById('game-canvas');
    const minimap = document.getElementById('minimap-canvas');
    game.init(canvas, minimap);

    setupMenuListeners();
    setupGameListeners();
    setupLevelSelect();

    requestAnimationFrame(gameLoop);
}

function setupMenuListeners() {
    document.getElementById('btn-new-game')?.addEventListener('click', () => {
        game.audio.resume();
        startLevel(1);
    });

    document.getElementById('btn-select-level')?.addEventListener('click', () => {
        game.audio.resume();
        showScreen('level-select');
    });

    document.getElementById('btn-how-to-play')?.addEventListener('click', () => {
        game.audio.resume();
        showScreen('how-to-play');
    });

    document.getElementById('btn-back-menu')?.addEventListener('click', () => showScreen('main-menu'));
    document.getElementById('btn-back-menu2')?.addEventListener('click', () => showScreen('main-menu'));

    document.getElementById('btn-start-mission')?.addEventListener('click', () => {
        game.audio.resume();
        startCurrentLevel();
    });

    document.getElementById('btn-retry')?.addEventListener('click', () => {
        hideAllOverlays();
        startCurrentLevel();
    });

    document.getElementById('btn-next-mission')?.addEventListener('click', () => {
        hideAllOverlays();
        const next = game.currentLevelIndex + 1;
        if (next <= 20) startLevel(next);
        else { game.state = 'menu'; showScreen('main-menu'); }
    });

    document.getElementById('btn-to-menu')?.addEventListener('click', () => {
        hideAllOverlays();
        game.state = 'menu';
        showScreen('main-menu');
    });

    document.getElementById('btn-resume')?.addEventListener('click', () => {
        hideAllOverlays();
        game.state = 'playing';
    });

    document.getElementById('btn-quit-game')?.addEventListener('click', () => {
        hideAllOverlays();
        game.state = 'menu';
        showScreen('main-menu');
    });

    document.querySelectorAll('.build-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.build-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            game.buildTab = tab.dataset.tab;
        });
    });

    document.getElementById('build-contents')?.addEventListener('click', (e) => {
        const item = e.target.closest('.build-item');
        if (!item || item.classList.contains('disabled')) return;

        const type = item.dataset.type;
        const category = item.dataset.category;

        if (category === 'building') {
            game.startPlacingBuilding(type);
        } else if (category === 'unit') {
            const unitProducer = {
                infantry: 'barracks', rocket_soldier: 'barracks', grenadier: 'barracks',
                engineer: 'barracks', spy: 'barracks',
                light_tank: 'war_factory', heavy_tank: 'war_factory', mammoth_tank: 'war_factory',
                harvester: 'war_factory', artillery: 'war_factory', helicopter: 'war_factory', apc: 'war_factory'
            };
            const prodType = unitProducer[type];
            let producer = null;
            if (game.selectedEntities.length === 1 && game.selectedEntities[0].isBuilding) {
                producer = game.selectedEntities[0];
            } else if (prodType) {
                producer = game.entities.find(e =>
                    e.type === prodType && e.team === 0 && !e.dead && !e.beingBuilt && e.buildProgress >= 100
                );
            }
            if (producer) game.trainUnit(type, producer);
        }
    });
}

function setupGameListeners() {
    const canvas = document.getElementById('game-canvas');
    const minimap = document.getElementById('minimap-canvas');

    canvas.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (game.state !== 'playing') return;
        const rect = canvas.getBoundingClientRect();
        game.handleMouseDown(e.clientX - rect.left, e.clientY - rect.top, e.button);
    });

    canvas.addEventListener('mouseup', (e) => {
        e.preventDefault();
        if (game.state !== 'playing') return;
        const rect = canvas.getBoundingClientRect();
        game.handleMouseUp(e.clientX - rect.left, e.clientY - rect.top, e.button);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (game.state !== 'playing') return;
        const rect = canvas.getBoundingClientRect();
        game.handleMouseMove(e.clientX - rect.left, e.clientY - rect.top);

        // Edge scrolling
        const edge = 30;
        if (e.clientX < rect.left + edge) game.keys['ArrowLeft'] = true;
        else game.keys['ArrowLeft'] = false;
        if (e.clientX > rect.right - edge) game.keys['ArrowRight'] = true;
        else game.keys['ArrowRight'] = false;
        if (e.clientY < rect.top + edge) game.keys['ArrowUp'] = true;
        else game.keys['ArrowUp'] = false;
        if (e.clientY > rect.bottom - edge) game.keys['ArrowDown'] = true;
        else game.keys['ArrowDown'] = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Minimap click
    minimap?.addEventListener('click', (e) => {
        if (game.state !== 'playing') return;
        const rect = minimap.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const sx = minimap.width / (game.mapW * TILE_SIZE);
        const sy = minimap.height / (game.mapH * TILE_SIZE);
        const s = Math.min(sx, sy);
        game.targetCamera.x = (x / s) - canvas.width / 2;
        game.targetCamera.y = (y / s) - canvas.height / 2;
    });

    document.addEventListener('keydown', (e) => {
        if (game.state !== 'playing') return;
        if (e.code === 'Escape') {
            e.preventDefault();
            game.state = 'paused';
            document.getElementById('pause-overlay').classList.remove('hidden');
            return;
        }
        game.handleKeyDown(e);
    });

    document.addEventListener('keyup', (e) => {
        game.handleKeyUp(e);
    });

    window.addEventListener('resize', () => game.resize());
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
        card.innerHTML = `<div class="level-num">${unlocked ? i : '🔒'}</div><div class="level-name">${unlocked ? level.name : 'Locked'}</div>`;

        if (unlocked) {
            card.addEventListener('click', () => { game.audio.resume(); startLevel(i); });
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

    let objHtml = '<h3>OBJECTIVES</h3><ul>';
    for (const obj of level.objectives) objHtml += `<li>${obj}</li>`;
    if (level.timeLimit > 0) objHtml += `<li>Time Limit: ${Math.floor(level.timeLimit / 60)} min</li>`;
    objHtml += '</ul>';
    document.getElementById('briefing-objectives').innerHTML = objHtml;

    document.getElementById('btn-next-mission').style.display = levelIndex < 20 ? '' : 'none';
}

function startCurrentLevel() {
    hideAllOverlays();
    showScreen('game-screen');
    game.state = 'playing';
    game.loadLevel(game.currentLevelIndex);
    game.resize();
}

function showGameOver(victory) {
    if (game.state === 'gameover') return; // Prevent double call
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
let victoryShown = false;
let defeatShown = false;

function gameLoop(timestamp) {
    game.update(timestamp);

    if (game.state === 'playing' || game.state === 'paused' || game.state === 'gameover') {
        renderGame(game);

        if (timestamp - lastUIUpdate > 200) {
            updateUI(game);
            lastUIUpdate = timestamp;
        }
    }

    // Victory/defeat display - single trigger
    if (game.state === 'playing' && game.victory && !victoryShown) {
        victoryShown = true;
        setTimeout(() => showGameOver(true), 1000);
    }
    if (game.state === 'playing' && game.defeat && !defeatShown) {
        defeatShown = true;
        setTimeout(() => showGameOver(false), 1000);
    }

    // Reset flags when not playing
    if (game.state !== 'playing') {
        if (!game.victory) victoryShown = false;
        if (!game.defeat) defeatShown = false;
    }

    requestAnimationFrame(gameLoop);
}

document.addEventListener('DOMContentLoaded', init);
