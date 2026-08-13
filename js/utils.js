// ===== CONSTANTS =====
export const TILE_SIZE = 32;
export const SIDEBAR_WIDTH = 256;
export const TOP_HUD_HEIGHT = 40;

// Tile types
export const T = {
    GRASS: 0,
    WATER: 1,
    ORE: 2,
    ROCK: 3,
    SAND: 4,
    FOREST: 5,
    BRIDGE: 6,
    SHALLOW_WATER: 7,
    ROAD: 8,
    WALL: 9,
};

export const TILE_COLORS = {
    [T.GRASS]: ['#2d5a1e', '#2a5520', '#305f22', '#285218'],
    [T.WATER]: ['#1a3a6a', '#1e4070', '#163565', '#1c3d6c'],
    [T.ORE]: ['#8a7a2a', '#9a8a3a', '#7a6a1a', '#a09040'],
    [T.ROCK]: ['#555555', '#5a5a5a', '#505050', '#606060'],
    [T.SAND]: ['#c4a855', '#bfa050', '#cab060', '#b89845'],
    [T.FOREST]: ['#1a4a0e', '#1d5012', '#18450c', '#205516'],
    [T.BRIDGE]: ['#7a6a4a', '#6a5a3a'],
    [T.SHALLOW_WATER]: ['#2a5a8a', '#2e6090'],
    [T.ROAD]: ['#4a4a4a', '#454545'],
    [T.WALL]: ['#666666', '#6a6a6a'],
};

export const TILE_WALKABLE = {
    [T.GRASS]: true, [T.SAND]: true, [T.ORE]: true,
    [T.ROAD]: true, [T.BRIDGE]: true, [T.SHALLOW_WATER]: true,
    [T.FOREST]: true, [T.WATER]: false, [T.ROCK]: false, [T.WALL]: false,
};

// Teams
export const TEAM = { PLAYER: 0, ENEMY: 1, NEUTRAL: 2 };

