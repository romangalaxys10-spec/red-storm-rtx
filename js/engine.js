import { 
    TILE_SIZE, T, TEAM, BUILDINGS, UNITS, TILE_WALKABLE,
    dist, manhattanDist, clamp, angle, randInt, randFloat,
    findPath, generateMap, AudioSystem
} from './utils.js';
import { LEVELS } from './levels.js';

let entityIdCounter = 0;

export class Entity {
    constructor(config) {
        this.id = entityIdCounter++;
        this.type = config.type;
        this.category = config.category;
        this.team = config.team;
        this.tileX = config.tileX;
        this.tileY = config.tileY;
        this.x = config.tileX * TILE_SIZE + TILE_SIZE / 2;
        this.y = config.tileY * TILE_SIZE + TILE_SIZE / 2;

        const def = this.category === 'building' ? BUILDINGS[config.type] : UNITS[config.type];
        if (!def) {
            console.error('[Entity] Missing def for type:', config.type, 'category:', config.category);
        }
        this.name = def ? def.name : config.type;
        this.icon = def ? def.icon : '?';
        this.maxHp = def ? def.hp : 100;
        this.hp = this.maxHp;
        this.cost = def ? def.cost : 0;

        this.attackDamage = (def && def.attackDamage) || 0;
        this.attackRange = ((def && def.attackRange) || 0) * TILE_SIZE;
        this.attackSpeed = (def && def.attackSpeed) || 0;
        this.armor = (def && def.armor) || 0;
        this.antiAir = (def && def.antiAir) || false;
        this.antiArmor = (def && def.antiArmor) || false;
        this.splash = ((def && def.splash) || 0) * TILE_SIZE;

        this.speed = ((def && def.speed) || 0) * 1.5;
        this.size = (def && def.size) || 1;
        this.isAir = (def && def.isAir) || false;
        this.isHarvester = (def && def.isHarvester) || false;
        this.canAttack = (def && def.canAttack) || false;
        this.canCapture = (def && def.canCapture) || false;
        this.canTransport = (def && def.canTransport) || false;
        this.isInvisible = (def && def.isInvisible) || false;
        this.producedAt = (def && def.producedAt) || null;
        this.prerequisite = (def && def.prerequisite) || null;

        this.sizeW = 1;
        this.sizeH = 1;
        this.powerProvided = 0;
        this.powerUsed = 0;
        this.provides = null;
        this.buildTime = 0;
        this.spawnsUnit = null;

        const bDef = BUILDINGS[config.type];
        if (bDef && this.category === 'building') {
            this.sizeW = bDef.size.w;
            this.sizeH = bDef.size.h;
            this.powerProvided = bDef.power > 0 ? bDef.power : 0;
            this.powerUsed = bDef.power < 0 ? -bDef.power : 0;
            this.provides = bDef.provides || null;
            this.buildTime = bDef.buildTime;
            this.spawnsUnit = bDef.spawnsUnit || null;
        }

        this.ore = 0;
        this.oreCapacity = (def && def.oreCapacity) || 0;
        this.harvesting = false;
        this.harvestTarget = null;
        this.returning = false;

        this.path = [];
        this.targetX = null;
        this.targetY = null;

        this.attackTarget = null;
        this.attackCooldown = 0;
        this.attackCooldownMax = this.attackSpeed > 0 ? (1 / this.attackSpeed) * 60 : 0;

        this.buildProgress = 100;
        this.underConstruction = false;
        this.beingBuilt = config.beingBuilt || false;
        if (this.beingBuilt) {
            this.hp = 1;
            this.buildProgress = 0;
        }

        this.productionQueue = [];
        this.productionProgress = 0;
        this.productionItem = null;

        this.selected = false;
        this.visible = true;

        this.dead = false;
        this.deathTimer = 0;

        this.animFrame = 0;
        this.facing = 0;
    }

    get hpPercent() { return this.maxHp > 0 ? this.hp / this.maxHp : 0; }
    get isUnit() { return this.category === 'unit'; }
    get isBuilding() { return this.category === 'building'; }
}

class Projectile {
    constructor(config) {
        this.x = config.x;
        this.y = config.y;
        this.targetX = config.targetX;
        this.targetY = config.targetY;
        this.target = config.target;
        this.speed = 8;
        this.damage = config.damage;
        this.splash = config.splash || 0;
        this.owner = config.owner;
        this.team = config.team;
        this.dead = false;
        const a = angle(this.x, this.y, this.targetX, this.targetY);
        this.dx = Math.cos(a) * this.speed;
        this.dy = Math.sin(a) * this.speed;
    }
}

