import { Game } from './engine.js?v=5';
import { renderGame, updateUI } from './renderer.js?v=5';
import { LEVELS } from './levels.js?v=5';
import { TILE_SIZE } from './utils.js?v=5';
import { Textures } from './shaders.js?v=5';

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
    Textures.load();

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

    document.getElementById('btn-back-menu')?.addEventListener('click', () => {
        hideAllOverlays();
        game.state = 'menu';
        showScreen('main-menu');
    });

    document.getElementById('btn-back-menu2')?.addEventListener('click', () => {
        hideAllOverlays();
        game.state = 'menu';
        showScreen('main-menu');
    });

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

    // Delegate superweapon bar clicks
    document.getElementById('superweapon-bar')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.sw-btn');
        if (!btn || btn.classList.contains('disabled')) return;
        const type = btn.dataset.type;
        if (game.superweaponPending === type) { game.superweaponPending = null; return; }
        game.superweaponPending = type;
        game.addMessage('Select target for ' + btn.dataset.name + '...', 'info');
    });

    // Delegate upgrade button clicks (Tech Center research)
    document.getElementById('selection-panel')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-upgrade]');
        if (!btn || btn.disabled) return;
        game.purchaseUpgrade(btn.dataset.upgrade);
    });
}

// RA3/Generals-style superweapon bar
function updateSuperweaponBar(g) {
    const bar = document.getElementById('superweapon-bar');
    if (!bar) return;
    const types = ['nuclear_silo', 'chronosphere', 'iron_curtain', 'weather_control'];
    let html = '';
    let any = false;
    for (const t of types) {
        const b = g.entities.find(e => e.superweapon === t && e.team === TEAM.PLAYER && !e.dead);
        if (!b) continue;
        any = true;
        const ready = b.charge >= 1;
        const pct = Math.floor(b.charge * 100);
        const armed = g.superweaponPending === t;
        const name = BUILDINGS[t].name;
        const icon = BUILDINGS[t].icon;
        html += `<div class="sw-btn ${ready ? '' : 'disabled'} ${armed ? 'armed' : ''}" data-type="${t}" data-name="${name}">
            <span class="sw-icon">${icon}</span>
            <span class="sw-label">${name}</span>
            <div class="sw-charge"><div class="sw-charge-fill" style="width:${pct}%"></div></div>
            <span class="sw-status">${ready ? (armed ? '🎯 TARGET' : 'READY') : pct + '%'}</span>
        </div>`;
    }
    if (!any) { bar.innerHTML = ''; bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    bar.innerHTML = html;
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
    hideAllOverlays();
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
    // RA3 shader port: invasion-screen transition on mission start
    const invasion = document.getElementById('invasion-overlay');
    if (invasion) {
        invasion.classList.remove('hidden');
        invasion.classList.add('invasion-anim');
        setTimeout(() => {
            invasion.classList.add('hidden');
            invasion.classList.remove('invasion-anim');
        }, 1300);
    }
}

function showGameOver(victory) {
    // CRITICAL: Prevent double-call
    if (game.state === 'gameover') return;
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
let victoryTriggered = false;
let defeatTriggered = false;

function gameLoop(timestamp) {
    // Update game logic
    game.update(timestamp);

    // Render
    if (game.state === 'playing' || game.state === 'paused' || game.state === 'gameover') {
        renderGame(game);

        if (timestamp - lastUIUpdate > 200) {
            updateUI(game);
            updateSuperweaponBar(game);
            lastUIUpdate = timestamp;
        }
    }

    // Single-trigger victory/defeat display with guards
    if (game.state === 'playing') {
        if (game.victory && !victoryTriggered) {
            victoryTriggered = true;
            console.log('[Main] Victory detected, showing game over in 1s');
            setTimeout(() => showGameOver(true), 1000);
        }
        if (game.defeat && !defeatTriggered) {
            defeatTriggered = true;
            console.log('[Main] Defeat detected, showing game over in 1s');
            setTimeout(() => showGameOver(false), 1000);
        }
    }

    // Reset triggers when not in playing state
    if (game.state !== 'playing') {
        if (!game.victory) victoryTriggered = false;
        if (!game.defeat) defeatTriggered = false;
    }

    requestAnimationFrame(gameLoop);
}

document.addEventListener('DOMContentLoaded', init);
