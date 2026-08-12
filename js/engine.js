import { 
    TILE_SIZE, T, TEAM, BUILDINGS, UNITS, TILE_WALKABLE,
    dist, manhattanDist, clamp, angle, randInt, randFloat,
    findPath, generateMap, AudioSystem
} from './utils.js';
import { LEVELS } from './levels.js';

// ===== ENTITY CLASS =====
let entityIdCounter = 0;

export class Entity {
    constructor(config) {
        this.id = entityIdCounter++;
        this.type = config.type;          // 'infantry', 'heavy_tank', 'construction_yard', etc.
        this.category = config.category;  // 'unit' or 'building'
        this.team = config.team;
        this.tileX = config.tileX;
        this.tileY = config.tileY;
        this.x = config.tileX * TILE_SIZE + TILE_SIZE / 2;
        this.y = config.tileY * TILE_SIZE + TILE_SIZE / 2;

        const def = this.category === 'building' ? BUILDINGS[config.type] : UNITS[config.type];
        this.name = def.name;
        this.icon = def.icon;
        this.maxHp = def.hp;
        this.hp = def.hp;
        this.cost = def.cost;

        this.attackDamage = def.attackDamage || 0;
        this.attackRange = (def.attackRange || 0) * TILE_SIZE;
        this.attackSpeed = def.attackSpeed || 0;
        this.armor = def.armor || 0;
        this.antiAir = def.antiAir || false;
        this.antiArmor = def.antiArmor || false;
        this.splash = (def.splash || 0) * TILE_SIZE;

        this.speed = (def.speed || 0) * 1.5;  // pixels per tick
        this.size = def.size || 1;
        this.isAir = def.isAir || false;
        this.isHarvester = def.isHarvester || false;
        this.canAttack = def.canAttack || false;
        this.canCapture = def.canCapture || false;
        this.canTransport = def.canTransport || false;
        this.isInvisible = def.isInvisible || false;
        this.producedAt = def.producedAt || null;
        this.prerequisite = def.prerequisite || null;

        // Building specific
        const bDef = BUILDINGS[config.type];
        if (bDef) {
            this.sizeW = bDef.size.w;
            this.sizeH = bDef.size.h;
            this.powerProvided = bDef.power > 0 ? bDef.power : 0;
            this.powerUsed = bDef.power < 0 ? -bDef.power : 0;
            this.provides = bDef.provides || null;
            this.buildTime = bDef.buildTime;
            this.spawnsUnit = bDef.spawnsUnit || null;
        }
        if (this.category === 'unit') {
            this.sizeW = 1;
            this.sizeH = 1;
            this.powerProvided = 0;
            this.powerUsed = 0;
            this.provides = null;
            this.sizeW = 1;
            this.sizeH = 1;
        }

        // Ore harvester specific
        this.ore = 0;
        this.oreCapacity = def.oreCapacity || 0;
        this.harvesting = false;
        this.harvestTarget = null;
        this.returning = false;

        // Movement
        this.path = [];
        this.targetX = null;
        this.targetY = null;
        this.moveTarget = null;

        // Combat
        this.attackTarget = null;
        this.attackCooldown = 0;
        this.attackCooldownMax = this.attackSpeed > 0 ? (1 / this.attackSpeed) * 60 : 0;

        // Building construction
        this.buildProgress = 0;
        this.underConstruction = config.underConstruction || false;
        this.beingBuilt = config.beingBuilt || false;
        if (this.beingBuilt) {
            this.hp = 1;
            this.buildProgress = 0;
        }

        // Production
        this.productionQueue = [];
        this.productionProgress = 0;
        this.productionItem = null;

        // Visual
        this.selected = false;
        this.visible = true;
        this.fogRevealed = false;

        // Death
        this.dead = false;
        this.deathTimer = 0;

        // Animation
        this.animFrame = 0;
        this.facing = 0; // radians
    }

    get pixelX() { return this.x; }
    get pixelY() { return this.y; }
    get centerX() { return this.x; }
    get centerY() { return this.y; }
    get hpPercent() { return this.maxHp > 0 ? this.hp / this.maxHp : 0; }
    get isUnit() { return this.category === 'unit'; }
    get isBuilding() { return this.category === 'building'; }
}

// ===== PROJECTILE =====
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
        this.dx = 0;
        this.dy = 0;

        const a = angle(this.x, this.y, this.targetX, this.targetY);
        this.dx = Math.cos(a) * this.speed;
        this.dy = Math.sin(a) * this.speed;
    }
}

