// shaders.js — Canvas-2D port of Red Alert 3 shader visual style
// Ports the look of the custom-shaders-RedAlert3 HLSL system:
//  - Fresnel rim glow (Schlick approximation, grazing-angle edge glow)
//  - Point-light glow (up to 8 dynamic lights, radial falloff)
//  - PBR-ish directional body shading
//  - Holographic / stealth shimmer
//  - Starry portal VFX
//  - Skybox backgrounds + invasion-screen transition
// Textures converted from the repo's DDS files to PNG.

import { TILE_SIZE } from './utils.js';

const ASSET_BASE = 'assets/textures/';

class TextureLibrary {
    constructor() {
        this.images = {};
        this.loaded = false;
        this.loading = false;
        this.callbacks = [];
    }
    load() {
        if (this.loading) return;
        this.loading = true;
        const files = {
            skybox_twilight: 'skybox_twilight.png',
            skybox_cloudy: 'skybox_cloudy.png',
            skybox_fantasy: 'skybox_fantasy.png',
            starry_sky: 'starry_sky.png',
            invasion_screen: 'invasion_screen.png',
        };
        let pending = Object.keys(files).length;
        for (const [key, fname] of Object.entries(files)) {
            const img = new Image();
            img.onload = () => { if (--pending === 0) { this.loaded = true; this.callbacks.forEach(c => c()); } };
            img.onerror = () => { if (--pending === 0) { this.loaded = true; this.callbacks.forEach(c => c()); } };
            img.src = ASSET_BASE + fname;
            this.images[key] = img;
        }
    }
    onReady(cb) { if (this.loaded) cb(); else this.callbacks.push(cb); }
    get(key) { return this.images[key]; }
}
export const Textures = new TextureLibrary();

// ---------------------------------------------------------------------------
// FRESNEL RIM GLOW  (port of hp_fresnel Schlick approximation)
//   fresnel = F0 + (1-F0) * pow(dot(L,-V)*0.5+0.5, exponent)
// In 2D top-down we treat the unit silhouette edge as the grazing angle, so the
// rim is brightest at the outline. This gives the signature RA3 "glow" edge.
// ---------------------------------------------------------------------------
export function fresnelRim(ctx, x, y, radius, color, opts = {}) {
    const F0 = opts.F0 ?? 0.15;
    const exponent = opts.exponent ?? 3;
    const intensity = opts.intensity ?? 1;
    // Approximate dot(L,-V)*0.5+0.5 as a constant grazing factor for the rim:
    const rim = F0 + (1 - F0) * Math.pow(0.5, exponent); // edge factor
    const glow = rim * intensity;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(x, y, radius * 0.7, x, y, radius * 1.15);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.82, hexToRgba(color, glow * 0.9));
    grad.addColorStop(1, hexToRgba(color, glow));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// ---------------------------------------------------------------------------
// POINT LIGHT  (port of PointLight[8] system: Color, Position, Range I/O)
// Radial falloff: inner = full, outer = 0.
// ---------------------------------------------------------------------------
export function pointLight(ctx, x, y, range, color, intensity = 1, innerFrac = 0.3) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(x, y, range * innerFrac, x, y, range);
    grad.addColorStop(0, hexToRgba(color, 0.55 * intensity));
    grad.addColorStop(0.5, hexToRgba(color, 0.22 * intensity));
    grad.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// ---------------------------------------------------------------------------
// PBR-ish DIRECTIONAL BODY SHADING
// Simulates a directional key light so unit bodies have form, not flat fills.
// lightDir: {x,y} normalized direction the light comes FROM.
// ---------------------------------------------------------------------------
export function shadedBody(ctx, x, y, w, h, baseColor, lightDir = { x: -0.6, y: -0.8 }, amb = 0.35) {
    const cx = x + w / 2, cy = y + h / 2;
    const lx = lightDir.x, ly = lightDir.y;
    // Light position relative to body center
    const lpx = cx + lx * w, lpy = cy + ly * h;
    const grad = ctx.createRadialGradient(lpx, lpy, w * 0.1, cx, cy, w * 0.9);
    grad.addColorStop(0, lighten(baseColor, 0.5));
    grad.addColorStop(amb, baseColor);
    grad.addColorStop(1, darken(baseColor, 0.55));
    return grad;
}

// ---------------------------------------------------------------------------
// HOLOGRAPHIC / STEALTH SHIMMER  (port of stealth holographic rendering)
// Animated scanline + rim, semi-transparent.
// ---------------------------------------------------------------------------
export function hologram(ctx, x, y, w, h, color, time, alpha = 0.6) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const scan = (Math.sin(time * 0.006 + y * 0.05) + 1) * 0.5;
    const grad = ctx.createLinearGradient(x, y + h * scan, x, y + h * scan + h * 0.2);
    grad.addColorStop(0, hexToRgba(color, 0));
    grad.addColorStop(0.5, hexToRgba(color, 0.8));
    grad.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    fresnelRim(ctx, x + w / 2, y + h / 2, Math.max(w, h) / 2, color, { intensity: 0.8, F0: 0.4 });
    ctx.restore();
}