export class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.minimapCanvas = null;
        this.minimapCtx = null;
        this.audio = new AudioSystem();

        this.state = 'menu';
        this.currentLevel = null;
        this.currentLevelIndex = 0;

        this.map = [];
        this.mapW = 0;
        this.mapH = 0;
        this.entities = [];
        this.projectiles = [];
        this.explosions = [];

        this.playerCredits = 0;
        this.enemyCredits = 0;
        this.playerPower = 0;
        this.playerPowerUsed = 0;
        this.enemyPower = 0;
        this.enemyPowerUsed = 0;

        this.selectedEntities = [];
        this.camera = { x: 0, y: 0 };
        this.targetCamera = { x: 0, y: 0 };

        this.gameTime = 0;
        this.tickCount = 0;
        this.lastTime = 0;
        this.dt = 0;

        this.buildTab = 'structures';
        this.placingBuilding = null;
        this.placementValid = false;

        this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, dragging: false, dragStartX: 0, dragStartY: 0 };
        this.keys = {};
        this.unitGroups = {};

        this.messages = [];
        this.levelProgress = this.loadProgress();

        this.ai = null;
        this.aiTimer = 0;
        this.aiWaveTimer = 0;

        this.victory = false;
        this.defeat = false;
        this.warmupFrames = 120;
        this.levelStartTime = 0;

        this.fogMap = [];

        this.debugLog = [];
        this.log('Game constructed');
    }

    log(msg) {
        const t = Date.now();
        this.debugLog.push(`[${t}] ${msg}`);
        if (this.debugLog.length > 50) this.debugLog.shift();
        console.log(`[RedStorm] ${msg}`);
    }

    loadProgress() {
        try {
            const data = localStorage.getItem('redstorm_progress');
            return data ? JSON.parse(data) : { completed: [], maxUnlocked: 1 };
        } catch { return { completed: [], maxUnlocked: 1 }; }
    }

    saveProgress() {
        try { localStorage.setItem('redstorm_progress', JSON.stringify(this.levelProgress)); } catch {}
    }

    init(canvas, minimapCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.minimapCanvas = minimapCanvas;
        this.minimapCtx = minimapCanvas.getContext('2d');
        this.log('Game initialized');
    }

    loadLevel(levelIndex) {
        this.log(`loadLevel called with index ${levelIndex}`);

        const level = LEVELS[levelIndex - 1];
        if (!level) {
            this.log('ERROR: Level not found!');
            return;
        }

        this.currentLevel = level;
        this.currentLevelIndex = levelIndex;
        this.victory = false;
        this.defeat = false;
        this.warmupFrames = 120;
        this.levelStartTime = performance.now();

        this.entities = [];
        this.projectiles = [];
        this.explosions = [];
        this.selectedEntities = [];
        this.messages = [];
        this.gameTime = 0;
        this.tickCount = 0;
        this.lastTime = 0;
        this.dt = 0;
        this.placingBuilding = null;
        entityIdCounter = 0;

        this.mapW = level.mapSize.w;
        this.mapH = level.mapSize.h;
        this.map = generateMap(level);

        this.fogMap = [];
        for (let y = 0; y < this.mapH; y++) {
            this.fogMap[y] = new Array(this.mapW).fill(0);
        }

        this.playerCredits = level.playerCredits;
        this.enemyCredits = level.enemyCredits;
        this.playerPower = 0;
        this.playerPowerUsed = 0;
        this.enemyPower = 0;
        this.enemyPowerUsed = 0;

        let playerBuildingCount = 0;
        for (const b of level.playerBuildings) {
            this.spawnBuilding(b.type, b.x, b.y, TEAM.PLAYER);
            playerBuildingCount++;
        }
        this.log(`Spawned ${playerBuildingCount} player buildings`);

        for (const u of level.playerUnits) {
            this.spawnUnit(u.type, u.x, u.y, TEAM.PLAYER);
        }

        let enemyBuildingCount = 0;
        for (const b of level.enemyBuildings) {
            this.spawnBuilding(b.type, b.x, b.y, TEAM.ENEMY);
            enemyBuildingCount++;
        }
        this.log(`Spawned ${enemyBuildingCount} enemy buildings`);

        for (const u of level.enemyUnits) {
            this.spawnUnit(u.type, u.x, u.y, TEAM.ENEMY);
        }

        const canvasW = this.canvas ? this.canvas.width : (window.innerWidth - 256);
        const canvasH = this.canvas ? this.canvas.height : window.innerHeight;
        this.camera.x = level.playerStart.x * TILE_SIZE - canvasW / 2;
        this.camera.y = level.playerStart.y * TILE_SIZE - canvasH / 2;
        this.targetCamera.x = this.camera.x;
        this.targetCamera.y = this.camera.y;

        this.updateFogOfWar();

        this.ai = {
            difficulty: level.aiDifficulty,
            buildQueue: [],
            attackWaves: [],
            waveInterval: Math.max(300, 600 - level.aiDifficulty * 400),
            attackGroups: [],
            state: 'build',
            stateTimer: 0,
        };
        this.aiTimer = 0;
        this.aiWaveTimer = 0;

        this.log(`Level ${levelIndex} (${level.name}) loaded. Total entities: ${this.entities.length}`);
        this.log(`Player buildings: ${this.entities.filter(e=>e.team===TEAM.PLAYER&&e.isBuilding&&!e.dead).length}`);
        this.log(`Enemy buildings: ${this.entities.filter(e=>e.team===TEAM.ENEMY&&e.isBuilding&&!e.dead).length}`);
        this.log(`Victory condition: ${level.victoryCondition}`);

        this.resize();
    }

    spawnBuilding(type, tileX, tileY, team) {
        const entity = new Entity({
            type, category: 'building', team, tileX, tileY
        });
        entity.x = tileX * TILE_SIZE + (entity.sizeW * TILE_SIZE) / 2;
        entity.y = tileY * TILE_SIZE + (entity.sizeH * TILE_SIZE) / 2;
        this.entities.push(entity);
        this.reserveTiles(entity);
        return entity;
    }

    spawnUnit(type, tileX, tileY, team) {
        const entity = new Entity({
            type, category: 'unit', team, tileX, tileY
        });
        entity.x = tileX * TILE_SIZE + TILE_SIZE / 2;
        entity.y = tileY * TILE_SIZE + TILE_SIZE / 2;
        entity.spawnTime = this.gameTime;
        this.entities.push(entity);
        return entity;
    }

    reserveTiles(entity) {
        for (let dy = 0; dy < entity.sizeH; dy++) {
            for (let dx = 0; dx < entity.sizeW; dx++) {
                const tx = entity.tileX + dx;
                const ty = entity.tileY + dy;
                if (ty >= 0 && ty < this.mapH && tx >= 0 && tx < this.mapW) {
                    this.map[ty][tx] = T.WALL;
                }
            }
        }
    }

    freeTiles(entity) {
        for (let dy = 0; dy < (entity.sizeH || 1); dy++) {
            for (let dx = 0; dx < (entity.sizeW || 1); dx++) {
                const tx = entity.tileX + dx;
                const ty = entity.tileY + dy;
                if (ty >= 0 && ty < this.mapH && tx >= 0 && tx < this.mapW) {
                    if (this.map[ty][tx] === T.WALL) this.map[ty][tx] = T.GRASS;
                }
            }
        }
    }

    buildingExists(type, team) {
        return this.entities.some(e => e.type === type && e.team === team && !e.dead && e.buildProgress >= 100);
    }

    hasPrerequisite(prereq, team) {
        if (!prereq) return true;
        return this.buildingExists(prereq, team);
    }

    update(timestamp) {
        if (this.state !== 'playing') return;
        if (!this.lastTime) this.lastTime = timestamp;

        this.dt = Math.min((timestamp - this.lastTime) / (1000 / 60), 3);
        this.lastTime = timestamp;
        this.gameTime += 1 / 60;
        this.tickCount++;

        this.updateCamera();
        this.updateSelection();
        this.updateUnits();
        this.updateBuildings();
        this.updateCombat();
        this.updateProjectiles();
        this.updateExplosions();
        this.updateHarvesters();
        this.updateFogOfWar();
        this.updatePower();
        this.updateAI(timestamp);

        // CRITICAL: Only check victory after BOTH warmup frames AND minimum time
        if (this.warmupFrames > 0) {
            this.warmupFrames--;
        } else if (this.gameTime < 5.0) {
            // Additional safety: no victory/defeat before 5 seconds of game time
        } else {
            this.checkVictoryDefeat();
        }

        this.entities = this.entities.filter(e => !e.dead || e.deathTimer < 30);
        this.entities.forEach(e => { if (e.dead) e.deathTimer++; });
    }

    updateCamera() {
        const spd = 10;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) this.targetCamera.y -= spd;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) this.targetCamera.y += spd;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.targetCamera.x -= spd;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) this.targetCamera.x += spd;

        if (!this.canvas) return;
        const maxX = this.mapW * TILE_SIZE - this.canvas.width;
        const maxY = this.mapH * TILE_SIZE - this.canvas.height;
        this.targetCamera.x = clamp(this.targetCamera.x, 0, Math.max(0, maxX));
        this.targetCamera.y = clamp(this.targetCamera.y, 0, Math.max(0, maxY));

        this.camera.x += (this.targetCamera.x - this.camera.x) * 0.15;
        this.camera.y += (this.targetCamera.y - this.camera.y) * 0.15;
    }

    updateSelection() {
        this.selectedEntities = this.selectedEntities.filter(e => !e.dead);
    }

    updateUnits() {
        for (const entity of this.entities) {
            if (entity.dead || !entity.isUnit) continue;
            entity.animFrame += 0.02;

            if (entity.path.length > 0) {
                const next = entity.path[0];
                const nx = next.x * TILE_SIZE + TILE_SIZE / 2;
                const ny = next.y * TILE_SIZE + TILE_SIZE / 2;
                entity.facing = angle(entity.x, entity.y, nx, ny);

                const d = dist(entity.x, entity.y, nx, ny);
                if (d < 4) {
                    entity.path.shift();
                } else {
                    const moveAmount = entity.speed * this.dt;
                    const a = angle(entity.x, entity.y, nx, ny);
                    entity.x += Math.cos(a) * moveAmount;
                    entity.y += Math.sin(a) * moveAmount;
                    entity.tileX = Math.floor(entity.x / TILE_SIZE);
                    entity.tileY = Math.floor(entity.y / TILE_SIZE);
                }
            } else if (entity.targetX !== null && entity.targetY !== null) {
                const d = dist(entity.x, entity.y, entity.targetX, entity.targetY);
                if (d > 4) {
                    const a = angle(entity.x, entity.y, entity.targetX, entity.targetY);
                    entity.x += Math.cos(a) * entity.speed * this.dt;
                    entity.y += Math.sin(a) * entity.speed * this.dt;
                    entity.tileX = Math.floor(entity.x / TILE_SIZE);
                    entity.tileY = Math.floor(entity.y / TILE_SIZE);
                } else {
                    entity.targetX = null;
                    entity.targetY = null;
                }
            }

            if (entity.attackTarget && !entity.attackTarget.dead) {
                const d = dist(entity.x, entity.y, entity.attackTarget.x, entity.attackTarget.y);
                if (d > entity.attackRange * 0.9 && entity.path.length === 0) {
                    const tx = Math.floor(entity.attackTarget.x / TILE_SIZE);
                    const ty = Math.floor(entity.attackTarget.y / TILE_SIZE);
                    entity.path = findPath(this.map,
                        Math.floor(entity.x / TILE_SIZE), Math.floor(entity.y / TILE_SIZE),
                        tx, ty,
                        this.entities.filter(e => e.isBuilding && !e.dead),
                        this.mapW, this.mapH
                    );
                }
            }
        }
    }

    updateBuildings() {
        for (const entity of this.entities) {
            if (entity.dead || !entity.isBuilding) continue;

            if (entity.beingBuilt) {
                entity.buildProgress += this.dt * (100 / (entity.buildTime * 60));
                if (entity.buildProgress >= 100) {
                    entity.buildProgress = 100;
                    entity.beingBuilt = false;
                    entity.hp = entity.maxHp;
                    this.audio.play('build');
                    this.addMessage(`${entity.name} complete!`, 'success');
                    if (entity.type === 'ore_refinery' && entity.spawnsUnit) {
                        const hx = entity.tileX + entity.sizeW;
                        const hy = entity.tileY + entity.sizeH - 1;
                        this.spawnUnit('harvester', hx, hy, entity.team);
                    }
                } else {
                    entity.hp = entity.maxHp * (entity.buildProgress / 100);
                }
            }

            if (entity.productionQueue.length > 0 && !entity.beingBuilt && entity.buildProgress >= 100) {
                if (!entity.productionItem) {
                    entity.productionItem = entity.productionQueue.shift();
                    entity.productionProgress = 0;
                }

                const def = UNITS[entity.productionItem];
                if (def) {
                    const buildTime = def.buildTime * 60;
                    const powerFactor = (entity.team === TEAM.PLAYER) ?
                        (this.playerPower >= this.playerPowerUsed ? 1 : 0.5) : 1;

                    entity.productionProgress += this.dt * (100 / buildTime) * powerFactor;

                    if (entity.productionProgress >= 100) {
                        entity.productionProgress = 100;
                        const sx = entity.tileX + entity.sizeW;
                        const sy = entity.tileY + entity.sizeH - 1;
                        let spawnX = sx, spawnY = sy;
                        for (let r = 0; r < 5; r++) {
                            let found = false;
                            for (let dy = -r; dy <= r && !found; dy++) {
                                for (let dx = -r; dx <= r && !found; dx++) {
                                    const tx = sx + dx, ty = sy + dy;
                                    if (ty >= 0 && ty < this.mapH && tx >= 0 && tx < this.mapW && TILE_WALKABLE[this.map[ty][tx]]) {
                                        spawnX = tx; spawnY = ty; found = true;
                                    }
                                }
                            }
                            if (found) break;
                        }
                        this.spawnUnit(entity.productionItem, spawnX, spawnY, entity.team);
                        if (entity.team === TEAM.PLAYER) {
                            this.addMessage(`${def.name} trained!`, 'success');
                            this.audio.play('build');
                        }
                        entity.productionItem = null;
                        entity.productionProgress = 0;
                    }
                }
            }
        }
    }

    updateCombat() {
        for (const entity of this.entities) {
            if (entity.dead || !entity.canAttack) continue;
            if (entity.beingBuilt) continue;
            if (entity.isBuilding && entity.buildProgress < 100) continue;

            if (entity.attackCooldown > 0) {
                entity.attackCooldown -= this.dt;
                continue;
            }

            if (!entity.attackTarget || entity.attackTarget.dead) {
                entity.attackTarget = this.findAttackTarget(entity);
            }

            if (!entity.attackTarget) continue;

            const target = entity.attackTarget;
            const d = dist(entity.x, entity.y, target.x, target.y);

            if (d <= entity.attackRange && this.hasLineOfSight(entity, target)) {
                this.fireProjectile(entity, target);
                entity.attackCooldown = entity.attackCooldownMax;
                entity.facing = angle(entity.x, entity.y, target.x, target.y);
            }
        }
    }

    findAttackTarget(entity) {
        let bestTarget = null;
        let bestDist = entity.attackRange * 1.5;

        for (const other of this.entities) {
            if (other.dead || other.team === entity.team) continue;
            if (other.isAir && !entity.antiAir) continue;

            const d = dist(entity.x, entity.y, other.x, other.y);
            if (d < bestDist) {
                if (other.attackTarget === entity) {
                    bestDist = d;
                    bestTarget = other;
                } else if (!bestTarget) {
                    bestDist = d;
                    bestTarget = other;
                }
            }
        }
        return bestTarget;
    }

    hasLineOfSight(a, b) {
        const steps = Math.ceil(dist(a.x, a.y, b.x, b.y) / (TILE_SIZE / 2));
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const x = a.x + (b.x - a.x) * t;
            const y = a.y + (b.y - a.y) * t;
            const tx = Math.floor(x / TILE_SIZE);
            const ty = Math.floor(y / TILE_SIZE);
            if (ty >= 0 && ty < this.mapH && tx >= 0 && tx < this.mapW) {
                const tile = this.map[ty][tx];
                if (tile === T.ROCK || tile === T.WATER) return false;
            }
        }
        return true;
    }

    fireProjectile(attacker, target) {
        this.projectiles.push(new Projectile({
            x: attacker.x, y: attacker.y,
            targetX: target.x, targetY: target.y,
            target, damage: attacker.attackDamage,
            splash: attacker.splash, owner: attacker, team: attacker.team,
        }));
        this.audio.play('attack');
    }

    updateProjectiles() {
        for (const proj of this.projectiles) {
            if (proj.dead) continue;
            proj.x += proj.dx * this.dt;
            proj.y += proj.dy * this.dt;
            const d = dist(proj.x, proj.y, proj.targetX, proj.targetY);
            if (d < 12 || !proj.target || proj.target.dead) {
                this.applyProjectileHit(proj);
                proj.dead = true;
            }
        }
        this.projectiles = this.projectiles.filter(p => !p.dead);
    }

    applyProjectileHit(proj) {
        if (proj.splash > 0) {
            this.explosions.push({ x: proj.x, y: proj.y, radius: proj.splash, timer: 15 });
            this.audio.play('explosion');
            for (const entity of this.entities) {
                if (entity.dead || entity.team === proj.team) continue;
                const d = dist(entity.x, entity.y, proj.x, proj.y);
                if (d <= proj.splash) {
                    this.dealDamage(entity, proj.damage * (1 - d / proj.splash * 0.5));
                }
            }
        } else if (proj.target && !proj.target.dead) {
            this.dealDamage(proj.target, proj.damage);
            this.explosions.push({ x: proj.x, y: proj.y, radius: 8, timer: 8 });
        }
    }

    dealDamage(entity, damage) {
        const armor = entity.armor || 0;
        entity.hp -= Math.max(1, damage - armor * 0.5);
        if (entity.hp <= 0) this.killEntity(entity);
    }

    killEntity(entity) {
        entity.hp = 0;
        entity.dead = true;
        entity.deathTimer = 0;
        if (entity.isBuilding) {
            this.freeTiles(entity);
            this.explosions.push({ x: entity.x, y: entity.y, radius: entity.sizeW * TILE_SIZE, timer: 30 });
            this.audio.play('explosion');
        } else {
            this.explosions.push({ x: entity.x, y: entity.y, radius: 12, timer: 15 });
        }
        this.selectedEntities = this.selectedEntities.filter(e => e !== entity);
        if (entity.isHarvester && entity.ore > 0 && entity.team === TEAM.PLAYER) {
            this.playerCredits += Math.floor(entity.ore * 5);
        }
    }

    updateExplosions() {
        for (const e of this.explosions) e.timer--;
        this.explosions = this.explosions.filter(e => e.timer > 0);
    }

    updateHarvesters() {
        for (const entity of this.entities) {
            if (entity.dead || !entity.isHarvester || entity.beingBuilt) continue;
            if (entity.attackTarget) continue;

            if (entity.team === TEAM.ENEMY) {
                this.updateAIHarvester(entity);
                continue;
            }

            if (entity.ore >= entity.oreCapacity) {
                if (!entity.returning) {
                    entity.returning = true;
                    entity.harvesting = false;
                    entity.harvestTarget = null;
                    const refinery = this.entities.find(e =>
                        e.type === 'ore_refinery' && e.team === TEAM.PLAYER && !e.dead && e.buildProgress >= 100
                    );
                    if (refinery) {
                        entity.path = findPath(this.map,
                            Math.floor(entity.x / TILE_SIZE), Math.floor(entity.y / TILE_SIZE),
                            refinery.tileX + refinery.sizeW - 1, refinery.tileY,
                            this.entities.filter(e => e.isBuilding && !e.dead),
                            this.mapW, this.mapH
                        );
                    }
                }
                const refinery = this.entities.find(e =>
                    e.type === 'ore_refinery' && e.team === TEAM.PLAYER && !e.dead && e.buildProgress >= 100
                );
                if (refinery && dist(entity.x, entity.y, refinery.x, refinery.y) < TILE_SIZE * 2) {
                    const credits = Math.floor(entity.ore * 5);
                    this.playerCredits += credits;
                    entity.ore = 0;
                    entity.returning = false;
                    entity.path = [];
                    this.addMessage(`+$${credits}`, 'success');
                }
            } else if (!entity.harvesting) {
                entity.returning = false;
                const oreTile = this.findNearestOre(entity);
                if (oreTile) {
                    entity.harvesting = true;
                    entity.harvestTarget = oreTile;
                    entity.path = findPath(this.map,
                        Math.floor(entity.x / TILE_SIZE), Math.floor(entity.y / TILE_SIZE),
                        oreTile.x, oreTile.y,
                        this.entities.filter(e => e.isBuilding && !e.dead),
                        this.mapW, this.mapH
                    );
                }
            } else {
                if (entity.harvestTarget) {
                    const d = dist(entity.x, entity.y,
                        entity.harvestTarget.x * TILE_SIZE + TILE_SIZE / 2,
                        entity.harvestTarget.y * TILE_SIZE + TILE_SIZE / 2);
                    if (d < TILE_SIZE) {
                        if (this.map[entity.harvestTarget.y]?.[entity.harvestTarget.x] === T.ORE) {
                            entity.ore = Math.min(entity.ore + 0.1 * this.dt, entity.oreCapacity);
                        } else {
                            entity.harvesting = false;
                            entity.harvestTarget = null;
                            entity.path = [];
                        }
                    }
                    if (entity.path.length === 0 && d > TILE_SIZE) {
                        entity.harvesting = false;
                        entity.harvestTarget = null;
                    }
                } else {
                    entity.harvesting = false;
                }
            }
        }
    }

    updateAIHarvester(entity) {
        if (entity.ore >= entity.oreCapacity) {
            if (!entity.returning) {
                entity.returning = true;
                entity.harvesting = false;
                const refinery = this.entities.find(e =>
                    e.type === 'ore_refinery' && e.team === TEAM.ENEMY && !e.dead && e.buildProgress >= 100
                );
                if (refinery) {
                    entity.path = findPath(this.map,
                        Math.floor(entity.x / TILE_SIZE), Math.floor(entity.y / TILE_SIZE),
                        refinery.tileX + refinery.sizeW - 1, refinery.tileY,
                        this.entities.filter(e => e.isBuilding && !e.dead),
                        this.mapW, this.mapH
                    );
                }
            }
            const refinery = this.entities.find(e =>
                e.type === 'ore_refinery' && e.team === TEAM.ENEMY && !e.dead && e.buildProgress >= 100
            );
            if (refinery && dist(entity.x, entity.y, refinery.x, refinery.y) < TILE_SIZE * 2) {
                this.enemyCredits += Math.floor(entity.ore * 5);
                entity.ore = 0;
                entity.returning = false;
                entity.path = [];
            }
        } else if (!entity.harvesting) {
            entity.returning = false;
            const oreTile = this.findNearestOre(entity);
            if (oreTile) {
                entity.harvesting = true;
                entity.harvestTarget = oreTile;
                entity.path = findPath(this.map,
                    Math.floor(entity.x / TILE_SIZE), Math.floor(entity.y / TILE_SIZE),
                    oreTile.x, oreTile.y,
                    this.entities.filter(e => e.isBuilding && !e.dead),
                    this.mapW, this.mapH
                );
            }
        } else if (entity.harvestTarget) {
            const d = dist(entity.x, entity.y,
                entity.harvestTarget.x * TILE_SIZE + TILE_SIZE / 2,
                entity.harvestTarget.y * TILE_SIZE + TILE_SIZE / 2);
            if (d < TILE_SIZE && this.map[entity.harvestTarget.y]?.[entity.harvestTarget.x] === T.ORE) {
                entity.ore = Math.min(entity.ore + 0.1 * this.dt, entity.oreCapacity);
            } else {
                entity.harvesting = false;
                entity.harvestTarget = null;
                entity.path = [];
            }
        }
    }

    findNearestOre(entity) {
        let best = null, bestDist = Infinity;
        for (let y = 0; y < this.mapH; y++) {
            for (let x = 0; x < this.mapW; x++) {
                if (this.map[y][x] === T.ORE) {
                    const d = dist(entity.x, entity.y, x * TILE_SIZE, y * TILE_SIZE);
                    if (d < bestDist && d < TILE_SIZE * 30) {
                        bestDist = d;
                        best = { x, y };
                    }
                }
            }
        }
        return best;
    }

    updatePower() {
        this.playerPower = 0; this.playerPowerUsed = 0;
        this.enemyPower = 0; this.enemyPowerUsed = 0;
        for (const entity of this.entities) {
            if (entity.dead || !entity.isBuilding || entity.buildProgress < 100) continue;
            if (entity.team === TEAM.PLAYER) {
                this.playerPower += entity.powerProvided;
                this.playerPowerUsed += entity.powerUsed;
            } else {
                this.enemyPower += entity.powerProvided;
                this.enemyPowerUsed += entity.powerUsed;
            }
        }
    }

    updateFogOfWar() {
        for (let y = 0; y < this.mapH; y++) {
            for (let x = 0; x < this.mapW; x++) {
                if (this.fogMap[y][x] === 2) this.fogMap[y][x] = 1;
            }
        }
        for (const entity of this.entities) {
            if (entity.dead || entity.team !== TEAM.PLAYER) continue;
            if (entity.beingBuilt && entity.buildProgress < 50) continue;
            const vr = entity.isBuilding ? (entity.provides === 'radar' ? 15 : 8) : 7;
            const cx = Math.floor(entity.x / TILE_SIZE);
            const cy = Math.floor(entity.y / TILE_SIZE);
            for (let dy = -vr; dy <= vr; dy++) {
                for (let dx = -vr; dx <= vr; dx++) {
                    const tx = cx + dx, ty = cy + dy;
                    if (tx >= 0 && tx < this.mapW && ty >= 0 && ty < this.mapH) {
                        if (dx * dx + dy * dy <= vr * vr) this.fogMap[ty][tx] = 2;
                    }
                }
            }
        }
        for (const entity of this.entities) {
            if (entity.team === TEAM.PLAYER) { entity.visible = true; continue; }
            const tx = Math.floor(entity.x / TILE_SIZE);
            const ty = Math.floor(entity.y / TILE_SIZE);
            entity.visible = (this.fogMap[ty]?.[tx] || 0) >= 2;
        }
    }

    checkVictoryDefeat() {
        if (this.victory || this.defeat) return;
        const level = this.currentLevel;
        if (!level) return;

        const enemyBuildings = this.entities.filter(e => e.team === TEAM.ENEMY && e.isBuilding && !e.dead);
        const playerBuildings = this.entities.filter(e => e.team === TEAM.PLAYER && e.isBuilding && !e.dead);
        const playerUnits = this.entities.filter(e => e.team === TEAM.PLAYER && e.isUnit && !e.dead);

        this.log(`Victory check: enemyBuildings=${enemyBuildings.length}, playerBuildings=${playerBuildings.length}, playerUnits=${playerUnits.length}, gameTime=${this.gameTime.toFixed(1)}`);

        if (level.timeLimit > 0 && this.gameTime >= level.timeLimit) {
            this.log('DEFEAT: Time limit exceeded');
            this.defeat = true;
            this.audio.play('defeat');
            this.addMessage('TIME LIMIT EXPIRED!', 'warning');
            return;
        }

        if (level.victoryCondition === 'survive_time' && this.gameTime >= level.surviveTime) {
            this.log('VICTORY: Survived required time');
            this.victory = true;
            this.audio.play('victory');
            this.addMessage('MISSION COMPLETE!', 'success');
            this.onLevelComplete();
            return;
        }

        if (level.victoryCondition === 'destroy_all') {
            if (enemyBuildings.length === 0) {
                this.log('VICTORY: All enemy buildings destroyed');
                this.victory = true;
                this.audio.play('victory');
                this.addMessage('MISSION COMPLETE!', 'success');
                this.onLevelComplete();
                return;
            }
        }

        if (level.victoryCondition === 'destroy_building_type') {
            const target = this.entities.find(e =>
                e.type === level.destroyTarget && e.team === TEAM.ENEMY && !e.dead
            );
            if (!target) {
                this.log('VICTORY: Target building destroyed');
                this.victory = true;
                this.audio.play('victory');
                this.addMessage('MISSION COMPLETE!', 'success');
                this.onLevelComplete();
                return;
            }
        }

        if (!level.noBase) {
            if (playerBuildings.length === 0 && playerUnits.length === 0) {
                this.log('DEFEAT: Player has no buildings or units');
                this.defeat = true;
                this.audio.play('defeat');
                this.addMessage('MISSION FAILED!', 'warning');
                return;
            }
        } else {
            if (playerUnits.length === 0) {
                this.log('DEFEAT: Player has no units (no-base mission)');
                this.defeat = true;
                this.audio.play('defeat');
                return;
            }
        }
    }

    onLevelComplete() {
        const idx = this.currentLevelIndex;
        if (!this.levelProgress.completed.includes(idx)) {
            this.levelProgress.completed.push(idx);
        }
        if (idx + 1 > this.levelProgress.maxUnlocked) {
            this.levelProgress.maxUnlocked = Math.min(20, idx + 1);
        }
        this.saveProgress();
    }

    updateAI(timestamp) {
        if (!this.ai || this.victory || this.defeat) return;
        const diff = this.ai.difficulty;
        this.aiTimer++;

        if (this.aiTimer % Math.floor(300 / Math.max(0.1, diff)) === 0) this.aiBuildStructure();
        if (this.aiTimer % Math.floor(150 / Math.max(0.1, diff)) === 0) this.aiProduceUnit();

        this.aiWaveTimer++;
        const waveInterval = Math.max(200, 900 - diff * 700);
        if (this.aiWaveTimer >= waveInterval) {
            this.aiWaveTimer = 0;
            this.aiLaunchAttack();
        }
    }

    aiBuildStructure() {
        const diff = this.ai.difficulty;
        const cy = this.entities.find(e =>
            e.type === 'construction_yard' && e.team === TEAM.ENEMY && !e.dead && !e.beingBuilt && e.buildProgress >= 100
        );
        if (!cy || cy.productionItem) return;

        const priority = ['power_plant', 'ore_refinery', 'barracks', 'war_factory',
                          'turret', 'pillbox', 'advanced_power', 'radar_dome', 'tech_center'];

        for (const type of priority) {
            if (Math.random() > diff) continue;
            if (this.buildingExists(type, TEAM.ENEMY)) continue;
            const def = BUILDINGS[type];
            if (!def) continue;
            if (this.enemyCredits < def.cost * 1.2) continue;
            if (def.prerequisite && !this.buildingExists(def.prerequisite, TEAM.ENEMY)) continue;

            const spot = this.aiFindBuildSpot(cy, def.size.w, def.size.h);
            if (!spot) continue;

            const wx = spot.x * TILE_SIZE;
            const wy = spot.y * TILE_SIZE;
            if (this.canPlaceBuilding(type, wx, wy, TEAM.ENEMY)) {
                this.enemyCredits -= def.cost;
                const building = this.spawnBuilding(type, spot.x, spot.y, TEAM.ENEMY);
                building.beingBuilt = true;
                building.buildProgress = 0;
                building.hp = 1;
                return;
            }
        }
    }

    aiFindBuildSpot(cy, w, h) {
        const candidates = [];
        for (let r = 2; r < 12; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) === r || Math.abs(dy) === r) {
                        candidates.push({ x: cy.tileX + dx, y: cy.tileY + dy });
                    }
                }
            }
        }
        candidates.sort((a, b) => manhattanDist(a.x, a.y, cy.tileX, cy.tileY) - manhattanDist(b.x, b.y, cy.tileX, cy.tileY));
        return candidates.find(s => {
            const wx = s.x * TILE_SIZE;
            const wy = s.y * TILE_SIZE;
            return this.canPlaceBuilding('power_plant', wx, wy, TEAM.ENEMY, w, h);
        });
    }

    aiProduceUnit() {
        for (const building of this.entities) {
            if (building.dead || building.team !== TEAM.ENEMY || building.beingBuilt || building.buildProgress < 100) continue;
            if (building.productionQueue.length >= 3) continue;

            if (building.type === 'barracks') {
                const types = ['infantry', 'rocket_soldier', 'grenadier'];
                const type = types[Math.floor(Math.random() * types.length)];
                const def = UNITS[type];
                if (def && this.enemyCredits >= def.cost) {
                    this.enemyCredits -= def.cost;
                    building.productionQueue.push(type);
                }
            } else if (building.type === 'war_factory') {
                let types = ['light_tank', 'heavy_tank'];
                if (Math.random() < 0.2) types.push('artillery');
                if (!this.entities.some(e => e.type === 'harvester' && e.team === TEAM.ENEMY && !e.dead)) types.push('harvester');
                const type = types[Math.floor(Math.random() * types.length)];
                const def = UNITS[type];
                if (def && this.enemyCredits >= def.cost) {
                    this.enemyCredits -= def.cost;
                    building.productionQueue.push(type);
                }
            }
        }
    }

    aiLaunchAttack() {
        const diff = this.ai.difficulty;
        const units = this.entities.filter(e =>
            e.team === TEAM.ENEMY && !e.dead && e.isUnit && e.canAttack && !e.isHarvester &&
            (!e.attackTarget || e.attackTarget.dead) && e.path.length === 0
        );
        if (units.length < 2) return;

        const targets = this.entities.filter(e => e.team === TEAM.PLAYER && !e.dead && e.isBuilding);
        if (targets.length === 0) return;

        const target = targets[Math.floor(Math.random() * targets.length)];
        const attackGroup = units.slice(0, Math.ceil(units.length * diff));

        for (const unit of attackGroup) {
            unit.path = findPath(this.map,
                Math.floor(unit.x / TILE_SIZE), Math.floor(unit.y / TILE_SIZE),
                Math.floor(target.x / TILE_SIZE) + randInt(-2, 2),
                Math.floor(target.y / TILE_SIZE) + randInt(-2, 2),
                this.entities.filter(e => e.isBuilding && !e.dead),
                this.mapW, this.mapH
            );
            unit.attackTarget = target;
        }
    }

    handleMouseDown(x, y, button) {
        this.audio.resume();
        if (button === 0) {
            this.mouse.dragging = false;
            this.mouse.dragStartX = x;
            this.mouse.dragStartY = y;
        }
    }

    handleMouseUp(x, y, button) {
        const worldX = x + this.camera.x;
        const worldY = y + this.camera.y;

        if (button === 0) {
            const dx = Math.abs(x - this.mouse.dragStartX);
            const dy = Math.abs(y - this.mouse.dragStartY);
            if (dx > 10 || dy > 10) {
                this.boxSelect(
                    this.mouse.dragStartX + this.camera.x, this.mouse.dragStartY + this.camera.y,
                    worldX, worldY
                );
            } else {
                this.clickSelect(worldX, worldY);
            }
        } else if (button === 2) {
            this.rightClick(worldX, worldY);
        }
        this.audio.play('click');
    }

    handleMouseMove(x, y) {
        this.mouse.x = x;
        this.mouse.y = y;
        this.mouse.worldX = x + this.camera.x;
        this.mouse.worldY = y + this.camera.y;
        this.mouse.dragging = Math.abs(x - this.mouse.dragStartX) > 10 || Math.abs(y - this.mouse.dragStartY) > 10;
    }

    clickSelect(worldX, worldY) {
        for (const e of this.selectedEntities) e.selected = false;
        this.selectedEntities = [];
        this.placingBuilding = null;

        const clicked = this.findEntityAt(worldX, worldY, TEAM.PLAYER);
        if (clicked) {
            clicked.selected = true;
            this.selectedEntities = [clicked];
        }
    }

    boxSelect(x1, y1, x2, y2) {
        for (const e of this.selectedEntities) e.selected = false;
        this.selectedEntities = [];

        const left = Math.min(x1, x2), right = Math.max(x1, x2);
        const top = Math.min(y1, y2), bottom = Math.max(y1, y2);

        for (const entity of this.entities) {
            if (entity.dead || entity.team !== TEAM.PLAYER || !entity.isUnit) continue;
            if (entity.x >= left && entity.x <= right && entity.y >= top && entity.y <= bottom) {
                entity.selected = true;
                this.selectedEntities.push(entity);
            }
        }
    }

    rightClick(worldX, worldY) {
        if (this.selectedEntities.length === 0) return;

        if (this.placingBuilding && this.placementValid) {
            this.placeBuildingAt(worldX, worldY);
            return;
        }

        const target = this.findEntityAt(worldX, worldY);
        if (target && target.team !== TEAM.PLAYER && target.visible) {
            for (const entity of this.selectedEntities) {
                if (entity.canAttack) {
                    entity.attackTarget = target;
                    entity.path = [];
                }
            }
        } else {
            const tx = Math.floor(worldX / TILE_SIZE);
            const ty = Math.floor(worldY / TILE_SIZE);
            for (const entity of this.selectedEntities) {
                if (!entity.isUnit) continue;
                entity.path = findPath(this.map,
                    Math.floor(entity.x / TILE_SIZE), Math.floor(entity.y / TILE_SIZE),
                    tx, ty,
                    this.entities.filter(e => e.isBuilding && !e.dead),
                    this.mapW, this.mapH
                );
                entity.targetX = worldX;
                entity.targetY = worldY;
            }
        }
    }

    findEntityAt(worldX, worldY, teamFilter = null) {
        let best = null, bestDist = Infinity;
        for (const entity of this.entities) {
            if (entity.dead) continue;
            if (teamFilter !== null && entity.team !== teamFilter) continue;
            if (teamFilter === TEAM.PLAYER && entity.team !== TEAM.PLAYER && !entity.visible) continue;

            const radius = entity.isBuilding ?
                Math.max(entity.sizeW, entity.sizeH) * TILE_SIZE / 2 :
                TILE_SIZE / 2 * entity.size;
            const d = dist(worldX, worldY, entity.x, entity.y);
            if (d < radius && d < bestDist) {
                bestDist = d;
                best = entity;
            }
        }
        return best;
    }

    canPlaceBuilding(type, worldX, worldY, team, sizeW, sizeH) {
        const def = BUILDINGS[type];
        if (!def) return false;
        const w = sizeW || def.size.w;
        const h = sizeH || def.size.h;
        const tx = Math.floor(worldX / TILE_SIZE);
        const ty = Math.floor(worldY / TILE_SIZE);

        if (tx < 0 || ty < 0 || tx + w > this.mapW || ty + h > this.mapH) return false;

        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const tile = this.map[ty + dy]?.[tx + dx];
                if (tile === undefined || (!TILE_WALKABLE[tile] && tile !== T.WALL)) return false;
            }
        }

        for (const entity of this.entities) {
            if (entity.dead || !entity.isBuilding) continue;
            const ew = entity.sizeW, eh = entity.sizeH;
            if (tx < entity.tileX + ew && tx + w > entity.tileX &&
                ty < entity.tileY + eh && ty + h > entity.tileY) {
                return false;
            }
        }

        let adjacent = false;
        for (const entity of this.entities) {
            if (entity.dead || !entity.isBuilding || entity.team !== team || entity.beingBuilt) continue;
            const ew = entity.sizeW, eh = entity.sizeH;
            const cx1 = tx + w / 2, cy1 = ty + h / 2;
            const cx2 = entity.tileX + ew / 2, cy2 = entity.tileY + eh / 2;
            if (manhattanDist(cx1, cy1, cx2, cy2) <= Math.max(w, h) + 3) {
                adjacent = true;
                break;
            }
        }
        return adjacent;
    }

    placeBuildingAt(worldX, worldY) {
        if (!this.placingBuilding) return;
        const type = this.placingBuilding;
        const def = BUILDINGS[type];
        if (!def) return;
        const tx = Math.floor(worldX / TILE_SIZE);
        const ty = Math.floor(worldY / TILE_SIZE);

        if (!this.canPlaceBuilding(type, worldX, worldY, TEAM.PLAYER)) {
            this.addMessage('Cannot build here!', 'warning');
            this.audio.play('error');
            return;
        }
        if (this.playerCredits < def.cost) {
            this.addMessage('Not enough credits!', 'warning');
            this.audio.play('error');
            return;
        }
        if (def.prerequisite && !this.hasPrerequisite(def.prerequisite, TEAM.PLAYER)) {
            this.addMessage('Prerequisite not met!', 'warning');
            this.audio.play('error');
            return;
        }

        const cy = this.entities.find(e =>
            e.type === 'construction_yard' && e.team === TEAM.PLAYER && !e.dead && !e.beingBuilt
        );
        if (!cy) {
            this.addMessage('No Construction Yard!', 'warning');
            return;
        }

        this.playerCredits -= def.cost;
        const building = this.spawnBuilding(type, tx, ty, TEAM.PLAYER);
        building.beingBuilt = true;
        building.buildProgress = 0;
        building.hp = 1;
        this.placingBuilding = null;
        this.addMessage(`Building ${def.name}...`, '');
    }

    startPlacingBuilding(type) {
        const def = BUILDINGS[type];
        if (!def) return;
        if (this.playerCredits < def.cost) {
            this.addMessage('Not enough credits!', 'warning');
            this.audio.play('error');
            return;
        }
        if (def.prerequisite && !this.hasPrerequisite(def.prerequisite, TEAM.PLAYER)) {
            this.addMessage(`Requires ${BUILDINGS[def.prerequisite].name}!`, 'warning');
            this.audio.play('error');
            return;
        }
        this.placingBuilding = type;
    }

    trainUnit(type, producer) {
        const def = UNITS[type];
        if (!def || !producer || producer.dead || producer.team !== TEAM.PLAYER) return;
        if (producer.beingBuilt || producer.buildProgress < 100) return;
        if (this.playerCredits < def.cost) {
            this.addMessage('Not enough credits!', 'warning');
            this.audio.play('error');
            return;
        }
        this.playerCredits -= def.cost;
        producer.productionQueue.push(type);
    }

    sellBuilding(entity) {
        if (!entity || entity.dead || entity.team !== TEAM.PLAYER || !entity.isBuilding) return;
        if (entity.type === 'construction_yard') return;
        const refund = Math.floor(entity.cost * 0.5);
        this.playerCredits += refund;
        this.killEntity(entity);
        this.addMessage(`Sold for $${refund}`, '');
    }

    addMessage(text, type = '') {
        this.messages.push({ text, type, time: Date.now() });
        if (this.messages.length > 5) this.messages.shift();
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth - 256;
        this.canvas.height = window.innerHeight;
        if (this.minimapCanvas) {
            this.minimapCanvas.width = 234;
            this.minimapCanvas.height = Math.floor(234 * (this.mapH / this.mapW));
        }
    }

    handleKeyDown(key) {
        this.keys[key.code] = true;
        if (key.ctrlKey && key.code >= 'Digit1' && key.code <= 'Digit9') {
            const n = parseInt(key.code.replace('Digit', ''));
            if (this.selectedEntities.length > 0) this.unitGroups[n] = [...this.selectedEntities];
        }
        if (!key.ctrlKey && key.code >= 'Digit1' && key.code <= 'Digit9') {
            const n = parseInt(key.code.replace('Digit', ''));
            if (this.unitGroups[n]) {
                for (const e of this.selectedEntities) e.selected = false;
                this.selectedEntities = this.unitGroups[n].filter(e => !e.dead);
                for (const e of this.selectedEntities) e.selected = true;
            }
        }
        if (key.code === 'Delete') {
            for (const e of this.selectedEntities) this.sellBuilding(e);
        }
        if (key.code === 'Space' && this.selectedEntities.length > 0) {
            const sel = this.selectedEntities[0];
            this.targetCamera.x = sel.x - this.canvas.width / 2;
            this.targetCamera.y = sel.y - this.canvas.height / 2;
        }
        if (key.code === 'Escape') {
            this.placingBuilding = null;
            for (const e of this.selectedEntities) e.selected = false;
            this.selectedEntities = [];
        }
    }

    handleKeyUp(key) {
        this.keys[key.code] = false;
    }
}
