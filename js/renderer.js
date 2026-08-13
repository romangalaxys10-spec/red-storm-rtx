import { 
    TILE_SIZE, T, TEAM, BUILDINGS, UNITS, TILE_COLORS, TILE_WALKABLE,
    SIDEBAR_WIDTH, TOP_HUD_HEIGHT
} from './utils.js';
import { fresnelRim, pointLight, hologram, starryVFX, drawSkybox, Textures } from './shaders.js?v=6';
import { drawBuilding, drawUnit } from './sprites.js?v=6';

const TEAM_COLORS = {
    [TEAM.PLAYER]: { primary: '#2266cc', secondary: '#3388ff', light: '#5599ff', dark: '#1144aa', minimap: '#4488ff' },
    [TEAM.ENEMY]: { primary: '#cc2222', secondary: '#ff4444', light: '#ff6655', dark: '#991111', minimap: '#ff4444' },
    [TEAM.NEUTRAL]: { primary: '#888888', secondary: '#aaaaaa', light: '#cccccc', dark: '#666666', minimap: '#888888' },
};

const UNIT_SHAPES = {
    infantry: 'circle',
    rocket_soldier: 'diamond',
    engineer: 'circle',
    grenadier: 'triangle',
    spy: 'circle',
    light_tank: 'rect',
    heavy_tank: 'rect',
    mammoth_tank: 'rect',
    harvester: 'rect',
    artillery: 'rect',
    helicopter: 'circle',
    apc: 'rect',
};

export function renderGame(game) {
    const ctx = game.ctx;
    const canvas = game.canvas;

    if (!ctx || game.state !== 'playing') return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate visible tile range for culling
    const startX = Math.floor(game.camera.x / TILE_SIZE) - 1;
    const startY = Math.floor(game.camera.y / TILE_SIZE) - 1;
    const endX = startX + Math.ceil(canvas.width / TILE_SIZE) + 2;
    const endY = startY + Math.ceil(canvas.height / TILE_SIZE) + 2;

    ctx.save();
    ctx.translate(-game.camera.x, -game.camera.y);

    // Draw terrain
    renderTerrain(ctx, game, startX, startY, endX, endY);

    // Draw buildings
    renderBuildings(ctx, game, startX, startY, endX, endY);

    // Draw units
    renderUnits(ctx, game);

    // Draw projectiles
    renderProjectiles(ctx, game);

    // Draw explosions
    renderExplosions(ctx, game);

    // Draw fog of war
    renderFogOfWar(ctx, game, startX, startY, endX, endY);

    // Draw selection box
    if (game.mouse.dragging) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        const sx = game.mouse.dragStartX + game.camera.x;
        const sy = game.mouse.dragStartY + game.camera.y;
        const ex = game.mouse.x + game.camera.x;
        const ey = game.mouse.y + game.camera.y;
        ctx.strokeRect(
            Math.min(sx, ex), Math.min(sy, ey),
            Math.abs(ex - sx), Math.abs(ey - sy)
        );
        ctx.fillStyle = 'rgba(0, 255, 0, 0.05)';
        ctx.fillRect(
            Math.min(sx, ex), Math.min(sy, ey),
            Math.abs(ex - sx), Math.abs(ey - sy)
        );
        ctx.setLineDash([]);
    }

    // Draw building placement preview
    if (game.placingBuilding) {
        renderPlacementPreview(ctx, game);
    }

    ctx.restore();

    // Draw minimap
    renderMinimap(game);
}