// Building definitions
export const BUILDINGS = {
    construction_yard: {
        name: 'Construction Yard', icon: '🏗️', cost: 0, hp: 1000,
        size: { w: 3, h: 3 }, power: -30, provides: 'builder',
        buildTime: 0, prerequisite: null, desc: 'Builds structures',
    },
    power_plant: {
        name: 'Power Plant', icon: '⚡', cost: 300, hp: 400,
        size: { w: 2, h: 2 }, power: 100, provides: 'power',
        buildTime: 5, prerequisite: null, desc: 'Provides +100 power',
    },
    advanced_power: {
        name: 'Adv. Power', icon: '🔋', cost: 500, hp: 500,
        size: { w: 2, h: 2 }, power: 200, provides: 'power',
        buildTime: 8, prerequisite: 'power_plant', desc: 'Provides +200 power',
    },
    ore_refinery: {
        name: 'Ore Refinery', icon: '🏭', cost: 1400, hp: 600,
        size: { w: 3, h: 2 }, power: -40, provides: 'refinery',
        buildTime: 10, prerequisite: 'power_plant', spawnsUnit: 'harvester',
        desc: 'Processes ore, spawns Harvester',
    },
    barracks: {
        name: 'Barracks', icon: '⛺', cost: 500, hp: 500,
        size: { w: 2, h: 2 }, power: -20, provides: 'infantry_trainer',
        buildTime: 6, prerequisite: 'power_plant', desc: 'Trains infantry units',
    },
    war_factory: {
        name: 'War Factory', icon: '🔧', cost: 2000, hp: 700,
        size: { w: 3, h: 3 }, power: -30, provides: 'vehicle_builder',
        buildTime: 12, prerequisite: 'barracks', desc: 'Builds vehicles',
    },
    radar_dome: {
        name: 'Radar Dome', icon: '📡', cost: 1500, hp: 400,
        size: { w: 2, h: 2 }, power: -20, provides: 'radar',
        buildTime: 8, prerequisite: 'barracks', desc: 'Reveals map terrain',
    },
    turret: {
        name: 'Turret', icon: '🗼', cost: 600, hp: 400,
        size: { w: 1, h: 1 }, power: -15, provides: 'defense',
        buildTime: 5, prerequisite: 'barracks', attackDamage: 30,
        attackRange: 6, attackSpeed: 1.0, desc: 'Anti-ground defense turret',
    },
    aa_gun: {
        name: 'AA Gun', icon: '🎯', cost: 500, hp: 300,
        size: { w: 1, h: 1 }, power: -10, provides: 'defense',
        buildTime: 4, prerequisite: 'barracks', antiAir: true,
        attackDamage: 25, attackRange: 7, attackSpeed: 1.2,
        desc: 'Anti-air defense',
    },
    pillbox: {
        name: 'Pillbox', icon: '🛡️', cost: 400, hp: 350,
        size: { w: 1, h: 1 }, power: -5, provides: 'defense',
        buildTime: 4, prerequisite: null, attackDamage: 15,
        attackRange: 4, attackSpeed: 1.5, desc: 'Light defense structure',
    },
    service_depot: {
        name: 'Svc. Depot', icon: '🔧', cost: 800, hp: 500,
        size: { w: 2, h: 2 }, power: -15, provides: 'repair',
        buildTime: 8, prerequisite: 'war_factory', desc: 'Repairs vehicles',
    },
    tech_center: {
        name: 'Tech Center', icon: '🔬', cost: 2500, hp: 600,
        size: { w: 2, h: 2 }, power: -50, provides: 'advanced',
        buildTime: 15, prerequisite: 'radar_dome', desc: 'Enables advanced units + upgrades',
    },
    nuclear_silo: {
        name: 'Nuclear Silo', icon: '☢️', cost: 2000, hp: 500,
        size: { w: 2, h: 2 }, power: -50, provides: 'super_nuke',
        buildTime: 12, prerequisite: 'tech_center', superweapon: 'nuke', chargeTime: 60,
        desc: 'Charges a nuclear missile. Devastating AoE.',
    },
    chronosphere: {
        name: 'Chronosphere', icon: '⏳', cost: 2500, hp: 500,
        size: { w: 2, h: 2 }, power: -50, provides: 'super_chrono',
        buildTime: 12, prerequisite: 'tech_center', superweapon: 'chrono', chargeTime: 45,
        desc: 'Teleports your units to a target location.',
    },
    iron_curtain: {
        name: 'Iron Curtain', icon: '🛡️', cost: 2500, hp: 500,
        size: { w: 2, h: 2 }, power: -50, provides: 'super_iron',
        buildTime: 12, prerequisite: 'tech_center', superweapon: 'iron', chargeTime: 50,
        desc: 'Makes units/buildings invulnerable temporarily.',
    },
    weather_control: {
        name: 'Weather Control', icon: '🌩️', cost: 3000, hp: 500,
        size: { w: 2, h: 2 }, power: -60, provides: 'super_weather',
        buildTime: 14, prerequisite: 'tech_center', superweapon: 'weather', chargeTime: 70,
        desc: 'Calls a lightning storm on the enemy.',
    },
    airfield: {
        name: 'Airfield', icon: '🛬', cost: 1500, hp: 600,
        size: { w: 3, h: 2 }, power: -30, provides: 'air_builder',
        buildTime: 10, prerequisite: 'war_factory', desc: 'Builds aircraft (helis).',
    },
    wall: {
        name: 'Wall', icon: '🧱', cost: 50, hp: 200,
        size: { w: 1, h: 1 }, power: 0, provides: 'wall',
        buildTime: 1, prerequisite: null, desc: 'Blocks enemy movement (destructible).',
    },
    tesla_coil: {
        name: 'Tesla Coil', icon: '⚡', cost: 1000, hp: 500,
        size: { w: 1, h: 1 }, power: -25, provides: 'defense',
        buildTime: 7, prerequisite: 'tech_center', attackDamage: 60,
        attackRange: 6, attackSpeed: 0.6, splash: 1, antiArmor: true,
        desc: 'Powerful chain-lightning defense.',
    },
};