// ===== GAME ENGINE =====
export class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.minimapCanvas = null;
        this.minimapCtx = null;
        this.audio = new AudioSystem();

        this.state = 'menu'; // menu, briefing, playing, paused, gameover
        this.currentLevel = null;
        this.currentLevelIndex = 0;

        this.map = [];
        this.mapW = 0;
        this.mapH = 0;
        this.entities = [];
        this.projectiles = [];
        this.explosions = []; // {x, y, radius, timer}

        this.playerCredits = 0;
        this.enemyCredits = 0;
        this.playerPower = 0;
        this.playerPowerUsed = 0;
        this.enemyPower = 0;
        this.enemyPowerUsed = 0;

        this.selectedEntities = [];
        this.camera = { x: 0, y: 0 };
        this.targetCamera = { x: 0, y: 0 };
        this.cameraSpeed = 15;

        this.gameTime = 0;
        this.tickRate = 60;
        this.lastTime = 0;
        this.dt = 0;
        this.running = false;

        this.buildTab = 'structures';
        this.placingBuilding = null;
        this.placementValid = false;

        this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, dragging: false, dragStartX: 0, dragStartY: 0 };
        this.keys = {};
        this.unitGroups = {};

        this.messages = [];
        this.levelProgress = this.loadProgress();

        // AI state
        this.ai = null;
        this.aiTimer = 0;
        this.aiWaveTimer = 0;

        // Victory/defeat
        this.victory = false;
        this.defeat = false;

        // Callbacks
        this.onVictory = null;
        this.onDefeat = null;
        this.onUpdateUI = null;

        // Fog of war
        this.fogMap = []; // 2D array: 0=unexplored, 1=explored, 2=visible
    }

    loadProgress() {
        try {
            const data = localStorage.getItem('redstorm_progress');
            return data ? JSON.parse(data) : { completed: [], maxUnlocked: 1 };
        } catch { return { completed: [], maxUnlocked: 1 }; }
    }

    saveProgress() {
        try {
            localStorage.setItem('redstorm_progress', JSON.stringify(this.levelProgress));
        } catch {}
    }

    init(canvas, minimapCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.minimapCanvas = minimapCanvas;
        this.minimapCtx = minimapCanvas.getContext('2d');
    }

    loadLevel(levelIndex) {
        const level = LEVELS[levelIndex - 1];
        if (!level) return;

        this.currentLevel = level;
        this.currentLevelIndex = levelIndex;
        this.victory = false;
        this.defeat = false;

        // Reset state
        this.entities = [];
        this.projectiles = [];
        this.explosions = [];
        this.selectedEntities = [];
        this.messages = [];
        this.gameTime = 0;
        this.placingBuilding = null;
        entityIdCounter = 0;

        // Map
        this.mapW = level.mapSize.w;
        this.mapH = level.mapSize.h;
        this.map = generateMap(level);

        // Fog of war
        this.fogMap = [];
        for (let y = 0; y < this.mapH; y++) {
            this.fogMap[y] = [];
            for (let x = 0; x < this.mapW; x++) {
                this.fogMap[y][x] = 0;
            }
        }

        // Credits
        this.playerCredits = level.playerCredits;
        this.enemyCredits = level.enemyCredits;
        this.playerPower = 0;
        this.playerPowerUsed = 0;
        this.enemyPower = 0;
        this.enemyPowerUsed = 0;

        // Place player buildings
        for (const b of level.playerBuildings) {
            this.spawnBuilding(b.type, b.x, b.y, TEAM.PLAYER);
        }

        // Place player units
        for (const u of level.playerUnits) {
            this.spawnUnit(u.type, u.x, u.y, TEAM.PLAYER);
        }

        // Place enemy buildings
        for (const b of level.enemyBuildings) {
            this.spawnBuilding(b.type, b.x, b.y, TEAM.ENEMY);
        }

        // Place enemy units
        for (const u of level.enemyUnits) {
            this.spawnUnit(u.type, u.x, u.y, TEAM.ENEMY);
        }

        // Camera to player start
        this.camera.x = level.playerStart.x * TILE_SIZE - (this.canvas.width - 256) / 2;
        this.camera.y = level.playerStart.y * TILE_SIZE - this.canvas.height / 2;
        this.targetCamera.x = this.camera.x;
        this.targetCamera.y = this.camera.y;

        // Update fog of war initially
        this.updateFogOfWar();

        // AI
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

        this.resize();
    }

    spawnBuilding(type, tileX, tileY, team) {
        const entity = new Entity({
            type, category: 'building', team, tileX, tileY
        });
        // Center the building position
        entity.x = tileX * TILE_SIZE + (entity.sizeW * TILE_SIZE) / 2;
        entity.y = tileY * TILE_SIZE + (entity.sizeH * TILE_SIZE) / 2;
        this.entities.push(entity);

        // Reserve tiles
        this.reserveTiles(entity);

        // Spawn harvester from refinery
        if (type === 'ore_refinery' && !this.buildingExists(type, team)) {
            // First refinery spawns a harvester
        }

        return entity;
    }

    spawnUnit(type, tileX, tileY, team) {
        const entity = new Entity({
            type, category: 'unit', team, tileX, tileY
        });
        entity.x = tileX * TILE_SIZE + TILE_SIZE / 2;
        entity.y = tileY * TILE_SIZE + TILE_SIZE / 2;
        this.entities.push(entity);
        return entity;
    }

    reserveTiles(entity) {
        for (let dy = 0; dy < entity.sizeH; dy++) {
            for (let dx = 0; dx < entity.sizeW; dx++) {
                const tx = entity.tileX + dx;
                const ty = entity.tileY + dy;
                if (ty >= 0 && ty < this.mapH && tx >= 0 && tx < this.mapW) {
                    this.map[ty][tx] = T.WALL; // Mark as occupied
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
                    if (this.map[ty][tx] === T.WALL) {
                        this.map[ty][tx] = T.GRASS;
                    }
                }
            }
        }
    }

    buildingExists(type, team) {
        return this.entities.some(e => e.type === type && e.team === team && !e.dead && e.buildProgress >= 100);
    }

    getBuildingsByProvides(provides, team) {
        return this.entities.filter(e => e.provides === provides && e.team === team && !e.dead && e.buildProgress >= 100);
    }

    hasPrerequisite(prereq, team) {
        if (!prereq) return true;
        return this.buildingExists(prereq, team);
    }

    // ===== UPDATE LOOP =====
    update(timestamp) {
        if (this.state !== 'playing') return;
        if (!this.lastTime) this.lastTime = timestamp;

        this.dt = Math.min((timestamp - this.lastTime) / (1000 / this.tickRate), 3);
        this.lastTime = timestamp;
        this.gameTime += 1/60;

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
        this.checkVictoryDefeat();

        // Remove dead entities
        this.entities = this.entities.filter(e => !e.dead || e.deathTimer < 30);
        this.entities.forEach(e => {
            if (e.dead) e.deathTimer++;
        });
    }

    updateCamera() {
        // Keyboard scrolling
        const scrollSpeed = 10;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) this.targetCamera.y -= scrollSpeed;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) this.targetCamera.y += scrollSpeed;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.targetCamera.x -= scrollSpeed;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) this.targetCamera.x += scrollSpeed;

        // Clamp camera
        const maxX = this.mapW * TILE_SIZE - (this.canvas.width - 256);
        const maxY = this.mapH * TILE_SIZE - this.canvas.height;
        this.targetCamera.x = clamp(this.targetCamera.x, 0, Math.max(0, maxX));
        this.targetCamera.y = clamp(this.targetCamera.y, 0, Math.max(0, maxY));

        // Smooth camera
        this.camera.x += (this.targetCamera.x - this.camera.x) * 0.15;
        this.camera.y += (this.targetCamera.y - this.camera.y) * 0.15;
    }

    updateSelection() {
        // Remove dead entities from selection
        this.selectedEntities = this.selectedEntities.filter(e => !e.dead);
    }

    updateUnits() {
        for (const entity of this.entities) {
            if (entity.dead || !entity.isUnit) continue;

            // Animation
            entity.animFrame += 0.02;

            // Face direction of movement
            if (entity.path.length > 0) {
                const next = entity.path[0];
                const nx = next.x * TILE_SIZE + TILE_SIZE / 2;
                const ny = next.y * TILE_SIZE + TILE_SIZE / 2;
                entity.facing = angle(entity.x, entity.y, nx, ny);
            }

            // Movement along path
            if (entity.path.length > 0) {
                const next = entity.path[0];
                const nx = next.x * TILE_SIZE + TILE_SIZE / 2;
                const ny = next.y * TILE_SIZE + TILE_SIZE / 2;
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
            }

            // Move to target if no path
            if (entity.targetX !== null && entity.targetY !== null && entity.path.length === 0) {
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

            // Attack target tracking
            if (entity.attackTarget) {
                if (entity.attackTarget.dead) {
                    entity.attackTarget = null;
                } else {
                    // Update path to follow target
                    const d = dist(entity.x, entity.y, entity.attackTarget.x, entity.attackTarget.y);
                    if (d > entity.attackRange * 0.9) {
                        // Move toward target
                        if (entity.path.length === 0) {
                            const tx = Math.floor(entity.attackTarget.x / TILE_SIZE);
                            const ty = Math.floor(entity.attackTarget.y / TILE_SIZE);
                            entity.path = findPath(
                                this.map, 
                                Math.floor(entity.x / TILE_SIZE), 
                                Math.floor(entity.y / TILE_SIZE),
                                tx, ty,
                                this.entities.filter(e => e.isBuilding && !e.dead),
                                this.mapW, this.mapH
                            );
                        }
                    } else {
                        entity.path = [];
                    }
                }
            }
        }
    }

    updateBuildings() {
        for (const entity of this.entities) {
            if (entity.dead || !entity.isBuilding) continue;

            // Under construction
            if (entity.beingBuilt) {
                entity.buildProgress += this.dt * (100 / (entity.buildTime * 60));
                if (entity.buildProgress >= 100) {
                    entity.buildProgress = 100;
                    entity.beingBuilt = false;
                    entity.hp = entity.maxHp;
                    this.audio.play('build');
                    this.addMessage(`${entity.name} complete!`, 'success');

                    // Spawn harvester from refinery
                    if (entity.type === 'ore_refinery' && entity.spawnsUnit) {
                        const hx = entity.tileX + entity.sizeW;
                        const hy = entity.tileY + entity.sizeH - 1;
                        this.spawnUnit('harvester', hx, hy, entity.team);
                        if (entity.team === TEAM.PLAYER) {
                            this.addMessage('Harvester deployed!', '');
                        }
                    }
                } else {
                    entity.hp = entity.maxHp * (entity.buildProgress / 100);
                }
            }

            // Production
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

                        // Spawn unit near building
                        const sx = entity.tileX + entity.sizeW;
                        const sy = entity.tileY + entity.sizeH - 1;

                        // Find walkable spawn point
                        let spawnX = sx, spawnY = sy;
                        for (let r = 0; r < 5; r++) {
                            for (let dy = -r; dy <= r; dy++) {
                                for (let dx = -r; dx <= r; dx++) {
                                    const tx = sx + dx, ty = sy + dy;
                                    if (ty >= 0 && ty < this.mapH && tx >= 0 && tx < this.mapW && TILE_WALKABLE[this.map[ty][tx]]) {
                                        spawnX = tx;
                                        spawnY = ty;
                                        r = 5; // break outer
                                        break;
                                    }
                                }
                            }
                        }

                        const unit = this.spawnUnit(entity.productionItem, spawnX, spawnY, entity.team);

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
            if (entity.beingBuilt || (entity.isBuilding && entity.buildProgress < 100)) continue;

            // Attack cooldown
            if (entity.attackCooldown > 0) {
                entity.attackCooldown -= this.dt;
                continue;
            }

            // Find attack target if none
            if (!entity.attackTarget || entity.attackTarget.dead) {
                entity.attackTarget = this.findAttackTarget(entity);
            }

            if (!entity.attackTarget) continue;

            const target = entity.attackTarget;
            const d = dist(entity.x, entity.y, target.x, target.y);

            if (d <= entity.attackRange && this.hasLineOfSight(entity, target)) {
                // Fire!
                this.fireProjectile(entity, target);
                entity.attackCooldown = entity.attackCooldownMax;

                // Face target
                entity.facing = angle(entity.x, entity.y, target.x, target.y);
            }
        }
    }

    findAttackTarget(entity) {
        let bestTarget = null;
        let bestDist = entity.attackRange * 1.5; // Auto-acquire range

        for (const other of this.entities) {
            if (other.dead || other.team === entity.team) continue;
            if (other.isInvisible && entity.team !== TEAM.PLAYER) continue;

            // Air units can only be hit by anti-air
            if (other.isAir && !entity.antiAir) continue;
            // Ground turrets can't hit air
            if (other.isAir && entity.isBuilding && !entity.antiAir) continue;

            const d = dist(entity.x, entity.y, other.x, other.y);
            if (d < bestDist) {
                // Priority: attacking units that are attacking us
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
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const steps = Math.ceil(dist(a.x, a.y, b.x, b.y) / (TILE_SIZE / 2));
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const x = a.x + dx * t;
            const y = a.y + dy * t;
            const tx = Math.floor(x / TILE_SIZE);
            const ty = Math.floor(y / TILE_SIZE);
            if (ty >= 0 && ty < this.mapH && tx >= 0 && tx < this.mapW) {
                const tile = this.map[ty][tx];
                if (tile === T.ROCK || tile === T.WALL || tile === T.WATER) return false;
            }
        }
        return true;
    }

    fireProjectile(attacker, target) {
        this.projectiles.push(new Projectile({
            x: attacker.x,
            y: attacker.y,
            targetX: target.x,
            targetY: target.y,
            target: target,
            damage: attacker.attackDamage,
            splash: attacker.splash,
            owner: attacker,
            team: attacker.team,
        }));

        if (attacker.team === TEAM.PLAYER && !attacker.isBuilding) {
            // Don't spam sounds
        }
        this.audio.play('attack');
    }

    updateProjectiles() {
        for (const proj of this.projectiles) {
            if (proj.dead) continue;

            proj.x += proj.dx * this.dt;
            proj.y += proj.dy * this.dt;

            // Check if reached target area
            const d = dist(proj.x, proj.y, proj.targetX, proj.targetY);
            if (d < 10 || !proj.target || proj.target.dead) {
                // Hit!
                this.applyProjectileHit(proj);
                proj.dead = true;
            }
        }

        this.projectiles = this.projectiles.filter(p => !p.dead);
    }

    applyProjectileHit(proj) {
        if (proj.splash > 0) {
            // Splash damage
            this.explosions.push({ x: proj.x, y: proj.y, radius: proj.splash, timer: 15 });
            this.audio.play('explosion');

            for (const entity of this.entities) {
                if (entity.dead || entity.team === proj.team) continue;
                const d = dist(entity.x, entity.y, proj.x, proj.y);
                if (d <= proj.splash) {
                    const dmg = proj.damage * (1 - d / proj.splash * 0.5);
                    this.dealDamage(entity, dmg, proj.owner);
                }
            }
        } else {
            // Single target
            if (proj.target && !proj.target.dead) {
                this.dealDamage(proj.target, proj.damage, proj.owner);
                this.explosions.push({ x: proj.x, y: proj.y, radius: 8, timer: 8 });
            }
        }
    }

    dealDamage(entity, damage, attacker) {
        // Armor reduction
        const armor = entity.armor || 0;
        const actualDamage = Math.max(1, damage - armor * 0.5);
        entity.hp -= actualDamage;

        if (entity.hp <= 0) {
            this.killEntity(entity);
        }
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

        // Remove from selections
        this.selectedEntities = this.selectedEntities.filter(e => e !== entity);

        // Harvester drops ore
        if (entity.isHarvester && entity.ore > 0 && entity.team === TEAM.PLAYER) {
            this.playerCredits += Math.floor(entity.ore * 5);
        }
    }

    updateExplosions() {
        for (const exp of this.explosions) {
            exp.timer--;
        }
        this.explosions = this.explosions.filter(e => e.timer > 0);
    }

    updateHarvesters() {
        for (const entity of this.entities) {
            if (entity.dead || !entity.isHarvester) continue;
            if (entity.beingBuilt) continue;
            if (entity.attackTarget) continue; // Don't harvest while attacking

            if (entity.team === TEAM.ENEMY) {
                this.updateAIHarvester(entity);
                continue;
            }

            // Player harvester AI
            if (entity.ore >= entity.oreCapacity) {
                // Full - return to refinery
                if (!entity.returning) {
                    entity.returning = true;
                    entity.harvesting = false;
                    entity.harvestTarget = null;

                    // Find nearest refinery
                    const refinery = this.findNearest(entity, this.entities.filter(e => 
                        e.type === 'ore_refinery' && e.team === TEAM.PLAYER && !e.dead && e.buildProgress >= 100
                    ));

                    if (refinery) {
                        entity.path = findPath(
                            this.map,
                            Math.floor(entity.x / TILE_SIZE),
                            Math.floor(entity.y / TILE_SIZE),
                            refinery.tileX + refinery.sizeW - 1,
                            refinery.tileY,
                            this.entities.filter(e => e.isBuilding && !e.dead),
                            this.mapW, this.mapH
                        );
                        entity.targetX = refinery.x;
                        entity.targetY = refinery.y;
                    }
                }

                // Check if at refinery
                const refinery = this.entities.find(e => 
                    e.type === 'ore_refinery' && e.team === TEAM.PLAYER && !e.dead && e.buildProgress >= 100
                );
                if (refinery) {
                    const d = dist(entity.x, entity.y, refinery.x, refinery.y);
                    if (d < TILE_SIZE * 2) {
                        // Unload
                        const credits = Math.floor(entity.ore * 5);
                        this.playerCredits += credits;
                        entity.ore = 0;
                        entity.returning = false;
                        entity.path = [];
                        this.addMessage(`+$${credits} credits`, 'success');
                    }
                }
            } else if (!entity.harvesting) {
                // Find ore
                entity.returning = false;
                const oreTile = this.findNearestOre(entity);
                if (oreTile) {
                    entity.harvesting = true;
                    entity.harvestTarget = oreTile;
                    entity.path = findPath(
                        this.map,
                        Math.floor(entity.x / TILE_SIZE),
                        Math.floor(entity.y / TILE_SIZE),
                        oreTile.x, oreTile.y,
                        this.entities.filter(e => e.isBuilding && !e.dead),
                        this.mapW, this.mapH
                    );
                }
            } else {
                // Harvesting - check if at ore tile
                if (entity.harvestTarget) {
                    const d = dist(entity.x, entity.y, 
                        entity.harvestTarget.x * TILE_SIZE + TILE_SIZE / 2,
                        entity.harvestTarget.y * TILE_SIZE + TILE_SIZE / 2);

                    if (d < TILE_SIZE) {
                        // Check if there's still ore
                        if (this.map[entity.harvestTarget.y]?.[entity.harvestTarget.x] === T.ORE) {
                            entity.ore += 0.1 * this.dt;
                            if (entity.ore >= entity.oreCapacity) {
                                entity.ore = entity.oreCapacity;
                            }
                        } else {
                            // Ore depleted, find more
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
                    entity.path = findPath(
                        this.map,
                        Math.floor(entity.x / TILE_SIZE),
                        Math.floor(entity.y / TILE_SIZE),
                        refinery.tileX + refinery.sizeW - 1,
                        refinery.tileY,
                        this.entities.filter(e => e.isBuilding && !e.dead),
                        this.mapW, this.mapH
                    );
                    entity.targetX = refinery.x;
                    entity.targetY = refinery.y;
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
                entity.path = findPath(
                    this.map,
                    Math.floor(entity.x / TILE_SIZE),
                    Math.floor(entity.y / TILE_SIZE),
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
            } else if (d >= TILE_SIZE || this.map[entity.harvestTarget.y]?.[entity.harvestTarget.x] !== T.ORE) {
                entity.harvesting = false;
                entity.harvestTarget = null;
                entity.path = [];
            }
        }
    }

    findNearestOre(entity) {
        let best = null;
        let bestDist = Infinity;

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

    findNearest(entity, candidates) {
        let best = null;
        let bestDist = Infinity;
        for (const c of candidates) {
            const d = dist(entity.x, entity.y, c.x, c.y);
            if (d < bestDist) {
                bestDist = d;
                best = c;
            }
        }
        return best;
    }

    updatePower() {
        this.playerPower = 0;
        this.playerPowerUsed = 0;
        this.enemyPower = 0;
        this.enemyPowerUsed = 0;

        for (const entity of this.entities) {
            if (entity.dead || !entity.isBuilding) continue;
            if (entity.buildProgress < 100) continue;

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
        // Decay visibility to explored
        for (let y = 0; y < this.mapH; y++) {
            for (let x = 0; x < this.mapW; x++) {
                if (this.fogMap[y][x] === 2) {
                    this.fogMap[y][x] = 1;
                }
            }
        }

        // Set visible around player entities
        for (const entity of this.entities) {
            if (entity.dead || entity.team !== TEAM.PLAYER) continue;
            if (entity.beingBuilt && entity.buildProgress < 50) continue;

            const viewRange = entity.isBuilding ? 
                (entity.provides === 'radar' ? 15 : 6) : 7;

            const cx = Math.floor(entity.x / TILE_SIZE);
            const cy = Math.floor(entity.y / TILE_SIZE);

            for (let dy = -viewRange; dy <= viewRange; dy++) {
                for (let dx = -viewRange; dx <= viewRange; dx++) {
                    const tx = cx + dx;
                    const ty = cy + dy;
                    if (tx >= 0 && tx < this.mapW && ty >= 0 && ty < this.mapH) {
                        if (dx * dx + dy * dy <= viewRange * viewRange) {
                            this.fogMap[ty][tx] = 2;
                        }
                    }
                }
            }
        }

        // Update entity visibility
        for (const entity of this.entities) {
            if (entity.team === TEAM.PLAYER) {
                entity.visible = true;
                continue;
            }

            const tx = Math.floor(entity.x / TILE_SIZE);
            const ty = Math.floor(entity.y / TILE_SIZE);
            entity.visible = (this.fogMap[ty]?.[tx] || 0) === 2;
        }
    }

    checkVictoryDefeat() {
        if (this.victory || this.defeat) return;

        const level = this.currentLevel;

        // Check time limit
        if (level.timeLimit > 0 && this.gameTime >= level.timeLimit) {
            this.defeat = true;
            this.addMessage('TIME LIMIT EXPIRED!', 'warning');
            return;
        }

        // Check survive condition
        if (level.victoryCondition === 'survive_time') {
            if (this.gameTime >= level.surviveTime) {
                this.victory = true;
                this.audio.play('victory');
                this.addMessage('MISSION COMPLETE!', 'success');
                return;
            }
        }

        // Check destroy conditions
        const playerCY = this.entities.find(e => 
            e.type === 'construction_yard' && e.team === TEAM.PLAYER && !e.dead
        );
        const enemyCY = this.entities.find(e => 
            e.type === 'construction_yard' && e.team === TEAM.ENEMY && !e.dead
        );

        // Player loses if no construction yard (and no base was provided)
        if (!playerCY && level.playerBuildings.some(b => b.type === 'construction_yard')) {
            // Check if player has any buildings left
            const playerBuildings = this.entities.filter(e => e.team === TEAM.PLAYER && e.isBuilding && !e.dead);
            const playerUnits = this.entities.filter(e => e.team === TEAM.PLAYER && e.isUnit && !e.dead);
            if (playerBuildings.length === 0 && playerUnits.length === 0) {
                this.defeat = true;
                this.audio.play('defeat');
                this.addMessage('MISSION FAILED!', 'warning');
                return;
            }
        }

        // Check for no-base missions
        if (level.noBase) {
            const playerUnits = this.entities.filter(e => e.team === TEAM.PLAYER && !e.dead);
            if (playerUnits.length === 0) {
                this.defeat = true;
                this.audio.play('defeat');
                return;
            }
        }

        // Victory: destroy all enemy buildings (for destroy_all)
        if (level.victoryCondition === 'destroy_all') {
            const enemyBuildings = this.entities.filter(e => e.team === TEAM.ENEMY && e.isBuilding && !e.dead);
            const enemyUnits = this.entities.filter(e => e.team === TEAM.ENEMY && e.isUnit && !e.dead);
            if (enemyBuildings.length === 0) {
                this.victory = true;
                this.audio.play('victory');
                this.addMessage('MISSION COMPLETE!', 'success');
                this.onLevelComplete();
            }
        }

        // Check specific building destruction
        if (level.victoryCondition === 'destroy_building_type') {
            const target = this.entities.find(e => 
                e.type === level.destroyTarget && e.team === TEAM.ENEMY && !e.dead
            );
            if (!target) {
                this.victory = true;
                this.audio.play('victory');
                this.addMessage('MISSION COMPLETE!', 'success');
                this.onLevelComplete();
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

    // ===== AI =====
    updateAI(timestamp) {
        if (!this.ai) return;
        if (this.victory || this.defeat) return;

        const diff = this.ai.difficulty;
        this.aiTimer++;

        // Build structures
        if (this.aiTimer % Math.floor(300 / diff) === 0) {
            this.aiBuildStructure();
        }

        // Produce units
        if (this.aiTimer % Math.floor(150 / diff) === 0) {
            this.aiProduceUnit();
        }

        // Attack waves
        this.aiWaveTimer++;
        const waveInterval = Math.max(200, 900 - diff * 700);
        if (this.aiWaveTimer >= waveInterval) {
            this.aiWaveTimer = 0;
            this.aiLaunchAttack();
        }
    }

    aiBuildStructure() {
        const diff = this.ai.difficulty;
        const enemyBuildings = this.entities.filter(e => e.team === TEAM.ENEMY && e.isBuilding && !e.dead && !e.beingBuilt);

        // Find construction yard
        const cy = enemyBuildings.find(e => e.type === 'construction_yard' && e.buildProgress >= 100);
        if (!cy || cy.productionItem) return;

        // Determine what to build
        const buildPriority = ['power_plant', 'ore_refinery', 'barracks', 'war_factory', 
                              'turret', 'pillbox', 'advanced_power', 'radar_dome', 'tech_center'];

        for (const type of buildPriority) {
            if (Math.random() > diff) continue;
            if (this.buildingExists(type, TEAM.ENEMY)) continue;

            const def = BUILDINGS[type];
            if (!def) continue;
            if (this.enemyCredits < def.cost * 1.2) continue;
            if (def.prerequisite && !this.buildingExists(def.prerequisite, TEAM.ENEMY)) continue;

            // Find placement spot
            const spot = this.aiFindBuildSpot(cy, def.size.w, def.size.h);
            if (!spot) continue;

            // Check if placement is valid
            if (this.canPlaceBuilding(type, spot.x * TILE_SIZE, spot.y * TILE_SIZE, TEAM.ENEMY)) {
                this.enemyCredits -= def.cost;
                const building = this.spawnBuilding(type, spot.x, spot.y, TEAM.ENEMY);
                building.beingBuilt = true;
                building.buildProgress = 0;
                building.hp = 1;
                return;
            }
        }
    }

    aiFindBuildSpot(constructionYard, w, h) {
        const cx = constructionYard.tileX;
        const cy = constructionYard.tileY;

        // Try spots around the construction yard
        const candidates = [];
        for (let r = 2; r < 12; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) === r || Math.abs(dy) === r) {
                        candidates.push({ x: cx + dx, y: cy + dy });
                    }
                }
            }
        }

        // Sort by distance
        candidates.sort((a, b) => 
            manhattanDist(a.x, a.y, cx, cy) - manhattanDist(b.x, b.y, cx, cy)
        );

        return candidates.find(spot => this.canPlaceBuilding('construction_yard', spot.x * TILE_SIZE, spot.y * TILE_SIZE, TEAM.ENEMY, w, h));
    }

    aiProduceUnit() {
        const diff = this.ai.difficulty;

        // Find production buildings
        for (const building of this.entities) {
            if (building.dead || building.team !== TEAM.ENEMY) continue;
            if (building.beingBuilt || building.buildProgress < 100) continue;
            if (building.productionQueue.length >= 3) continue;

            if (building.type === 'barracks') {
                const unitTypes = ['infantry', 'rocket_soldier', 'grenadier'];
                const type = unitTypes[Math.floor(Math.random() * unitTypes.length)];
                const def = UNITS[type];
                if (def && this.enemyCredits >= def.cost) {
                    this.enemyCredits -= def.cost;
                    building.productionQueue.push(type);
                }
            } else if (building.type === 'war_factory') {
                const unitTypes = ['light_tank', 'heavy_tank'];
                if (Math.random() < 0.2) unitTypes.push('artillery');
                if (this.buildingExists('tech_center', TEAM.ENEMY) && Math.random() < 0.15) {
                    unitTypes.push('mammoth_tank');
                }
                if (Math.random() < 0.3) unitTypes.push('harvester');
                if (!this.entities.some(e => e.type === 'harvester' && e.team === TEAM.ENEMY && !e.dead)) {
                    unitTypes.push('harvester');
                }

                const type = unitTypes[Math.floor(Math.random() * unitTypes.length)];
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

        // Gather idle military units
        const militaryUnits = this.entities.filter(e => 
            e.team === TEAM.ENEMY && !e.dead && e.isUnit && 
            e.canAttack && !e.isHarvester &&
            (!e.attackTarget || e.attackTarget.dead) &&
            e.path.length === 0
        );

        if (militaryUnits.length < 2) return;

        // Find player target
        const playerBuildings = this.entities.filter(e => 
            e.team === TEAM.PLAYER && !e.dead && e.isBuilding
        );

        if (playerBuildings.length === 0) return;

        const target = playerBuildings[Math.floor(Math.random() * playerBuildings.length)];

        // Send units to attack
        const attackGroup = militaryUnits.slice(0, Math.ceil(militaryUnits.length * diff));

        for (const unit of attackGroup) {
            const tx = Math.floor(target.x / TILE_SIZE);
            const ty = Math.floor(target.y / TILE_SIZE);
            unit.path = findPath(
                this.map,
                Math.floor(unit.x / TILE_SIZE),
                Math.floor(unit.y / TILE_SIZE),
                tx + randInt(-2, 2),
                ty + randInt(-2, 2),
                this.entities.filter(e => e.isBuilding && !e.dead),
                this.mapW, this.mapH
            );
            unit.attackTarget = target;
            unit.targetX = target.x;
            unit.targetY = target.y;
        }
    }

    // ===== INPUT HANDLING =====
    handleMouseDown(x, y, button) {
        this.audio.resume();
        const worldX = x + this.camera.x;
        const worldY = y + this.camera.y;

        if (button === 0) { // Left click
            this.mouse.dragging = false;
            this.mouse.dragStartX = x;
            this.mouse.dragStartY = y;
        }
    }

    handleMouseUp(x, y, button) {
        const worldX = x + this.camera.x;
        const worldY = y + this.camera.y;

        if (button === 0) { // Left click release
            const dx = Math.abs(x - this.mouse.dragStartX);
            const dy = Math.abs(y - this.mouse.dragStartY);

            if (dx > 10 || dy > 10) {
                // Box select
                this.boxSelect(
                    this.mouse.dragStartX + this.camera.x,
                    this.mouse.dragStartY + this.camera.y,
                    worldX, worldY
                );
            } else {
                // Click select
                this.clickSelect(worldX, worldY);
            }
        } else if (button === 2) { // Right click
            this.rightClick(worldX, worldY);
        }
    }

    handleMouseMove(x, y) {
        this.mouse.x = x;
        this.mouse.y = y;
        this.mouse.worldX = x + this.camera.x;
        this.mouse.worldY = y + this.camera.y;

        const dx = Math.abs(x - this.mouse.dragStartX);
        const dy = Math.abs(y - this.mouse.dragStartY);
        this.mouse.dragging = (dx > 10 || dy > 10);
    }

    clickSelect(worldX, worldY) {
        // Deselect all
        for (const e of this.selectedEntities) e.selected = false;
        this.selectedEntities = [];
        this.placingBuilding = null;

        // Find entity under cursor
        const clicked = this.findEntityAt(worldX, worldY, TEAM.PLAYER);

        if (clicked) {
            clicked.selected = true;
            this.selectedEntities = [clicked];
        }
    }

    boxSelect(x1, y1, x2, y2) {
        // Deselect all
        for (const e of this.selectedEntities) e.selected = false;
        this.selectedEntities = [];

        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);

        for (const entity of this.entities) {
            if (entity.dead || entity.team !== TEAM.PLAYER) continue;
            if (!entity.isUnit) continue;

            if (entity.x >= left && entity.x <= right && entity.y >= top && entity.y <= bottom) {
                entity.selected = true;
                this.selectedEntities.push(entity);
            }
        }
    }

    rightClick(worldX, worldY) {
        if (this.selectedEntities.length === 0) return;

        // Check if clicking on enemy entity
        const target = this.findEntityAt(worldX, worldY);

        if (target && target.team !== TEAM.PLAYER && target.visible) {
            // Attack command
            for (const entity of this.selectedEntities) {
                if (entity.canAttack) {
                    entity.attackTarget = target;
                    entity.path = [];
                }
            }
            this.audio.play('click');
        } else if (this.placingBuilding && this.placementValid) {
            // Place building
            this.placeBuildingAt(this.mouse.worldX, this.mouse.worldY);
        } else {
            // Move command
            const tx = Math.floor(worldX / TILE_SIZE);
            const ty = Math.floor(worldY / TILE_SIZE);

            for (const entity of this.selectedEntities) {
                if (!entity.isUnit) continue;

                // Stop attacking
                if (entity.attackTarget && entity.canAttack) {
                    // Check if still in range
                    const d = dist(entity.x, entity.y, entity.attackTarget.x, entity.attackTarget.y);
                    if (d > entity.attackRange * 1.5) {
                        entity.attackTarget = null;
                    }
                }

                entity.path = findPath(
                    this.map,
                    Math.floor(entity.x / TILE_SIZE),
                    Math.floor(entity.y / TILE_SIZE),
                    tx, ty,
                    this.entities.filter(e => e.isBuilding && !e.dead),
                    this.mapW, this.mapH
                );

                // Formation offset
                const idx = this.selectedEntities.indexOf(entity);
                const offset = Math.floor(idx / 3);
                entity.targetX = worldX + randInt(-20, 20);
                entity.targetY = worldY + randInt(-20, 20);
            }
            this.audio.play('click');
        }
    }

    findEntityAt(worldX, worldY, teamFilter = null) {
        let best = null;
        let bestDist = Infinity;

        // Check units first (smaller)
        for (const entity of this.entities) {
            if (entity.dead) continue;
            if (teamFilter !== null && entity.team !== teamFilter) {
                // Still show enemy entities for right-click targeting
                if (teamFilter === TEAM.PLAYER && entity.team !== TEAM.PLAYER && !entity.visible) continue;
            }

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
        const w = sizeW || def.size.w;
        const h = sizeH || def.size.h;

        const tx = Math.floor(worldX / TILE_SIZE);
        const ty = Math.floor(worldY / TILE_SIZE);

        // Check bounds
        if (tx < 0 || ty < 0 || tx + w > this.mapW || ty + h > this.mapH) return false;

        // Check tiles
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const tile = this.map[ty + dy]?.[tx + dx];
                if (tile === undefined) return false;
                if (!TILE_WALKABLE[tile] && tile !== T.WALL) return false;
            }
        }

        // Check overlap with other buildings
        for (const entity of this.entities) {
            if (entity.dead || !entity.isBuilding) continue;
            const ew = entity.sizeW || 1;
            const eh = entity.sizeH || 1;

            // Check AABB overlap
            if (tx < entity.tileX + ew && tx + w > entity.tileX &&
                ty < entity.tileY + eh && ty + h > entity.tileY) {
                // Allow overlap with the building being placed on (for construction yard placement)
                // Skip if it's the same exact position and team
                return false;
            }
        }

        // Check proximity to another building (must be adjacent to existing building)
        let adjacent = false;
        for (const entity of this.entities) {
            if (entity.dead || !entity.isBuilding || entity.team !== team) continue;
            if (entity.beingBuilt) continue;
            const ew = entity.sizeW || 1;
            const eh = entity.sizeH || 1;

            if (tx <= entity.tileX + ew && tx + w >= entity.tileX &&
                ty <= entity.tileY + eh && ty + h >= entity.tileY) {
                // Overlapping - not adjacent but on top
                continue;
            }

            // Check if within 2 tiles
            const cx1 = tx + w / 2, cy1 = ty + h / 2;
            const cx2 = entity.tileX + ew / 2, cy2 = entity.tileY + eh / 2;
            const d = manhattanDist(cx1, cy1, cx2, cy2);
            if (d <= Math.max(w, h) + 2) {
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
        const tx = Math.floor(worldX / TILE_SIZE);
        const ty = Math.floor(worldY / TILE_SIZE);

        if (!this.canPlaceBuilding(type, worldX, worldY, TEAM.PLAYER)) return;

        const cost = def.cost;
        if (this.playerCredits < cost) {
            this.addMessage('Not enough credits!', 'warning');
            this.audio.play('error');
            return;
        }

        if (def.prerequisite && !this.hasPrerequisite(def.prerequisite, TEAM.PLAYER)) {
            this.addMessage('Prerequisite not met!', 'warning');
            this.audio.play('error');
            return;
        }

        this.playerCredits -= cost;

        // Find construction yard to build from
        const cy = this.entities.find(e => 
            e.type === 'construction_yard' && e.team === TEAM.PLAYER && !e.dead && !e.beingBuilt
        );

        if (!cy) {
            this.playerCredits += cost;
            this.addMessage('No Construction Yard!', 'warning');
            return;
        }

        const building = this.spawnBuilding(type, tx, ty, TEAM.PLAYER);
        building.beingBuilt = true;
        building.buildProgress = 0;
        building.hp = 1;

        this.placingBuilding = null;
        this.addMessage(`Building ${def.name}...`, '');
        this.audio.play('click');
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
        if (!def) return;

        if (this.playerCredits < def.cost) {
            this.addMessage('Not enough credits!', 'warning');
            this.audio.play('error');
            return;
        }

        if (!producer || producer.dead || producer.team !== TEAM.PLAYER) return;
        if (producer.beingBuilt || producer.buildProgress < 100) return;

        this.playerCredits -= def.cost;
        producer.productionQueue.push(type);
        this.audio.play('click');
    }

    sellBuilding(entity) {
        if (!entity || entity.dead || entity.team !== TEAM.PLAYER || !entity.isBuilding) return;
        if (entity.type === 'construction_yard') return; // Can't sell CY

        const refund = Math.floor(entity.cost * 0.5);
        this.playerCredits += refund;
        this.killEntity(entity);
        this.addMessage(`Sold for $${refund}`, '');
        this.selectedEntities = this.selectedEntities.filter(e => e !== entity);
    }

    addMessage(text, type = '') {
        this.messages.push({ text, type, time: Date.now() });
        if (this.messages.length > 5) this.messages.shift();
        this.audio.play('message');
    }

    resize() {
        if (!this.canvas) return;
        const sidebar = 256;
        this.canvas.width = window.innerWidth - sidebar;
        this.canvas.height = window.innerHeight;

        // Update minimap
        if (this.minimapCanvas) {
            this.minimapCanvas.width = 234;
            this.minimapCanvas.height = Math.floor(234 * (this.mapH / this.mapW));
        }
    }

    // ===== KEYBOARD =====
    handleKeyDown(key) {
        this.keys[key.code] = true;

        // Control groups
        if (key.ctrlKey && key.code >= 'Digit1' && key.code <= 'Digit9') {
            const groupNum = parseInt(key.code.replace('Digit', ''));
            if (this.selectedEntities.length > 0) {
                this.unitGroups[groupNum] = [...this.selectedEntities];
                this.addMessage(`Group ${groupNum} set`, '');
            }
        }

        if (!key.ctrlKey && key.code >= 'Digit1' && key.code <= 'Digit9') {
            const groupNum = parseInt(key.code.replace('Digit', ''));
            if (this.unitGroups[groupNum]) {
                for (const e of this.selectedEntities) e.selected = false;
                this.selectedEntities = this.unitGroups[groupNum].filter(e => !e.dead);
                for (const e of this.selectedEntities) e.selected = true;
            }
        }

        if (key.code === 'Delete') {
            for (const e of this.selectedEntities) {
                this.sellBuilding(e);
            }
        }

        if (key.code === 'Space') {
            if (this.selectedEntities.length > 0) {
                const sel = this.selectedEntities[0];
                this.targetCamera.x = sel.x - (this.canvas.width / 2);
                this.targetCamera.y = sel.y - (this.canvas.height / 2);
            }
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