function renderTerrain(ctx, game, startX, startY, endX, endY) {
    for (let y = Math.max(0, startY); y < Math.min(game.mapH, endY); y++) {
        for (let x = Math.max(0, startX); x < Math.min(game.mapW, endX); x++) {
            const tile = game.map[y]?.[x];
            if (tile === undefined) continue;

            const px = x * TILE_SIZE;
            const py = y * TILE_SIZE;
            const colors = TILE_COLORS[tile] || TILE_COLORS[T.GRASS];

            // Use deterministic variation based on position
            const variation = ((x * 7 + y * 13) % colors.length);
            ctx.fillStyle = colors[variation];
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

            // Ore sparkle
            if (tile === T.ORE) {
                if ((x + y + Math.floor(game.gameTime * 2)) % 5 === 0) {
                    ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
                    ctx.fillRect(px + 4, py + 4, 4, 4);
                }
            }

            // Water animation
            if (tile === T.WATER || tile === T.SHALLOW_WATER) {
                const wave = Math.sin(game.gameTime * 2 + x * 0.5 + y * 0.3) * 0.1;
                ctx.fillStyle = `rgba(255,255,255,${0.05 + wave})`;
                ctx.fillRect(px, py + Math.sin(game.gameTime + x) * 3, TILE_SIZE, 2);
            }

            // Forest trees
            if (tile === T.FOREST) {
                ctx.fillStyle = '#0d3a08';
                ctx.beginPath();
                ctx.arc(px + 16, py + 12, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1a5510';
                ctx.beginPath();
                ctx.arc(px + 16, py + 14, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

function renderBuildings(ctx, game, startX, startY, endX, endY) {
    // Sort by y for depth
    const buildings = game.entities
        .filter(e => e.isBuilding && !e.dead && e.visible)
        .sort((a, b) => a.y - b.y);

    for (const entity of buildings) {
        const colors = TEAM_COLORS[entity.team];
        const w = entity.sizeW * TILE_SIZE;
        const h = entity.sizeH * TILE_SIZE;
        const px = entity.tileX * TILE_SIZE;
        const py = entity.tileY * TILE_SIZE;

        // Building body
        if (entity.beingBuilt) {
            // Construction progress
            const progress = entity.buildProgress / 100;
            ctx.fillStyle = colors.dark;
            ctx.fillRect(px, py, w, h);

            // Construction frame
            ctx.strokeStyle = colors.primary;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(px, py, w, h);
            ctx.setLineDash([]);

            // Progress fill
            ctx.fillStyle = `rgba(${entity.team === TEAM.PLAYER ? '34,102,204' : '204,34,34'}, ${0.3 + progress * 0.4})`;
            ctx.fillRect(px + 2, py + 2, (w - 4) * progress, h - 4);

            // Progress bar
            ctx.fillStyle = '#333';
            ctx.fillRect(px, py + h - 4, w, 4);
            ctx.fillStyle = entity.team === TEAM.PLAYER ? '#4488ff' : '#ff4444';
            ctx.fillRect(px, py + h - 4, w * progress, 4);
        } else {
            drawBuilding(ctx, entity, colors, game);

            // RA3 shader port: Fresnel rim glow + point-light bloom on building
            fresnelRim(ctx, px + w/2, py + h/2, Math.max(w, h) / 2 * 1.08,
                entity.team === TEAM.PLAYER ? '#4488ff' : '#ff4444', { intensity: 0.6 });

            // Production indicator
            if (entity.productionQueue.length > 0 || entity.productionItem) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = '10px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('▶', px + 2, py + 10);
            }

            // Health bar (only if damaged)
            if (entity.hp < entity.maxHp) {
                const barWidth = w;
                const barHeight = 4;
                const barX = px;
                const barY = py - 6;

                ctx.fillStyle = '#333';
                ctx.fillRect(barX, barY, barWidth, barHeight);

                const hpPercent = entity.hp / entity.maxHp;
                ctx.fillStyle = hpPercent > 0.5 ? '#00cc44' : hpPercent > 0.25 ? '#ffcc00' : '#ff4444';
                ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
            }
        }

        // Selection highlight
        if (entity.selected) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(px - 2, py - 2, w + 4, h + 4);

            // Corner markers
            const cm = 6;
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(px - 2, py - 2, cm, 2);
            ctx.fillRect(px - 2, py - 2, 2, cm);
            ctx.fillRect(px + w - cm + 2, py - 2, cm, 2);
            ctx.fillRect(px + w, py - 2, 2, cm);
            ctx.fillRect(px - 2, py + h, cm, 2);
            ctx.fillRect(px - 2, py + h - cm + 2, 2, cm);
            ctx.fillRect(px + w - cm + 2, py + h, cm, 2);
            ctx.fillRect(px + w, py + h - cm + 2, 2, cm);
        }
    }
}

function renderUnits(ctx, game) {
    const units = game.entities
        .filter(e => e.isUnit && !e.dead && (e.team === TEAM.PLAYER || e.visible))
        .sort((a, b) => a.y - b.y);

    for (const entity of units) {
        const colors = TEAM_COLORS[entity.team];
        const x = entity.x;
        const y = entity.y;
        const size = TILE_SIZE * entity.size * 0.4;

        ctx.save();
        ctx.translate(x, y);
        if (entity.isAir) ctx.translate(0, Math.sin(game.gameTime * 4) * 2);
        drawUnit(ctx, entity, colors, game);
        fresnelRim(ctx, 0, 0, size * 1.5,
            entity.team === TEAM.PLAYER ? '#4488ff' : '#ff4444', { intensity: 0.9 });
        if (game.gameTime - (entity.spawnTime || 0) < 0.8) {
            starryVFX(ctx, 0, 0, size * 3.2, game.gameTime * 1000, game.gameTime * 2);
        }
        ctx.restore();

                // Harvester ore indicator
        if (entity.isHarvester && entity.ore > 0) {
            const orePercent = entity.ore / entity.oreCapacity;
            ctx.fillStyle = '#333';
            ctx.fillRect(x - size, y - size - 6, size * 2, 3);
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(x - size, y - size - 6, size * 2 * orePercent, 3);
        }

        // Health bar (only if damaged)
        if (entity.hp < entity.maxHp && entity.hp > 0) {
            const barWidth = size * 2;
            const barHeight = 3;
            const barX = x - barWidth / 2;
            const barY = y - size - (entity.isHarvester && entity.ore > 0 ? 10 : 6);

            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            const hpPercent = entity.hp / entity.maxHp;
            ctx.fillStyle = hpPercent > 0.5 ? '#00cc44' : hpPercent > 0.25 ? '#ffcc00' : '#ff4444';
            ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
        }

        // Selection ring
        if (entity.selected) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, size + 3, 0, Math.PI * 2);
            ctx.stroke();

            // Small green circle
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(x, y + size + 4, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Attack target line
        if (entity.selected && entity.attackTarget && !entity.attackTarget.dead) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(entity.attackTarget.x, entity.attackTarget.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

function renderProjectiles(ctx, game) {
    for (const proj of game.projectiles) {
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Trail
        ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(proj.x, proj.y);
        ctx.lineTo(proj.x - proj.dx * 3, proj.y - proj.dy * 3);
        ctx.stroke();

        // RA3 shader port: point-light glow on projectile
        pointLight(ctx, proj.x, proj.y, 22, '#ffcc33', 0.7);
    }
}

function renderExplosions(ctx, game) {
    for (const exp of game.explosions) {
        const progress = 1 - exp.timer / 30;
        const alpha = (1 - progress) * 0.7;
        const radius = exp.radius * (0.5 + progress * 0.5);

        // Outer glow
        const grad = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, radius);
        grad.addColorStop(0, `rgba(255, 200, 50, ${alpha})`);
        grad.addColorStop(0.5, `rgba(255, 100, 20, ${alpha * 0.6})`);
        grad.addColorStop(1, `rgba(100, 30, 0, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // RA3 shader port: point-light burst
        pointLight(ctx, exp.x, exp.y, radius * 1.6, '#ff7722', alpha * 2.2);
    }
}

function renderFogOfWar(ctx, game, startX, startY, endX, endY) {
    for (let y = Math.max(0, startY); y < Math.min(game.mapH, endY); y++) {
        for (let x = Math.max(0, startX); x < Math.min(game.mapW, endX); x++) {
            const fog = game.fogMap[y]?.[x];
            if (fog === undefined || fog >= 2) continue;

            const px = x * TILE_SIZE;
            const py = y * TILE_SIZE;

            if (fog === 0) {
                // Unexplored - full black
                ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            } else if (fog === 1) {
                // Explored but not visible - dark overlay
                ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            }
        }
    }
}

function renderPlacementPreview(ctx, game) {
    if (!game.placingBuilding) return;

    const type = game.placingBuilding;
    const def = BUILDINGS[type];
    if (!def) return;

    const tx = Math.floor(game.mouse.worldX / TILE_SIZE);
    const ty = Math.floor(game.mouse.worldY / TILE_SIZE);
    const w = def.size.w * TILE_SIZE;
    const h = def.size.h * TILE_SIZE;
    const px = tx * TILE_SIZE;
    const py = ty * TILE_SIZE;

    const valid = game.canPlaceBuilding(type, game.mouse.worldX, game.mouse.worldY, TEAM.PLAYER);

    ctx.fillStyle = valid ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
    ctx.fillRect(px, py, w, h);

    ctx.strokeStyle = valid ? '#00ff00' : '#ff0000';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(px, py, w, h);
    ctx.setLineDash([]);
}

function renderMinimap(game) {
    const mctx = game.minimapCtx;
    const mcanvas = game.minimapCanvas;
    if (!mctx || !mcanvas) return;

    const mw = mcanvas.width;
    const mh = mcanvas.height;

    mctx.fillStyle = '#111';
    mctx.fillRect(0, 0, mw, mh);

    // Scale factors
    const sx = mw / (game.mapW * TILE_SIZE);
    const sy = mh / (game.mapH * TILE_SIZE);
    const s = Math.min(sx, sy);

    // Draw terrain
    for (let y = 0; y < game.mapH; y += 2) {
        for (let x = 0; x < game.mapW; x += 2) {
            const tile = game.map[y]?.[x];
            if (tile === undefined) continue;

            const fog = game.fogMap[y]?.[x] || 0;
            if (fog === 0) continue; // Don't show unexplored

            const colors = {
                [T.GRASS]: '#1a3a0e',
                [T.WATER]: '#1a3a6a',
                [T.ORE]: '#8a7a2a',
                [T.ROCK]: '#444',
                [T.SAND]: '#8a7a3a',
                [T.FOREST]: '#0d2a08',
                [T.BRIDGE]: '#5a4a2a',
                [T.SHALLOW_WATER]: '#2a4a7a',
                [T.ROAD]: '#3a3a3a',
                [T.WALL]: '#333',
            };

            mctx.fillStyle = colors[tile] || '#1a3a0e';
            if (fog === 1) mctx.fillStyle = '#222';
            mctx.fillRect(x * TILE_SIZE * s, y * TILE_SIZE * s, TILE_SIZE * 2 * s, TILE_SIZE * 2 * s);
        }
    }

    // Draw entities
    for (const entity of game.entities) {
        if (entity.dead) continue;
        if (entity.team !== TEAM.PLAYER && !entity.visible) continue;

        const colors = TEAM_COLORS[entity.team];
        const ex = entity.x * s;
        const ey = entity.y * s;
        const es = entity.isBuilding ? 
            Math.max(entity.sizeW, entity.sizeH) * TILE_SIZE * s * 0.5 : 
            2;

        mctx.fillStyle = colors.minimap;
        if (entity.isBuilding) {
            mctx.fillRect(ex - es, ey - es, es * 2, es * 2);
        } else {
            mctx.beginPath();
            mctx.arc(ex, ey, es, 0, Math.PI * 2);
            mctx.fill();
        }
    }

    // Draw camera viewport
    const vx = game.camera.x * s;
    const vy = game.camera.y * s;
    const vw = game.canvas.width * s;
    const vh = game.canvas.height * s;

    mctx.strokeStyle = '#ffffff';
    mctx.lineWidth = 1;
    mctx.strokeRect(vx, vy, vw, vh);
}

export function updateUI(game) {
    if (game.state !== 'playing') return;

    // Credits
    const creditsEl = document.getElementById('credits-display');
    if (creditsEl) creditsEl.textContent = game.playerCredits.toLocaleString();

    // Power
    const powerEl = document.getElementById('power-display');
    if (powerEl) {
        const surplus = game.playerPower - game.playerPowerUsed;
        powerEl.textContent = `${game.playerPower}/${game.playerPowerUsed}`;
        powerEl.className = surplus >= 0 ? 'power ok' : 'power low';
    }

    // Game time
    const timeEl = document.getElementById('game-time');
    if (timeEl) {
        const m = Math.floor(game.gameTime / 60);
        const s = Math.floor(game.gameTime % 60);
        timeEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    // Mission name
    const missionEl = document.getElementById('mission-name-hud');
    if (missionEl) missionEl.textContent = `Mission ${game.currentLevelIndex}`;

    // Selection panel
    updateSelectionPanel(game);

    // Build panel
    updateBuildPanel(game);

    // Messages
    updateMessages(game);
}

function updateSelectionPanel(game) {
    const panel = document.getElementById('entity-info');
    if (!panel) return;

    if (game.selectedEntities.length === 0) {
        panel.innerHTML = '<div class="info-placeholder">Select a unit or building</div>';
        return;
    }

    if (game.selectedEntities.length === 1) {
        const entity = game.selectedEntities[0];
        const def = entity.isBuilding ? BUILDINGS[entity.type] : UNITS[entity.type];

        let html = `
            <div class="entity-header">
                <div class="entity-icon">${entity.icon}</div>
                <div>
                    <div class="entity-name">${entity.name}</div>
                    <div style="font-size:0.7rem;color:#999">${entity.hp}/${entity.maxHp} HP</div>
                </div>
            </div>
            <div class="entity-hp-bar">
                <div class="entity-hp-fill ${entity.hpPercent < 0.5 ? 'low' : ''}" 
                     style="width:${entity.hpPercent * 100}%"></div>
            </div>
            <div class="entity-stats">`;

        if (entity.isUnit) {
            if (entity.canAttack) {
                html += `<span>Damage: ${entity.attackDamage}</span>`;
                html += `<span>Range: ${(entity.attackRange / TILE_SIZE).toFixed(1)}</span>`;
                html += `<span>Speed: ${entity.speed.toFixed(1)}</span>`;
                html += `<span>Armor: ${entity.armor}</span>`;
            }
            if (entity.isHarvester) {
                html += `<span>Ore: ${Math.floor(entity.ore)}/${entity.oreCapacity}</span>`;
            }
        } else {
            if (entity.powerProvided > 0) html += `<span>Power: +${entity.powerProvided}</span>`;
            if (entity.powerUsed > 0) html += `<span>Power: -${entity.powerUsed}</span>`;
            html += `<span>Size: ${entity.sizeW}x${entity.sizeH}</span>`;

            // Production progress
            if (entity.productionItem) {
                const pDef = UNITS[entity.productionItem];
                if (pDef) {
                    html += `</div><div style="margin-top:0.5rem;font-size:0.75rem;">
                        Producing: ${pDef.name}<br>
                        Queue: ${entity.productionQueue.length} items`;
                }
            } else if (entity.productionQueue.length > 0) {
                html += `</div><div style="margin-top:0.5rem;font-size:0.75rem;">
                    Queue: ${entity.productionQueue.length} items`;
            }
        }

        // Upgrades (Tech Center) — RA3/Generals-style research
        if (entity.type === 'tech_center' && entity.team === TEAM.PLAYER) {
            html += '</div><div style="margin-top:0.6rem;">' +
                '<div style="font-size:0.75rem;color:#aaa;margin-bottom:0.3rem;letter-spacing:0.1em;">RESEARCH</div>';
            const ups = [['armor', '🛡️ Armor +25%'], ['damage', '⚔️ Damage +25%'], ['speed', '⚡ Speed +20%']];
            for (const up of ups) {
                const done = game.upgrades[up[0]];
                html += '<button class="upgrade-btn' + (done ? ' done' : '') + '" data-upgrade="' + up[0] + '"' +
                    (done ? ' disabled' : '') + '>' + up[1] + ' ($1500)</button>';
            }
            html += '</div>';
        }

        html += '</div>';
        panel.innerHTML = html;
    } else {
        // Multiple selection
        const units = game.selectedEntities.filter(e => e.isUnit);
        const types = {};
        for (const u of units) {
            types[u.name] = (types[u.name] || 0) + 1;
        }

        let html = `<div class="entity-header">
            <div class="entity-icon">👥</div>
            <div><div class="entity-name">${units.length} units selected</div></div>
        </div><div style="font-size:0.75rem;color:#999;margin-top:0.3rem;">`;

        for (const [name, count] of Object.entries(types)) {
            html += `${name}: ${count}<br>`;
        }
        html += '</div>';
        panel.innerHTML = html;
    }
}

function updateBuildPanel(game) {
    const contents = document.getElementById('build-contents');
    if (!contents) return;

    if (game.buildTab === 'structures') {
        let html = '';

        const level = game.currentLevel;
        const available = level.availableTech || [];

        for (const type of available) {
            const def = BUILDINGS[type];
            if (!def) continue;

            if (type === 'construction_yard') continue; // Can't build CY

            const canAfford = game.playerCredits >= def.cost;
            const hasPrereq = !def.prerequisite || game.hasPrerequisite(def.prerequisite, TEAM.PLAYER);
            const disabled = !canAfford || !hasPrereq;
            const selected = game.placingBuilding === type;

            html += `<div class="build-item ${disabled ? 'disabled' : ''} ${selected ? 'selected' : ''}" 
                          data-type="${type}" data-category="building">
                <span class="build-icon">${def.icon}</span>
                <div class="build-info">
                    <div class="build-name">${def.name}</div>
                    <div class="build-cost">$${def.cost}${!hasPrereq ? ' 🔒' : ''}</div>
                </div>
                ${selected ? '<div class="build-progress" style="width:100%"></div>' : ''}
            </div>`;
        }

        contents.innerHTML = html;
    } else if (game.buildTab === 'units') {
        let html = '';

        const level = game.currentLevel;
        const available = level.availableUnits || [];

        // Find production buildings
        const selectedBuilding = game.selectedEntities.length === 1 && game.selectedEntities[0].isBuilding ?
            game.selectedEntities[0] : null;

        // Show units based on selected building or all available
        let showUnits = available;
        if (selectedBuilding) {
            const producerType = selectedBuilding.type;
            showUnits = available.filter(u => {
                const def = UNITS[u];
                return def && def.producedAt === producerType;
            });
        }

        for (const type of showUnits) {
            const def = UNITS[type];
            if (!def) continue;

            const canAfford = game.playerCredits >= def.cost;
            const hasPrereq = !def.prerequisite || game.hasPrerequisite(def.prerequisite, TEAM.PLAYER);
            const hasProducer = game.entities.some(e => 
                e.type === def.producedAt && e.team === TEAM.PLAYER && !e.dead && !e.beingBuilt && e.buildProgress >= 100
            );
            const disabled = !canAfford || !hasPrereq || !hasProducer;

            html += `<div class="build-item ${disabled ? 'disabled' : ''}" 
                          data-type="${type}" data-category="unit">
                <span class="build-icon">${def.icon}</span>
                <div class="build-info">
                    <div class="build-name">${def.name}</div>
                    <div class="build-cost">$${def.cost}${!hasProducer ? ' ❌' : ''}</div>
                </div>
            </div>`;
        }

        if (html === '') {
            html = '<div class="info-placeholder" style="padding:1rem;">No units available<br><small style="color:#666">Select a Barracks or War Factory</small></div>';
        }

        contents.innerHTML = html;
    }
}

function updateMessages(game) {
    const overlay = document.getElementById('messages-overlay');
    if (!overlay) return;

    const now = Date.now();
    const recent = game.messages.filter(m => now - m.time < 4000);

    overlay.innerHTML = recent.map(m => 
        `<div class="game-message ${m.type}">${m.text}</div>`
    ).join('');
}