// ---------------------------------------------------------------------------
// STARRY PORTAL VFX  (port using FXstarrysky256quad.dds)
// Draws the starry texture rotated/scrolling as a portal/teleport effect.
// ---------------------------------------------------------------------------
export function starryVFX(ctx, x, y, size, time, rotation = 0) {
    const tex = Textures.get('starry_sky');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.rotate(rotation + time * 0.0008);
    ctx.globalAlpha = 0.8;
    if (tex && tex.complete) {
        ctx.drawImage(tex, -size / 2, -size / 2, size, size);
    } else {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
        g.addColorStop(0, 'rgba(120,180,255,0.6)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

// ---------------------------------------------------------------------------
// SKYBOX BACKGROUND  (port of skybox_twilight/cloudy/fantasy.dds)
// Draws a parallax sky behind the map (fills letterbox / backdrop areas).
// ---------------------------------------------------------------------------
export function drawSkybox(ctx, w, h, variant = 'twilight', time = 0) {
    const key = variant === 'cloudy' ? 'skybox_cloudy' : variant === 'fantasy' ? 'skybox_fantasy' : 'skybox_twilight';
    const tex = Textures.get(key);
    if (tex && tex.complete) {
        // tile the skybox across the viewport, slowly drifting
        const off = (time * 0.005) % tex.width;
        for (let dx = -off; dx < w; dx += tex.width) {
            for (let dy = 0; dy < h; dy += tex.height) {
                ctx.drawImage(tex, dx, dy, tex.width, tex.height);
            }
        }
    } else {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#1a1030');
        g.addColorStop(0.5, '#2a1a40');
        g.addColorStop(1, '#0a0a14');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }
}

// ---------------------------------------------------------------------------
// INVASION SCREEN TRANSITION  (port of FXscreen_invasion.dds)
// Full-screen wipe used on level start.
// ---------------------------------------------------------------------------
export function drawInvasionScreen(ctx, w, h, progress, hold = 0) {
    // progress 0..1 : reveal then fade
    const tex = Textures.get('invasion_screen');
    ctx.save();
    const a = progress < 0.7 ? progress / 0.7 : Math.max(0, 1 - (progress - 0.7) / 0.3);
    ctx.globalAlpha = a * 0.85;
    if (tex && tex.complete) {
        ctx.drawImage(tex, 0, 0, tex.width, tex.height, 0, 0, w, h);
    } else {
        ctx.fillStyle = '#ff3030';
        ctx.fillRect(0, h * (1 - a), w, h * a);
    }
    ctx.restore();
}

// ---------------------------------------------------------------------------
// TERRAIN DETAIL OVERLAY (port of terrain.fxo smoother detail blending)
// Subtle procedural detail blended over the grass/ground tiles.
// ---------------------------------------------------------------------------
export function terrainDetail(ctx, x, y, size, baseTile, time) {
    // baseTile color, add a faint vignette + noise shimmer for "alive" ground
    ctx.save();
    ctx.globalAlpha = 0.08;
    const n = (Math.sin((x * 12.9898 + y * 78.233)) * 43758.5453) % 1;
    const shade = n < 0 ? n + 1 : n;
    ctx.fillStyle = shade > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(x, y, size, size);
    ctx.restore();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function hexToRgba(hex, a) {
    if (typeof hex === 'string' && !hex.startsWith('#') && hex !== 'red' && hex !== 'blue' && hex !== 'green') {
        // named colors fallback
        const map = { red: '#ff4444', blue: '#4488ff', green: '#44ff66', yellow: '#ffdd44', cyan: '#44ffff', white: '#ffffff', orange: '#ff8822', purple: '#aa66ff' };
        hex = map[hex] || '#ffffff';
    }
    if (typeof hex !== 'string') hex = '#ffffff';
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.substring(0, 2), 16) || 0;
    const g = parseInt(h.substring(2, 4), 16) || 0;
    const b = parseInt(h.substring(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${a})`;
}

export function lighten(hex, amt) {
    const { r, g, b } = toRGB(hex);
    return `rgb(${Math.min(255, r + 255 * amt) | 0},${Math.min(255, g + 255 * amt) | 0},${Math.min(255, b + 255 * amt) | 0})`;
}
export function darken(hex, amt) {
    const { r, g, b } = toRGB(hex);
    return `rgb(${(r * (1 - amt)) | 0},${(g * (1 - amt)) | 0},${(b * (1 - amt)) | 0})`;
}
function toRGB(hex) {
    let h = (typeof hex === 'string' ? hex : '#888888').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return { r: parseInt(h.substring(0, 2), 16) || 0, g: parseInt(h.substring(2, 4), 16) || 0, b: parseInt(h.substring(4, 6), 16) || 0 };
}