// Unit definitions
export const UNITS = {
    infantry: {
        name: 'Infantry', icon: '🔫', cost: 100, hp: 50,
        speed: 2, attackDamage: 8, attackRange: 3, attackSpeed: 1.0,
        armor: 1, size: 0.6, canAttack: true, producedAt: 'barracks',
        buildTime: 2, prerequisite: null, desc: 'Basic infantry unit',
    },
    rocket_soldier: {
        name: 'Rocket Soldier', icon: '🚀', cost: 300, hp: 50,
        speed: 1.5, attackDamage: 25, attackRange: 5, attackSpeed: 0.7,
        armor: 1, size: 0.6, canAttack: true, antiArmor: true,
        producedAt: 'barracks', buildTime: 3, prerequisite: 'barracks',
        desc: 'Anti-tank infantry',
    },
    engineer: {
        name: 'Engineer', icon: '🛠️', cost: 500, hp: 25,
        speed: 2, attackDamage: 0, attackRange: 0, attackSpeed: 0,
        armor: 0, size: 0.6, canAttack: false, canCapture: true,
        producedAt: 'barracks', buildTime: 3, prerequisite: 'barracks',
        desc: 'Captures enemy buildings',
    },
    grenadier: {
        name: 'Grenadier', icon: '💣', cost: 200, hp: 45,
        speed: 1.8, attackDamage: 18, attackRange: 4, attackSpeed: 0.8,
        armor: 1, size: 0.6, canAttack: true, splash: 1,
        producedAt: 'barracks', buildTime: 3, prerequisite: 'barracks',
        desc: 'Splash damage infantry',
    },
    light_tank: {
        name: 'Light Tank', icon: '🛡️', cost: 700, hp: 200,
        speed: 3, attackDamage: 20, attackRange: 4, attackSpeed: 1.0,
        armor: 5, size: 0.9, canAttack: true, producedAt: 'war_factory',
        buildTime: 6, prerequisite: null, desc: 'Fast, light armor',
    },
    heavy_tank: {
        name: 'Heavy Tank', icon: '🏷️', cost: 1500, hp: 400,
        speed: 2, attackDamage: 35, attackRange: 4.5, attackSpeed: 0.8,
        armor: 10, size: 1.0, canAttack: true, producedAt: 'war_factory',
        buildTime: 10, prerequisite: 'barracks', desc: 'Heavy armor, heavy damage',
    },
    harvester: {
        name: 'Harvester', icon: '⛏️', cost: 1400, hp: 600,
        speed: 1.5, attackDamage: 0, attackRange: 0, attackSpeed: 0,
        armor: 8, size: 1.1, canAttack: false, isHarvester: true,
        oreCapacity: 20, producedAt: 'war_factory',
        buildTime: 8, prerequisite: 'ore_refinery', desc: 'Collects ore for credits',
    },
    artillery: {
        name: 'Artillery', icon: '💥', cost: 800, hp: 100,
        speed: 1, attackDamage: 50, attackRange: 8, attackSpeed: 0.4,
        armor: 2, size: 0.9, canAttack: true, splash: 2,
        producedAt: 'war_factory', buildTime: 8, prerequisite: 'war_factory',
        desc: 'Long range, splash damage',
    },
    helicopter: {
        name: 'Helicopter', icon: '🚁', cost: 1200, hp: 150,
        speed: 4, attackDamage: 30, attackRange: 5, attackSpeed: 0.8,
        armor: 2, size: 0.8, canAttack: true, isAir: true,
        producedAt: 'war_factory', buildTime: 8, prerequisite: 'tech_center',
        desc: 'Flying attack unit',
    },
    mammoth_tank: {
        name: 'Mammoth Tank', icon: '🐘', cost: 3000, hp: 600,
        speed: 1.5, attackDamage: 50, attackRange: 5, attackSpeed: 0.6,
        armor: 15, size: 1.2, canAttack: true, antiAir: true,
        producedAt: 'war_factory', buildTime: 15, prerequisite: 'tech_center',
        desc: 'Ultimate ground unit, anti-air capable',
    },
    apc: {
        name: 'APC', icon: '🚌', cost: 800, hp: 250,
        speed: 3.5, attackDamage: 10, attackRange: 3, attackSpeed: 1.2,
        armor: 6, size: 0.9, canAttack: true, canTransport: true,
        transportCapacity: 5,
        producedAt: 'war_factory', buildTime: 6, prerequisite: 'war_factory',
        desc: 'Transports infantry, lightly armed',
    },
    spy: {
        name: 'Spy', icon: '🕵️', cost: 600, hp: 30,
        speed: 2.5, attackDamage: 0, attackRange: 0, attackSpeed: 0,
        armor: 0, size: 0.6, canAttack: false, isInvisible: true,
        producedAt: 'barracks', buildTime: 4, prerequisite: 'tech_center',
        desc: 'Infiltrates enemy base (stealth)',
    },
    tesla_tank: {
        name: 'Tesla Tank', icon: '🔌', cost: 1200, hp: 250,
        speed: 2.5, attackDamage: 45, attackRange: 5, attackSpeed: 0.9,
        armor: 8, size: 0.9, canAttack: true, antiArmor: true, splash: 1,
        producedAt: 'war_factory', buildTime: 9, prerequisite: 'tech_center',
        desc: 'Electric anti-armor tank.',
    },
    medic: {
        name: 'Medic', icon: '⚕️', cost: 300, hp: 40,
        speed: 2, attackDamage: 0, attackRange: 0, attackSpeed: 0,
        armor: 1, size: 0.6, canAttack: false, isMedic: true, healAmount: 4, healRange: 4,
        producedAt: 'barracks', buildTime: 3, prerequisite: 'barracks',
        desc: 'Heals nearby friendly infantry.',
    },
    commando: {
        name: 'Commando', icon: '💂', cost: 1500, hp: 150,
        speed: 2.2, attackDamage: 60, attackRange: 4, attackSpeed: 1.0,
        armor: 3, size: 0.6, canAttack: true, antiArmor: true,
        producedAt: 'barracks', buildTime: 8, prerequisite: 'tech_center',
        desc: 'Elite hero unit. High damage.',
    },
    ifv: {
        name: 'IFV', icon: '🚙', cost: 700, hp: 200,
        speed: 4, attackDamage: 15, attackRange: 4, attackSpeed: 1.5,
        armor: 5, size: 0.9, canAttack: true, canTransport: true, transportCapacity: 1,
        producedAt: 'war_factory', buildTime: 6, prerequisite: 'barracks',
        desc: 'Fast transport, carries 1 infantry.',
    },
    flak_truck: {
        name: 'Flak Truck', icon: '🚛', cost: 800, hp: 220,
        speed: 3, attackDamage: 30, attackRange: 6, attackSpeed: 1.0,
        armor: 4, size: 0.9, canAttack: true, antiAir: true,
        producedAt: 'war_factory', buildTime: 7, prerequisite: 'war_factory',
        desc: 'Mobile anti-air.',
    },
};

