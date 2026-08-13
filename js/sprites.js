// sprites.js — Procedural Red Alert-style top-down sprite art.
// Replaces emoji/box placeholders with faction-colored vector sprites:
//  - Buildings: team-roofed structures with type-specific detailing
//  - Units: tanks (treads+turret+barrel), infantry figures, helis, transports
// Faction colors: player (Allied blue), enemy (Soviet red), neutral (grey).

import { TILE_SIZE, TEAM } from './utils.js';

function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function barrel(ctx, len, colors, wgt) {
    ctx.strokeStyle = colors.light;
    ctx.lineWidth = wgt;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
}

// ============================ BUILDINGS ============================
export function drawBuilding(ctx, e, colors, game) {
    const px = e.tileX * TILE_SIZE, py = e.tileY * TILE_SIZE;
    const w = e.sizeW * TILE_SIZE, h = e.sizeH * TILE_SIZE;
    const cx = px + w / 2, cy = py + h / 2;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rr(ctx, px + 3, py + 5, w - 2, h - 2, 6); ctx.fill();

    // Body
    const grad = ctx.createLinearGradient(px, py, px, py + h);
    grad.addColorStop(0, colors.light);
    grad.addColorStop(0.45, colors.primary);
    grad.addColorStop(1, colors.dark);
    ctx.fillStyle = grad;
    rr(ctx, px + 2, py + 2, w - 4, h - 4, 6); ctx.fill();
    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 2;
    rr(ctx, px + 2, py + 2, w - 4, h - 4, 6); ctx.stroke();

    // Roof inset
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    rr(ctx, px + w * 0.18, py + h * 0.18, w * 0.64, h * 0.64, 4); ctx.fill();

    drawBuildingDetail(ctx, e.type, cx, cy, w, h, colors, game, e);
}

