import Phaser from 'phaser';
import type { ActionKind, Resident, ResourceNode, Season } from '../../shared/types';
import { appearance } from '../../shared/appearance';
import { palettes } from './palette';

// All art is generated at runtime as small pixel textures, so there are no image assets to ship.
const hex = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;
function paint(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false); draw(g); g.generateTexture(key, w, h); g.destroy(); return key;
}
const px = (g: Phaser.GameObjects.Graphics, c: number, x: number, y: number, w = 1, h = 1, a = 1) => { g.fillStyle(c, a).fillRect(x, y, w, h); };
function blob(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, [dark, mid, light]: number[], seed: number) {
  g.fillStyle(dark).fillCircle(cx, cy + r * .15, r);
  g.fillStyle(dark).fillCircle(cx - r * .7, cy + r * .35, r * .7).fillCircle(cx + r * .72, cy + r * .3, r * .68);
  g.fillStyle(mid).fillCircle(cx - r * .12, cy - r * .08, r * .82).fillCircle(cx - r * .62, cy + r * .12, r * .52).fillCircle(cx + r * .55, cy + r * .05, r * .55);
  g.fillStyle(light).fillCircle(cx - r * .32, cy - r * .38, r * .42).fillCircle(cx + r * .2, cy - r * .5, r * .28);
  for (let i = 0; i < 7; i++) { const a = seed * 1.7 + i * 2.1, d = r * (.35 + (i % 3) * .2); px(g, i % 2 ? light : dark, Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * .8), 2, 2); }
}
function trunk(g: Phaser.GameObjects.Graphics, cx: number, bottom: number, width: number, height: number, snow = false) {
  px(g, 0x5e4630, cx - width / 2, bottom - height, width, height); px(g, 0x7a5d40, cx - width / 2 + 1, bottom - height, Math.max(1, width / 3), height);
  px(g, 0x4b3826, cx - width / 2 - 1, bottom - 2, width + 2, 2); if (snow) px(g, 0xffffff, cx - width / 2 - 1, bottom - 1, width + 2, 1);
}
function bareBranches(g: Phaser.GameObjects.Graphics, cx: number, bottom: number, scale: number) {
  g.lineStyle(Math.max(1, 2 * scale), 0x5e4630);
  const limbs = [[0, -28, -10, -40], [0, -24, 12, -38], [0, -32, 2, -46], [-6, -34, -14, -44], [6, -32, 15, -42], [-3, -20, -16, -28], [3, -18, 16, -26]];
  for (const [x1, y1, x2, y2] of limbs) g.lineBetween(cx + x1 * scale, bottom + y1 * scale, cx + x2 * scale, bottom + y2 * scale);
  for (const [, , x2, y2] of limbs) px(g, 0xffffff, Math.round(cx + x2 * scale - 1), Math.round(bottom + y2 * scale - 1), 3, 2);
}
export function treeKey(scene: Phaser.Scene, n: ResourceNode, season: Season): string {
  const p = palettes[season], variant = n.id.length % p.leaves.length, snow = p.snow;
  const kind = n.kind === 'elder' ? 'elder' : n.kind === 'pine' ? 'pine' : 'oak';
  if (n.stage === 'stump') return paint(scene, `stump-${kind}-${season}`, 20, 14, g => { px(g, 0x6b4e33, 3, 5, 14, 7); g.fillStyle(0xa3805a).fillEllipse(10, 5, 14, 7); g.lineStyle(1, 0x7d5d3d).strokeEllipse(10, 5, 8, 4); px(g, 0x4b3826, 2, 11, 16, 2); if (snow) g.fillStyle(0xffffff).fillEllipse(10, 4, 12, 4); });
  if (n.stage === 'sapling') return paint(scene, `sapling-${kind}-${season}`, 12, 16, g => { px(g, 0x6b4e33, 5, 6, 2, 10); if (!snow || kind === 'pine') { const [d, m] = kind === 'pine' ? p.pine : p.leaves[variant]; g.fillStyle(m).fillEllipse(3, 6, 6, 4).fillEllipse(9, 4, 6, 4); px(g, d, 5, 2, 2, 3); } else px(g, 0xffffff, 4, 5, 4, 1); });
  const young = n.stage === 'young', s = young ? .62 : 1, w = Math.round((kind === 'elder' ? 64 : 44) * s), h = Math.round((kind === 'elder' ? 72 : 54) * s);
  return paint(scene, `${kind}-${n.stage}-${season}-${variant}`, w, h, g => {
    const cx = w / 2, bottom = h;
    if (kind === 'pine') {
      trunk(g, cx, bottom, 5 * s, 10 * s, snow); const [d, m, l] = p.pine;
      for (let i = 0; i < 4; i++) { const top = bottom - (12 + i * 10) * s - 12 * s, half = (18 - i * 3.5) * s, base = top + 16 * s; g.fillStyle(d).fillTriangle(cx, top, cx - half, base, cx + half, base); g.fillStyle(m).fillTriangle(cx, top + 2, cx - half * .75, base - 2, cx + half * .35, base - 3); if (snow) g.fillStyle(l).fillTriangle(cx, top, cx - half * .45, top + 7 * s, cx + half * .45, top + 7 * s); else px(g, l, cx - 3, top + 5, 2, 2); }
      return;
    }
    const elder = kind === 'elder';
    trunk(g, cx, bottom, (elder ? 12 : 6) * s, (elder ? 22 : 14) * s, snow);
    if (elder) { px(g, 0x7a8f4a, cx - 6 * s, bottom - 14 * s, 3, 5); px(g, 0x4b3826, cx - 10 * s, bottom - 4 * s, 4, 3); px(g, 0x4b3826, cx + 7 * s, bottom - 4 * s, 4, 3); }
    if (snow) { bareBranches(g, cx, bottom, elder ? 1.35 * s : s); return; }
    const colors = elder ? [0x2f5a33, 0x3f7240, 0x5c8f55] : p.leaves[variant];
    const leaves = elder && season === 'autumn' ? [0x8f4a26, 0xb86a2c, 0xd9a03a] : elder && season === 'spring' ? [0x3f7a3a, 0x5a9446, 0x7fb65c] : colors;
    blob(g, cx, bottom - (elder ? 42 : 30) * s, (elder ? 25 : 16) * s, leaves, n.x + n.y);
    if (season === 'spring' && !elder) for (let i = 0; i < 6; i++) px(g, 0xf6c3d6, Math.round(cx - 10 * s + ((i * 7 + n.x) % 20) * s), Math.round(bottom - (38 - (i * 5 % 16)) * s), 2, 2);
  });
}
export function hallOakKey(scene: Phaser.Scene, season: Season) {
  return paint(scene, `hall-oak-${season}`, 112, 118, g => {
    const p = palettes[season], cx = 56, bottom = 118;
    trunk(g, cx, bottom, 18, 38, p.snow); px(g, 0x4b3826, cx - 16, bottom - 5, 8, 5); px(g, 0x4b3826, cx + 9, bottom - 5, 8, 5);
    if (p.snow) { bareBranches(g, cx, bottom - 6, 2.1); return; }
    const leaves = season === 'autumn' ? [0x9a5a26, 0xc9822e, 0xe8b546] : season === 'spring' ? [0x4a8440, 0x66a24e, 0x8cc466] : [0x3a6a36, 0x4d8541, 0x6ca552];
    blob(g, cx, bottom - 72, 40, leaves, 7);
    for (let i = 0; i < 5; i++) { const x = cx - 32 + i * 16; g.lineStyle(1, 0x3a2e22).lineBetween(x, bottom - 52 + (i % 2) * 4, x, bottom - 44 + (i % 2) * 4); px(g, 0xf3c96a, x - 2, bottom - 44 + (i % 2) * 4, 4, 4); }
  });
}
export function rockKey(scene: Phaser.Scene, n: ResourceNode, season: Season) {
  const size = n.stage === 'spent' ? 0 : n.amount >= 16 ? 3 : n.amount >= 7 ? 2 : 1, snow = palettes[season].snow;
  return paint(scene, `rock-${size}-${snow}-${n.id.length % 2}`, 28, 22, g => {
    if (!size) { for (const [x, y] of [[6, 16], [12, 18], [18, 15], [22, 18]]) { px(g, 0x7c7e76, x, y, 4, 3); px(g, 0xa3a59b, x, y, 3, 1); } return; }
    const w = 10 + size * 5, h = 6 + size * 4, x = 14 - w / 2, y = 22 - h;
    g.fillStyle(0x5f615a).fillEllipse(14, 22 - h / 2, w, h); g.fillStyle(0x8d8f86).fillEllipse(13, 21 - h / 2, w - 3, h - 2); g.fillStyle(0xaeb0a5).fillEllipse(11, 19 - h / 2, w * .5, h * .45);
    if (size === 3) { g.fillStyle(0x7a7c73).fillEllipse(20, 19, 9, 6); px(g, 0x5f615a, x + 5, y + h - 4, 6, 1); }
    if (snow) g.fillStyle(0xffffff).fillEllipse(13, y + 2, w * .7, 4);
  });
}
// A clay pit: a wet, ochre scrape in the bank that empties as it is dug and refills in spring.
export function clayKey(scene: Phaser.Scene, n: ResourceNode, season: Season) {
  const full = n.stage === 'spent' ? 0 : n.amount >= 12 ? 3 : n.amount >= 5 ? 2 : 1, snow = palettes[season].snow;
  return paint(scene, `clay-${full}-${snow}`, 20, 14, g => {
    g.fillStyle(0x6e4a32).fillEllipse(10, 8, 18, 10); g.fillStyle(full ? 0xa8643c : 0x7d5a40).fillEllipse(10, 8, 15, 7);
    if (full) { g.fillStyle(0xc47a4a).fillEllipse(8, 7, 9 + full, 3 + full / 2); px(g, 0xd99a6a, 5, 6, 3, 1); px(g, 0x5f8fa0, 13, 10, 3, 1); }
    else px(g, 0x5f8fa0, 7, 8, 6, 2, .8);
    if (snow) g.fillStyle(0xffffff).fillEllipse(10, 4, 14, 3);
  });
}
// A reed bed: tall stems with brown seed heads, cut to stubble when harvested and bare in winter.
export function reedKey(scene: Phaser.Scene, n: ResourceNode, season: Season) {
  const tall = n.stage === 'spent' ? 0 : Math.min(3, Math.ceil(n.amount / 2)), p = palettes[season];
  return paint(scene, `reeds-${tall}-${season}`, 18, 24, g => {
    const stem = p.snow ? 0xb8a77a : season === 'autumn' ? 0xb59a52 : 0x5f8a3e, light = p.snow ? 0xd8cba0 : season === 'autumn' ? 0xd4b766 : 0x7fae55;
    for (let i = 0; i < 7; i++) { const x = 2 + i * 2.2, h = tall ? 8 + tall * 4 - (i % 3) * 2 : 3; px(g, i % 2 ? stem : light, Math.round(x), 23 - h, 1, h); if (tall && season !== 'spring' && i % 2 === 0) px(g, 0x6b4a2e, Math.round(x) - 1, 23 - h - 2, 3, 3); }
    if (p.snow) px(g, 0xffffff, 1, 20, 16, 2);
  });
}
export function bushKey(scene: Phaser.Scene, n: ResourceNode, season: Season) {
  const p = palettes[season], berries = season === 'winter' ? 0 : Math.min(4, n.amount), blue = n.x % 3 === 0;
  return paint(scene, `bush-${season}-${berries}-${blue}`, 20, 16, g => {
    if (p.snow) { g.lineStyle(1, 0x6e5a45); for (const [x, y] of [[10, 4], [4, 7], [16, 6], [7, 3], [13, 3]]) g.lineBetween(10, 15, x, y); g.fillStyle(0xffffff).fillEllipse(10, 5, 12, 3); return; }
    g.fillStyle(p.bush[0]).fillEllipse(10, 10, 18, 11); g.fillStyle(p.bush[1]).fillEllipse(9, 8, 13, 8); px(g, p.bush[0], 5, 13, 10, 2);
    for (let i = 0; i < berries * 2; i++) px(g, blue ? 0x4d5fc9 : 0xc9334d, 4 + (i * 5) % 12, 5 + (i * 3) % 7, 2, 2);
  });
}
// Resident sprites: front and back views, three frames each, with a scarf in winter.
export function residentKeys(scene: Phaser.Scene, r: Resident, season: Season, age = 30) {
  const a = appearance(r.id, r.role, age), look = `${r.role}-${age >= 60 ? 'grey' : 'dark'}`, shirt = hex(r.color), skin = hex(a.skin), shade = hex(a.skinShade), hair = hex(a.hair), pants = hex(a.pants), winter = season === 'winter';
  const keys: Record<string, string> = {};
  for (const view of ['f', 'b'] as const) for (const frame of [0, 1, 2]) {
    keys[view + frame] = paint(scene, `res-${r.id}-${look}-${season}-${view}${frame}`, 16, 24, g => {
      const step = frame === 1 ? -1 : frame === 2 ? 1 : 0;
      px(g, pants, 5, 17, 2, 5 + (step < 0 ? -1 : 0)); px(g, pants, 9, 17, 2, 5 + (step > 0 ? -1 : 0));
      px(g, 0x3b3128, 4 + (step < 0 ? 0 : 0), 21 + (step < 0 ? -1 : 0), 3, 2); px(g, 0x3b3128, 9, 21 + (step > 0 ? -1 : 0), 3, 2);
      px(g, shirt, 4, 10, 8, 8); px(g, Phaser.Display.Color.IntegerToColor(shirt).darken(18).color, 4, 16, 8, 2);
      px(g, skin, 2 + (step > 0 ? 0 : 0), 11 + (view === 'f' ? step : -step), 2, 5); px(g, skin, 12, 11 + (view === 'f' ? -step : step), 2, 5);
      px(g, shirt, 2, 10, 2, 3); px(g, shirt, 12, 10, 2, 3);
      if (view === 'f' && a.accessory === 'apron') { px(g, 0xf3ecd8, 5, 12, 6, 6); px(g, 0xd9cfb6, 5, 12, 6, 1); }
      if (a.accessory === 'belt') { px(g, 0x5a4330, 4, 15, 8, 1); px(g, 0xc9a45a, 7, 15, 2, 1); }
      if (a.accessory === 'satchel') { px(g, 0x7a5a3a, view === 'f' ? 10 : 4, 13, 3, 4); g.lineStyle(1, 0x7a5a3a).lineBetween(5, 10, 11, 14); }
      if (winter) { px(g, 0xc9453f, 4, 9, 8, 2); px(g, 0xa9352f, view === 'f' ? 9 : 5, 10, 2, 4); }
      px(g, skin, 4, 2, 8, 8); px(g, shade, 4, 8, 8, 1);
      if (view === 'f') { px(g, 0x2a2622, 6, 5, 1, 2); px(g, 0x2a2622, 9, 5, 1, 2); px(g, 0xe79a8a, 5, 7, 1, 1); px(g, 0xe79a8a, 10, 7, 1, 1); }
      const back = view === 'b';
      if (a.hairStyle === 'short') { px(g, hair, 4, 1, 8, 3); px(g, hair, 3, 2, 1, 4); px(g, hair, 12, 2, 1, 4); if (back) px(g, hair, 4, 4, 8, 4); }
      if (a.hairStyle === 'long') { px(g, hair, 4, 1, 8, 3); px(g, hair, 3, 2, 2, 9); px(g, hair, 11, 2, 2, 9); if (back) px(g, hair, 4, 4, 8, 7); }
      if (a.hairStyle === 'bun') { px(g, hair, 4, 1, 8, 3); px(g, hair, 6, -1 + 1, 4, 2); px(g, hair, 3, 2, 1, 3); px(g, hair, 12, 2, 1, 3); if (back) px(g, hair, 4, 3, 8, 4); }
      if (a.hairStyle === 'curly') { for (const [x, y] of [[3, 1], [5, 0], [7, 1], [9, 0], [11, 1], [3, 3], [12, 3], [3, 5], [12, 5]]) px(g, hair, x, y + 1, 2, 2); if (back) px(g, hair, 4, 3, 8, 5); }
      if (a.hairStyle === 'cap' || a.accessory === 'hat' || winter) {
        const c = winter && a.accessory !== 'hat' ? 0x6d86a8 : hex(a.hat);
        px(g, c, 3, 0, 10, 3); px(g, c, a.accessory === 'hat' ? 1 : 4, 3, a.accessory === 'hat' ? 14 : 9, 1); if (back) px(g, hair, 4, 4, 8, 3);
        if (winter && a.accessory !== 'hat') px(g, 0xf5f5f5, 7, -1 + 1, 2, 1);
      }
    });
  }
  return keys;
}
export function glowKey(scene: Phaser.Scene) {
  if (scene.textures.exists('glow')) return 'glow';
  const canvas = scene.textures.createCanvas('glow', 128, 128)!, ctx = canvas.getContext();
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.25, 'rgba(255,255,255,.55)'); gradient.addColorStop(.6, 'rgba(255,255,255,.14)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128); canvas.refresh(); return 'glow';
}
// Nine-pixel activity icons. Each character picks a palette color; '.' is transparent.
const iconArt: Record<ActionKind, [string, string[]]> = {
  experiment: ['yo', ['....y....', '.y..y..y.', '..y.y.y..', '...ooo...', '..ooooo..', '..ooooo..', '...ooo...', '.........', '.........']],
  teach: ['wb', ['.ww...bb.', '.ww...bb.', '.........', 'wwww.bbbb', '.ww...bb.', '.ww...bb.', '.w.w.b..b', '.........', '.........']],
  repair: ['bw', ['.w.......', 'www......', '.ww......', '...w.....', '....w....', '.....bb..', '.....bbb.', '......bb.', '.........']],
  gather: ['bw', ['...bb....', '..bbbb...', '..bbbb...', '...bwww..', '.....ww..', '......ww.', '.......w.', '.........', '.........']],
  farm: ['gy', ['....g....', '...ggg...', '..g.g.g..', '....g....', '..y.g.y..', '.yy.g.yy.', '..yyyyy..', '....g....', '.........']],
  cook: ['gor', ['..o.o.o..', '...o.o...', '.........', '.ggggggg.', '.grrrrrg.', '.ggggggg.', '..ggggg..', '.........', '.........']],
  preserve: ['gyw', ['...www...', '..wgggw..', '..gyyyg..', '..gyyyg..', '..gyyyg..', '..ggggg..', '.........', '.........', '.........']],
  craft: ['wb', ['..w...w..', '...w.w...', '....w....', '...bwb...', '..bb.bb..', '.bb...bb.', '.........', '.........', '.........']],
  trade: ['y', ['..yyyyy..', '.yyyyyyy.', '.yy...yy.', '.yyyyyyy.', '..yyyyy..', '.........', '..yyyyy..', '.yyyyyyy.', '..yyyyy..']],
  gift: ['ry', ['...y.y...', '....y....', '.rrryrrr.', '.rrryrrr.', '.yyyyyyy.', '.rrryrrr.', '.rrryrrr.', '.rrryrrr.', '.........']],
  ask: ['w', ['...www...', '..w...w..', '......w..', '.....w...', '....w....', '....w....', '.........', '....w....', '.........']],
  deposit: ['by', ['....y....', '....y....', '..y.y.y..', '...yyy...', '....y....', '.bbbbbbb.', '.b.....b.', '.bbbbbbb.', '.........']],
  withdraw: ['by', ['....y....', '...yyy...', '..y.y.y..', '....y....', '....y....', '.bbbbbbb.', '.b.....b.', '.bbbbbbb.', '.........']],
  plant: ['gb', ['...g.g...', '..ggggg..', '...ggg...', '....g....', '....g....', '...bbb...', '..bbbbb..', '.........', '.........']],
  socialize: ['w', ['.........', '.wwwwwww.', 'w.......w', 'w.w.w.w.w', 'w.......w', '.wwwwwww.', '..w......', '.w.......', '.........']],
  rest: ['w', ['.....wwww', '.......w.', '......w..', '.....wwww', 'www......', '..w......', '.w.......', 'www......', '.........']],
  eat: ['rg', ['....g....', '...g.....', '.rrr.rrr.', 'rrrrrrrrr', 'rrrrrrrrr', 'rrrrrrrrr', '.rrrrrrr.', '..rr.rr..', '.........']],
  explore: ['wy', ['....y....', '...yyy...', '..w.y.w..', '.w..y..w.', 'yyyywyyyy', '.w..y..w.', '..w.y.w..', '...yyy...', '....y....']],
  build: ['wb', ['.wwwww...', '.wwwww...', '...b.....', '...b.....', '...b.....', '...b.....', '...b.....', '.........', '.........']],
  club: ['w', ['..w...w..', '.www.www.', '..w...w..', '.www.www.', 'wwwwwwwww', '.........', '.........', '.........', '.........']],
  festival: ['ry', ['.y.......', '.yrrrr...', '.yrrrrrr.', '.yrrrr...', '.y.......', '.y.......', '.y.......', '.y.......', '.........']],
  promise: ['wr', ['.........', '..wwwww..', '.w.....w.', '.w.rrr.w.', '.w.....w.', '..wwwww..', '....w....', '...w.....', '.........']],
  share: ['w', ['.wwwwwww.', '.w.....w.', '.w.www.w.', '.w.....w.', '.w.www.w.', '.w.....w.', '.wwwwwww.', '.........', '.........']],
  design: ['wy', ['....y....', '...yyy...', '..yyyyy..', '.y.....y.', '.y.www.y.', '.y.w.w.y.', '.yyyyyyy.', '.........', '.........']],
  extend: ['wyb', ['....y....', '...yyy...', '....y....', '..bbbbb..', '.bbbbbbb.', '..w...w..', '..w.b.w..', '..w.b.w..', '..wwwww..']],
  propose: ['wyb', ['.wwwwwww.', '.w.....w.', '.w.yyy.w.', '.w.....w.', '.w.yyy.w.', '.w.....w.', '.wwwwwww.', '....b....', '....b....']],
  vote: ['w', ['...w.w...', '.w.w.w.w.', '.w.w.w.w.', '.wwwwwww.', '.wwwwwww.', '..wwwww..', '..wwwww..', '...www...', '.........']],
  court: ['r', ['.........', '.rr...rr.', 'rrrr.rrrr', 'rrrrrrrrr', '.rrrrrrr.', '..rrrrr..', '...rrr...', '....r....', '.........']],
  play: ['yw', ['...yyy...', '..yywyy..', '.yywwwyy.', '.ywwwwwy.', '.yywwwyy.', '..yywyy..', '...yyy...', '.........', '.........']],
  name_place: ['wy', ['.......yy', '......yy.', '.....yy..', '....yy...', '...yy....', '..ww.....', '.w.......', '.........', '.........']],
};
const iconColors: Record<string, number> = { w: 0xfff4d6, b: 0x9a7a52, y: 0xf3cb62, g: 0x7fc36a, o: 0xd9d9d9, r: 0xe0645a };
export function iconKey(scene: Phaser.Scene, kind: ActionKind) {
  const [, rows] = iconArt[kind];
  return paint(scene, `icon-${kind}`, 9, 9, g => rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') px(g, iconColors[c], x, y); })));
}