// ===== UTILITY FUNCTIONS =====
export function dist(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

export function manhattanDist(x1, y1, x2, y2) {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

export function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function angle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

export function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randFloat(min, max) {
    return Math.random() * (max - min) + min;
}

export function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatCredits(n) {
    return n.toLocaleString();
}

// ===== A* PATHFINDING =====
export function findPath(map, startX, startY, endX, endY, teamEntities = [], mapW, mapH) {
    if (startX === endX && startY === endY) return [];
    if (startX < 0 || startY < 0 || startX >= mapW || startY >= mapH) return [];
    if (endX < 0 || endY < 0 || endX >= mapW || endY >= mapH) return [];
    if (!TILE_WALKABLE[map[endY]?.[startX]]) return [];

    const openSet = new Map();
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const key = (x, y) => `${x},${y}`;
    const h = (x, y) => manhattanDist(x, y, endX, endY);

    const startKey = key(startX, startY);
    gScore.set(startKey, 0);
    fScore.set(startKey, h(startX, startY));
    openSet.set(startKey, { x: startX, y: startY, f: h(startX, startY) });

    const dirs = [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[-1,1],[1,-1],[1,1]];
    let iterations = 0;
    const maxIterations = 2000;

    while (openSet.size > 0 && iterations < maxIterations) {
        iterations++;

        // Get lowest f score
        let currentKey = null, currentF = Infinity;
        for (const [k, node] of openSet) {
            if (node.f < currentF) {
                currentF = node.f;
                currentKey = k;
            }
        }

        if (currentKey === key(endX, endY)) {
            const path = [];
            let ck = currentKey;
            while (ck) {
                const [cx, cy] = ck.split(',').map(Number);
                path.unshift({ x: cx, y: cy });
                ck = cameFrom.get(ck);
            }
            return path;
        }

        const current = openSet.get(currentKey);
        openSet.delete(currentKey);
        closedSet.add(currentKey);

        for (const [dx, dy] of dirs) {
            const nx = current.x + dx;
            const ny = current.y + dy;

            if (nx < 0 || ny < 0 || nx >= mapW || ny >= mapH) continue;

            const nKey = key(nx, ny);
            if (closedSet.has(nKey)) continue;

            const tile = map[ny]?.[nx];
            if (tile === undefined || !TILE_WALKABLE[tile]) continue;

            // Don't walk through buildings
            let blocked = false;
            for (const ent of teamEntities) {
                if (ent.hp <= 0) continue;
                if (Math.abs(ent.tileX - nx) < (ent.sizeW || 1) &&
                    Math.abs(ent.tileY - ny) < (ent.sizeH || 1)) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) continue;

            const moveCost = (dx !== 0 && dy !== 0) ? 1.414 : 1;
            const tentG = (gScore.get(currentKey) || 0) + moveCost;

            if (tentG < (gScore.get(nKey) || Infinity)) {
                cameFrom.set(nKey, currentKey);
                gScore.set(nKey, tentG);
                fScore.set(nKey, tentG + h(nx, ny));
                if (!openSet.has(nKey)) {
                    openSet.set(nKey, { x: nx, y: ny, f: tentG + h(nx, ny) });
                }
            }
        }
    }

    return []; // No path found
}

// ===== MAP GENERATION =====
export function generateMap(level) {
    const width = level.mapSize ? level.mapSize.w : level.width;
    const height = level.mapSize ? level.mapSize.h : level.height;
    const seed = level.seed;
    const map = [];

    // Simple seeded random
    let s = seed || 42;
    const rand = () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };

    // Generate base terrain
    for (let y = 0; y < height; y++) {
        map[y] = [];
        for (let x = 0; x < width; x++) {
            map[y][x] = T.GRASS;
        }
    }

    // Apply level-specific terrain
    if (level.terrain) {
        for (const t of level.terrain) {
            if (t.type === 'fill') {
                for (let y = t.y || 0; y < (t.y2 !== undefined ? t.y2 : height); y++) {
                    for (let x = t.x || 0; x < (t.x2 !== undefined ? t.x2 : width); x++) {
                        if (y >= 0 && y < height && x >= 0 && x < width) {
                            map[y][x] = t.tile;
                        }
                    }
                }
            } else if (t.type === 'rect') {
                for (let y = t.y; y < t.y + t.h; y++) {
                    for (let x = t.x; x < t.x + t.w; x++) {
                        if (y >= 0 && y < height && x >= 0 && x < width) {
                            map[y][x] = t.tile;
                        }
                    }
                }
            } else if (t.type === 'line') {
                const dx = Math.abs(t.x2 - t.x);
                const dy = Math.abs(t.y2 - t.y);
                const sx = t.x < t.x2 ? 1 : -1;
                const sy = t.y < t.y2 ? 1 : -1;
                let err = dx - dy;
                let cx = t.x, cy = t.y;
                while (true) {
                    if (cy >= 0 && cy < height && cx >= 0 && cx < width) {
                        if (map[cy][cx] === T.GRASS || map[cy][cx] === T.SAND) {
                            map[cy][cx] = t.tile;
                        }
                    }
                    if (cx === t.x2 && cy === t.y2) break;
                    const e2 = 2 * err;
                    if (e2 > -dy) { err -= dy; cx += sx; }
                    if (e2 < dx) { err += dx; cy += sy; }
                }
            } else if (t.type === 'scatter') {
                for (let i = 0; i < t.count; i++) {
                    const rx = Math.floor(rand() * width);
                    const ry = Math.floor(rand() * height);
                    if (ry >= 0 && ry < height && rx >= 0 && rx < width) {
                        map[ry][rx] = t.tile;
                    }
                }
            } else if (t.type === 'circle') {
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const d = dist(x, y, t.cx, t.cy);
                        if (d < t.r && d > (t.rInner || 0)) {
                            if (y >= 0 && y < height && x >= 0 && x < width) {
                                map[y][x] = t.tile;
                            }
                        }
                    }
                }
            }
        }
    }

    // Random ore patches if none defined
    const hasOre = map.some(row => row.some(t => t === T.ORE));
    if (!hasOre) {
        const orePatches = 3 + Math.floor(rand() * 5);
        for (let i = 0; i < orePatches; i++) {
            const cx = 5 + Math.floor(rand() * (width - 10));
            const cy = 5 + Math.floor(rand() * (height - 10));
            const r = 2 + Math.floor(rand() * 3);
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (dx * dx + dy * dy <= r * r) {
                        const ty = cy + dy, tx = cx + dx;
                        if (ty >= 0 && ty < height && tx >= 0 && tx < width) {
                            if (map[ty][tx] === T.GRASS) {
                                map[ty][tx] = T.ORE;
                            }
                        }
                    }
                }
            }
        }
    }

    // Random trees
    const treeCount = Math.floor(width * height * 0.03);
    for (let i = 0; i < treeCount; i++) {
        const rx = Math.floor(rand() * width);
        const ry = Math.floor(rand() * height);
        if (map[ry][rx] === T.GRASS) {
            map[ry][rx] = T.FOREST;
        }
    }

    // Random rocks
    const rockCount = Math.floor(width * height * 0.008);
    for (let i = 0; i < rockCount; i++) {
        const rx = Math.floor(rand() * width);
        const ry = Math.floor(rand() * height);
        if (map[ry][rx] === T.GRASS) {
            map[ry][rx] = T.ROCK;
        }
    }

    return map;
}