function drawBuildingDetail(ctx, type, cx, cy, w, h, colors, game, e) {
    const s = Math.min(w, h);
    ctx.save();
    ctx.translate(cx, cy);
    const dark = '#1a1a22', light = colors.light;
    switch (type) {
        case 'construction_yard': {
            ctx.strokeStyle = colors.secondary; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-s*0.3, -s*0.35); ctx.lineTo(-s*0.3, s*0.3); ctx.lineTo(s*0.3, s*0.3); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-s*0.3, -s*0.35); ctx.lineTo(s*0.35, -s*0.35); ctx.stroke();
            ctx.fillStyle = colors.secondary; ctx.beginPath(); ctx.arc(s*0.35, -s*0.35, 3, 0, 7); ctx.fill();
            break;
        }
        case 'power_plant':
        case 'advanced_power': {
            const n = type === 'advanced_power' ? 3 : 2;
            for (let i = 0; i < n; i++) {
                const ox = (i - (n-1)/2) * s * 0.28;
                ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(ox, 0, s*0.18, 0, 7); ctx.fill();
                ctx.strokeStyle = light; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox, 0, s*0.18, 0, 7); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(ox, -s*0.05, s*0.09, 0, 7); ctx.fill();
            }
            break;
        }
        case 'ore_refinery': {
            ctx.fillStyle = dark;
            ctx.beginPath(); ctx.moveTo(-s*0.25, s*0.3); ctx.lineTo(-s*0.12, -s*0.2); ctx.lineTo(s*0.12, -s*0.2); ctx.lineTo(s*0.25, s*0.3); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#d9a441'; // ore pile
            ctx.beginPath(); ctx.arc(-s*0.28, s*0.28, s*0.1, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.arc(s*0.3, s*0.2, s*0.08, 0, 7); ctx.fill();
            break;
        }
        case 'barracks': {
            drawStar(ctx, 0, 0, s * 0.22, colors.secondary);
            ctx.fillStyle = dark; rr(ctx, -s*0.18, s*0.18, s*0.36, s*0.18, 2); ctx.fill();
            break;
        }
        case 'war_factory': {
            ctx.strokeStyle = colors.secondary; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, s*0.1, s*0.32, Math.PI, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-s*0.32, s*0.1); ctx.lineTo(-s*0.32, s*0.32); ctx.lineTo(s*0.32, s*0.32); ctx.lineTo(s*0.32, s*0.1); ctx.stroke();
            break;
        }
        case 'radar_dome': {
            ctx.fillStyle = dark;
            ctx.beginPath(); ctx.arc(0, s*0.05, s*0.3, Math.PI, 0); ctx.fill();
            ctx.strokeStyle = light; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, s*0.05, s*0.3, Math.PI, 0); ctx.stroke();
            ctx.strokeStyle = colors.secondary; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, s*0.05); ctx.lineTo(s*0.25, -s*0.3); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, s*0.05); ctx.lineTo(-s*0.2, -s*0.28); ctx.stroke();
            break;
        }
        case 'turret':
        case 'tesla_coil': {
            const ang = (e && e.attackTarget) ? Math.atan2(e.attackTarget.y - e.y, e.attackTarget.x - e.x) : (e ? e.facing : 0);
            ctx.rotate(ang);
            if (type === 'tesla_coil') {
                ctx.fillStyle = dark; rr(ctx, -s*0.12, -s*0.3, s*0.24, s*0.55, 3); ctx.fill();
                ctx.fillStyle = light; ctx.beginPath(); ctx.arc(0, -s*0.3, s*0.13, 0, 7); ctx.fill();
                ctx.strokeStyle = light; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -s*0.3, s*0.2, 0, 7); ctx.stroke();
            } else {
                ctx.fillStyle = dark; rr(ctx, -s*0.2, -s*0.1, s*0.4, s*0.25, 3); ctx.fill();
                ctx.fillStyle = colors.secondary; ctx.beginPath(); ctx.arc(0, 0, s*0.14, 0, 7); ctx.fill();
                barrel(ctx, s*0.45, colors, s*0.08);
            }
            break;
        }
        case 'aa_gun': {
            const ang = (e && e.attackTarget) ? Math.atan2(e.attackTarget.y - e.y, e.attackTarget.x - e.x) : (e ? e.facing : 0);
            ctx.rotate(ang);
            ctx.fillStyle = dark; rr(ctx, -s*0.18, -s*0.12, s*0.36, s*0.24, 3); ctx.fill();
            ctx.strokeStyle = colors.light; ctx.lineWidth = s*0.06; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(s*0.5, -s*0.12); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(s*0.5, s*0.12); ctx.stroke();
            break;
        }
        case 'pillbox': {
            ctx.fillStyle = dark; rr(ctx, -s*0.28, -s*0.22, s*0.56, s*0.44, 3); ctx.fill();
            ctx.fillStyle = '#000'; ctx.fillRect(-s*0.18, -s*0.06, s*0.36, s*0.12);
            ctx.fillStyle = colors.secondary; ctx.fillRect(-s*0.06, -s*0.06, s*0.12, s*0.12);
            break;
        }
        case 'service_depot': {
            drawCross(ctx, 0, 0, s * 0.3, colors.secondary);
            break;
        }
        case 'tech_center': {
            ctx.strokeStyle = colors.secondary; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, s*0.2, 0, 7); ctx.stroke();
            for (let i = 0; i < 3; i++) {
                ctx.save(); ctx.rotate(i * Math.PI / 3 + game.gameTime * 0.3);
                ctx.beginPath(); ctx.ellipse(0, 0, s*0.28, s*0.1, 0, 0, 7); ctx.stroke();
                ctx.restore();
            }
            ctx.fillStyle = colors.secondary; ctx.beginPath(); ctx.arc(0,0,s*0.07,0,7); ctx.fill();
            break;
        }
        case 'nuclear_silo': {
            ctx.fillStyle = dark; rr(ctx, -s*0.2, -s*0.05, s*0.4, s*0.35, 3); ctx.fill();
            ctx.fillStyle = colors.secondary;
            ctx.beginPath(); ctx.moveTo(0, -s*0.4); ctx.lineTo(-s*0.13, -s*0.05); ctx.lineTo(s*0.13, -s*0.05); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ffcc33'; ctx.font = `bold ${s*0.18}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText('☢', 0, s*0.15);
            break;
        }
        case 'chronosphere': {
            ctx.strokeStyle = colors.secondary; ctx.lineWidth = 2;
            for (let i = 1; i <= 3; i++) {
                ctx.save(); ctx.rotate(game.gameTime * 0.5 * i);
                ctx.beginPath(); ctx.arc(0, 0, s * 0.12 * i, 0, 7); ctx.stroke();
                ctx.restore();
            }
            break;
        }
        case 'iron_curtain': {
            ctx.strokeStyle = colors.secondary; ctx.lineWidth = 3;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath(); ctx.arc(0, 0, s*0.12 + i*s*0.09, Math.PI*0.2, Math.PI*1.8); ctx.stroke();
            }
            break;
        }
        case 'weather_control': {
            ctx.fillStyle = 'rgba(200,200,220,0.5)';
            ctx.beginPath(); ctx.ellipse(0, -s*0.05, s*0.3, s*0.16, 0, 0, 7); ctx.fill();
            ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(s*0.05, s*0.05); ctx.lineTo(-s*0.05, s*0.18); ctx.lineTo(s*0.03, s*0.18); ctx.lineTo(-s*0.04, s*0.32); ctx.stroke();
            break;
        }
        case 'airfield': {
            ctx.strokeStyle = colors.secondary; ctx.lineWidth = 3;
            ctx.strokeRect(-s*0.38, -s*0.28, s*0.76, s*0.56);
            ctx.fillStyle = colors.secondary; ctx.font = `bold ${s*0.4}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText('H', 0, 0);
            break;
        }
        case 'wall': {
            ctx.strokeStyle = colors.dark; ctx.lineWidth = 1.5;
            for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
                ctx.strokeRect(i*s*0.18 - s*0.09, j*s*0.18 - s*0.09, s*0.18, s*0.18);
            }
            break;
        }
        default: {
            ctx.fillStyle = colors.secondary;
            ctx.beginPath(); ctx.arc(0, 0, s*0.2, 0, 7); ctx.fill();
        }
    }
    ctx.restore();
}

function drawStar(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.45;
        const a = Math.PI / 5 * i - Math.PI / 2;
        const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
}
function drawCross(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x - r*0.18, y - r*0.5, r*0.36, r);
    ctx.fillRect(x - r*0.5, y - r*0.18, r, r*0.36);
}

// ============================ UNITS ============================
export function drawUnit(ctx, e, colors, game) {
    // ctx already translated to (e.x, e.y); caller handled air bob.
    const size = TILE_SIZE * e.size * 0.42;
    const rotates = ['light_tank', 'heavy_tank', 'mammoth_tank', 'tesla_tank',
        'artillery', 'harvester', 'apc', 'ifv', 'flak_truck'];
    const ang = e.facing || 0;
    ctx.save();
    if (rotates.includes(e.type)) ctx.rotate(ang);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, size*0.5, size*0.85, size*0.32, 0, 0, 7); ctx.fill();

    switch (e.type) {
        case 'infantry':
        case 'rocket_soldier':
        case 'grenadier':
        case 'engineer':
        case 'spy':
        case 'medic':
        case 'commando':
            drawSoldier(ctx, e, size, colors, game);
            break;
        case 'light_tank':
        case 'heavy_tank':
            drawTank(ctx, size, colors, e.type === 'heavy_tank' ? 1.15 : 1, false);
            break;
        case 'mammoth_tank':
            drawTank(ctx, size * 1.3, colors, 1.3, true);
            break;
        case 'tesla_tank':
            drawTank(ctx, size * 1.1, colors, 1.1, false, true);
            break;
        case 'artillery':
            drawTank(ctx, size, colors, 1, false, false, 1.8);
            break;
        case 'harvester':
            drawHarvester(ctx, size * 1.2, colors);
            break;
        case 'apc':
        case 'ifv':
            drawTransport(ctx, size, colors, e.type === 'ifv');
            break;
        case 'flak_truck':
            drawTank(ctx, size, colors, 1, false, false, 1, true);
            break;
        case 'helicopter':
            drawHeli(ctx, size, colors, game, e);
            break;
        default:
            drawTank(ctx, size, colors, 1, false);
    }
    ctx.restore();
}

function drawSoldier(ctx, e, size, colors, game) {
    const c = colors.primary;
    // body
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(0, size*0.25, size*0.32, size*0.4, 0, 0, 7); ctx.fill();
    // head
    ctx.fillStyle = '#e8c39e';
    ctx.beginPath(); ctx.arc(0, -size*0.35, size*0.28, 0, 7); ctx.fill();
    // helmet
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -size*0.4, size*0.3, Math.PI, 0); ctx.fill();
    // gun
    ctx.strokeStyle = '#222'; ctx.lineWidth = size*0.1; ctx.lineCap='round';
    if (e.type === 'rocket_soldier') { ctx.beginPath(); ctx.moveTo(size*0.2, -size*0.1); ctx.lineTo(size*0.5, size*0.1); ctx.stroke(); }
    else if (e.type === 'medic') { drawCross(ctx, 0, -size*0.05, size*0.5, '#ff4444'); }
    else if (e.type === 'commando') { ctx.lineWidth = size*0.14; ctx.beginPath(); ctx.moveTo(size*0.25, -size*0.1); ctx.lineTo(size*0.6, size*0.15); ctx.stroke(); }
    else if (e.type === 'spy') { ctx.strokeStyle = 'rgba(180,180,255,0.7)'; ctx.setLineDash([2,2]); ctx.beginPath(); ctx.moveTo(size*0.2,0); ctx.lineTo(size*0.45,size*0.2); ctx.stroke(); ctx.setLineDash([]); }
    else { ctx.beginPath(); ctx.moveTo(size*0.2, 0); ctx.lineTo(size*0.5, size*0.2); ctx.stroke(); }
}

function drawTank(ctx, size, colors, scale, mammoth, tesla, barrelLen, flak) {
    const s = size * scale;
    // treads
    ctx.fillStyle = '#1c1c22';
    rr(ctx, -s*1.0, -s*0.55, s*0.32, s*1.1, 3); ctx.fill();
    rr(ctx, s*0.68, -s*0.55, s*0.32, s*1.1, 3); ctx.fill();
    // body
    const grad = ctx.createLinearGradient(0, -s*0.5, 0, s*0.5);
    grad.addColorStop(0, colors.light); grad.addColorStop(1, colors.dark);
    ctx.fillStyle = grad;
    rr(ctx, -s*0.7, -s*0.5, s*1.4, s*1.0, 4); ctx.fill();
    ctx.strokeStyle = colors.dark; ctx.lineWidth = 1.5; rr(ctx, -s*0.7, -s*0.5, s*1.4, s*1.0, 4); ctx.stroke();
    // turret
    ctx.fillStyle = colors.secondary;
    ctx.beginPath(); ctx.arc(0, 0, s*0.42, 0, 7); ctx.fill();
    if (tesla) {
        ctx.fillStyle = colors.light; ctx.beginPath(); ctx.arc(0, 0, s*0.22, 0, 7); ctx.fill();
        ctx.strokeStyle = colors.light; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, s*0.34, 0, 7); ctx.stroke();
    }
    // barrel(s)
    if (mammoth) {
        barrel(ctx, s*1.0, colors, s*0.12);
        ctx.save(); ctx.rotate(0.12); barrel(ctx, s*1.0, colors, s*0.12); ctx.restore();
        ctx.save(); ctx.rotate(-0.12); barrel(ctx, s*1.0, colors, s*0.12); ctx.restore();
    } else if (flak) {
        ctx.strokeStyle = colors.light; ctx.lineWidth = s*0.1; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(s*0.9, -s*0.25); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(s*0.9, s*0.25); ctx.stroke();
    } else {
        barrel(ctx, s * (barrelLen || 1.1), colors, s*0.12);
    }
    if (mammoth) { // missile pods
        ctx.fillStyle = colors.dark; ctx.fillRect(-s*0.6, -s*0.7, s*0.2, s*0.3); ctx.fillRect(s*0.4, -s*0.7, s*0.2, s*0.3);
    }
}

function drawHarvester(ctx, size, colors) {
    const s = size;
    ctx.fillStyle = '#1c1c22';
    rr(ctx, -s*1.0, -s*0.55, s*0.3, s*1.1, 3); ctx.fill();
    rr(ctx, s*0.7, -s*0.55, s*0.3, s*1.1, 3); ctx.fill();
    ctx.fillStyle = colors.dark; rr(ctx, -s*0.7, -s*0.5, s*1.4, s*1.0, 4); ctx.fill();
    ctx.fillStyle = colors.secondary; rr(ctx, -s*0.55, -s*0.4, s*0.7, s*0.8, 3); ctx.fill();
    // ore bin
    ctx.fillStyle = '#d9a441'; rr(ctx, s*0.2, -s*0.35, s*0.5, s*0.7, 3); ctx.fill();
    ctx.fillStyle = colors.light; ctx.beginPath(); ctx.arc(-s*0.2, -s*0.05, s*0.18, 0, 7); ctx.fill();
    barrel(ctx, s*0.7, colors, s*0.1);
}

function drawTransport(ctx, size, colors, ifv) {
    const s = size;
    ctx.fillStyle = '#1c1c22';
    rr(ctx, -s*1.0, -s*0.5, s*0.28, s*1.0, 3); ctx.fill();
    rr(ctx, s*0.72, -s*0.5, s*0.28, s*1.0, 3); ctx.fill();
    ctx.fillStyle = colors.primary; rr(ctx, -s*0.75, -s*0.5, s*1.5, s*1.0, 3); ctx.fill();
    ctx.strokeStyle = colors.dark; ctx.lineWidth = 1.5; rr(ctx, -s*0.75, -s*0.5, s*1.5, s*1.0, 3); ctx.stroke();
    ctx.fillStyle = colors.secondary; rr(ctx, -s*0.6, -s*0.32, s*0.9, s*0.64, 2); ctx.fill();
    if (ifv) { ctx.fillStyle = colors.dark; ctx.beginPath(); ctx.arc(s*0.1, 0, s*0.2, 0, 7); ctx.fill(); barrel(ctx, s*0.7, colors, s*0.1); }
    else { ctx.fillStyle = colors.light; ctx.fillRect(-s*0.1, -s*0.12, s*0.2, s*0.24); } // troop slot
}

function drawHeli(ctx, size, colors, game, e) {
    const s = size;
    // shadow already drawn; rotor
    ctx.save();
    ctx.strokeStyle = 'rgba(220,220,220,0.6)'; ctx.lineWidth = 2;
    const rot = game.gameTime * 12;
    ctx.beginPath(); ctx.moveTo(-Math.cos(rot)*s*0.9, -Math.sin(rot)*s*0.9); ctx.lineTo(Math.cos(rot)*s*0.9, Math.sin(rot)*s*0.9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-Math.cos(rot+1.57)*s*0.7, -Math.sin(rot+1.57)*s*0.7); ctx.lineTo(Math.cos(rot+1.57)*s*0.7, Math.sin(rot+1.57)*s*0.7); ctx.stroke();
    ctx.restore();
    // body
    ctx.fillStyle = colors.primary; ctx.beginPath(); ctx.ellipse(0, 0, s*0.7, s*0.45, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = colors.dark; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, s*0.7, s*0.45, 0, 0, 7); ctx.stroke();
    // tail
    ctx.fillStyle = colors.dark; ctx.fillRect(s*0.5, -s*0.12, s*0.5, s*0.24);
    // cockpit
    ctx.fillStyle = colors.light; ctx.beginPath(); ctx.arc(-s*0.1, 0, s*0.18, 0, 7); ctx.fill();
    // gun
    barrel(ctx, s*0.7, colors, s*0.1);
}