// ===== AUDIO SYSTEM =====
export class AudioSystem {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.enabled = false;
        }
    }

    resume() {
        if (this.ctx?.state === 'suspended') this.ctx.resume();
    }

    play(type) {
        if (!this.enabled || !this.ctx) return;
        this.resume();
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            switch (type) {
                case 'click':
                    osc.frequency.value = 800;
                    osc.type = 'sine';
                    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
                    osc.start(); osc.stop(this.ctx.currentTime + 0.1);
                    break;
                case 'build':
                    osc.frequency.value = 440;
                    osc.type = 'square';
                    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
                    osc.start(); osc.stop(this.ctx.currentTime + 0.3);
                    break;
                case 'attack':
                    osc.frequency.value = 200;
                    osc.type = 'sawtooth';
                    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
                    osc.start(); osc.stop(this.ctx.currentTime + 0.15);
                    break;
                case 'explosion':
                    osc.frequency.value = 80;
                    osc.type = 'sawtooth';
                    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
                    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.4);
                    osc.start(); osc.stop(this.ctx.currentTime + 0.4);
                    break;
                case 'error':
                    osc.frequency.value = 300;
                    osc.type = 'square';
                    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
                    osc.frequency.setValueAtTime(200, this.ctx.currentTime + 0.15);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
                    osc.start(); osc.stop(this.ctx.currentTime + 0.2);
                    break;
                case 'message':
                    osc.frequency.value = 660;
                    osc.type = 'sine';
                    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
                    osc.start(); osc.stop(this.ctx.currentTime + 0.2);
                    break;
                case 'victory':
                    [523, 659, 784, 1047].forEach((f, i) => {
                        const o = this.ctx.createOscillator();
                        const g = this.ctx.createGain();
                        o.connect(g); g.connect(this.ctx.destination);
                        o.frequency.value = f; o.type = 'sine';
                        g.gain.setValueAtTime(0.1, this.ctx.currentTime + i * 0.2);
                        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.2 + 0.3);
                        o.start(this.ctx.currentTime + i * 0.2);
                        o.stop(this.ctx.currentTime + i * 0.2 + 0.3);
                    });
                    break;
                case 'defeat':
                    [400, 350, 300, 200].forEach((f, i) => {
                        const o = this.ctx.createOscillator();
                        const g = this.ctx.createGain();
                        o.connect(g); g.connect(this.ctx.destination);
                        o.frequency.value = f; o.type = 'sawtooth';
                        g.gain.setValueAtTime(0.08, this.ctx.currentTime + i * 0.3);
                        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.3 + 0.4);
                        o.start(this.ctx.currentTime + i * 0.3);
                        o.stop(this.ctx.currentTime + i * 0.3 + 0.4);
                    });
                    break;
            }
        } catch (e) { /* ignore audio errors */ }
    }
}
