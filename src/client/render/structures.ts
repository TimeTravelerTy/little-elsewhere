import Phaser from 'phaser';
import { TILE as T, bridgeRows, bridgeSpan } from '../../shared/map';
import type { Building, Project, Season, WorldState } from '../../shared/types';
import { materialOf } from '../../shared/construction';

const color = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;
const darker = (c: number, n: number) => Phaser.Display.Color.IntegerToColor(c).darken(n).color;
type G = Phaser.GameObjects.Graphics;
const rect = (g: G, x: number, y: number, w: number, h: number, c: number, a = 1) => { g.fillStyle(c, a).fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

// Where windows sit on a building, in world pixels. The lighting layer uses the same spots.
export function windowSpots(b: Building): { x: number; y: number }[] {
  const x = b.x * T, y = b.y * T, bw = b.w * T, bh = b.h * T, wallTop = y + bh * .45;
  if (b.kind === 'home' || b.kind === 'outpost') return [{ x: x + bw * .22, y: wallTop + 12 }, { x: x + bw * .78, y: wallTop + 12 }];
  if (b.kind === 'workshop') return [{ x: x + bw * .25, y: wallTop + 14 }, { x: (b.door.x + .5) * T, y: y + bh - 12 }];
  if (b.kind === 'store') return [{ x: (b.door.x + .5) * T, y: wallTop + 6 }];
  return [];
}
export function chimneySpot(b: Building) { return { x: b.x * T + b.w * T - 22, y: b.y * T - 22 }; }

function roof(g: G, x: number, top: number, bw: number, eave: number, base: number, snow: boolean) {
  const rows = Math.ceil((eave - top) / 5);
  for (let i = 0; i < rows; i++) { const inset = Math.max(0, (rows - 1 - i) * 3 - 4), yy = top + i * 5; rect(g, x - 6 + inset, yy, bw + 12 - inset * 2, 5, i % 2 ? base : darker(base, 6)); rect(g, x - 6 + inset, yy + 4, bw + 12 - inset * 2, 1, darker(base, 16)); }
  rect(g, x - 7, eave, bw + 14, 3, darker(base, 24));
  if (snow) { rect(g, x - 4, top, bw + 8, 7, 0xf6f9fa); rect(g, x - 6, top + 6, bw + 12, 2, 0xe3ecef); for (let i = 0; i < bw; i += 9) rect(g, x - 4 + i, eave + 3, 2, 3 + (i % 3), 0xdfeef4); }
}
function house(g: G, b: Building, season: Season) {
  const x = b.x * T, y = b.y * T, bw = b.w * T, bh = b.h * T, wallTop = y + bh * .45, snow = season === 'winter', roofColor = color(b.roof), doorX = (b.door.x + .5) * T;
  rect(g, x + 4, y + bh - 2, bw, 5, 0x2f4430, .25);
  rect(g, x, wallTop, bw, bh - (wallTop - y), b.kind === 'outpost' ? 0xb9b1a0 : 0xecdcb8);
  if (b.kind === 'outpost') for (let yy = wallTop + 4; yy < y + bh - 6; yy += 6) for (let xx = x + ((yy / 6) % 2) * 5; xx < x + bw - 4; xx += 10) rect(g, xx, yy, 9, 5, 0xa39a88);
  else { const wallH = y + bh - wallTop; rect(g, x, wallTop, 4, wallH, 0x7a5a3e); rect(g, x + bw - 4, wallTop, 4, wallH, 0x7a5a3e); rect(g, x, wallTop + 22, bw, 3, 0x7a5a3e); }
  rect(g, x - 1, y + bh - 6, bw + 2, 6, 0x9a9488); for (let i = 4; i < bw; i += 9) rect(g, x + i, y + bh - 6, 1, 6, 0x7f7a70);
  for (const w of windowSpots(b)) { rect(g, w.x - 8, w.y - 7, 16, 14, 0x6b4e33); rect(g, w.x - 6, w.y - 5, 12, 10, 0x9fc3cb); rect(g, w.x - 1, w.y - 5, 2, 10, 0x6b4e33); rect(g, w.x - 6, w.y - 1, 12, 1, 0x6b4e33); rect(g, w.x - 11, w.y - 6, 3, 12, roofColor); rect(g, w.x + 8, w.y - 6, 3, 12, roofColor);
    if (season === 'spring' || season === 'summer') { rect(g, w.x - 8, w.y + 7, 16, 4, 0x7a5234); for (let i = 0; i < 5; i++) rect(g, w.x - 7 + i * 3, w.y + 5, 2, 2, [0xe86a7a, 0xf2d25e, 0xf6f0e0][i % 3]); } }
  rect(g, doorX - 8, y + bh - 26, 16, 24, 0x5a3e28); rect(g, doorX - 6, y + bh - 24, 12, 22, 0x8a5c38); rect(g, doorX - 1, y + bh - 24, 1, 22, 0x6e4a2e); rect(g, doorX + 3, y + bh - 13, 2, 2, 0xe0bd70); rect(g, doorX - 9, y + bh - 2, 18, 3, 0xb3a58a);
  rect(g, x + bw - 26, y - 20, 11, 26, 0x8f8a80); rect(g, x + bw - 28, y - 23, 15, 4, 0xa8a398); if (snow) rect(g, x + bw - 28, y - 25, 15, 3, 0xffffff);
  roof(g, x, y - 12, bw, wallTop, roofColor, snow);
  if (snow) rect(g, x - 2, y + bh - 3, bw + 4, 3, 0xf3f7f8);
}
function store(g: G, b: Building, season: Season) {
  const x = b.x * T, y = b.y * T, bw = b.w * T, bh = b.h * T, wallTop = y + bh * .38, doorX = (b.door.x + .5) * T;
  rect(g, x + 4, y + bh - 2, bw, 5, 0x2f4430, .25);
  rect(g, x, wallTop, bw, bh - (wallTop - y), 0x9c5a3c); for (let i = 0; i < bw; i += 6) rect(g, x + i, wallTop, 1, y + bh - wallTop, 0x7f4630);
  rect(g, x, wallTop, bw, 3, 0xe8dcc0); rect(g, x, y + bh - 4, bw, 4, 0x7f4630);
  rect(g, doorX - 16, y + bh - 34, 32, 34, 0xe8dcc0); rect(g, doorX - 14, y + bh - 32, 28, 32, 0x7a4430); g.lineStyle(3, 0xe8dcc0).lineBetween(doorX - 14, y + bh - 32, doorX + 14, y + bh).lineBetween(doorX + 14, y + bh - 32, doorX - 14, y + bh);
  rect(g, doorX - 6, wallTop + 2, 12, 9, 0xe8dcc0); rect(g, doorX - 4, wallTop + 4, 8, 5, 0x5a3a28);
  roof(g, x, y - 8, bw, wallTop, 0x5d6168, season === 'winter');
}
function market(g: G, b: Building, season: Season) {
  const x = b.x * T, y = b.y * T, bw = b.w * T, bh = b.h * T, stripes = [[0xc9453f, 0xf3e9d2], [0x4f8a5a, 0xf3e9d2], [0x3f6a9a, 0xf3e9d2]];
  rect(g, x + 2, y + bh - 2, bw, 5, 0x2f4430, .22);
  for (let s = 0; s < 3; s++) {
    const sx = x + 2 + s * (bw / 3), sw = bw / 3 - 4, top = y + 18 + (s % 2) * 6;
    rect(g, sx + 2, top, 3, bh - (top - y), 0x6b4e33); rect(g, sx + sw - 5, top, 3, bh - (top - y), 0x6b4e33);
    for (let i = 0; i < sw; i += 6) rect(g, sx + i, top - 12, 6, 12, stripes[s][(i / 6) % 2]); for (let i = 0; i < sw; i += 6) rect(g, sx + i + 1, top, 4, 3, stripes[s][(i / 6) % 2]);
    if (season === 'winter') rect(g, sx, top - 14, sw, 3, 0xffffff);
    rect(g, sx + 1, y + bh - 20, sw - 2, 12, 0x9a7048); rect(g, sx + 1, y + bh - 20, sw - 2, 2, 0xb88a5a);
    const goods = [[0xd9543f, 0xe0b040], [0x8a6a45, 0x9a9488], [0x7fb957, 0xf0e2b0]][s];
    for (let i = 0; i < 5; i++) rect(g, sx + 4 + i * (sw - 8) / 5, y + bh - 24, 4, 4, goods[i % 2]);
  }
  rect(g, x + bw - 14, y + bh - 30, 12, 16, 0x3a3f3a); rect(g, x + bw - 13, y + bh - 29, 10, 14, 0x2b3a33); for (let i = 0; i < 3; i++) rect(g, x + bw - 11, y + bh - 26 + i * 4, 6, 1, 0xe0e0d0);
}
function workshop(g: G, b: Building, season: Season) {
  const x = b.x * T, y = b.y * T, bw = b.w * T, bh = b.h * T, wallTop = y + bh * .45, doorX = (b.door.x + .5) * T;
  rect(g, x + 4, y + bh - 2, bw, 5, 0x2f4430, .25);
  rect(g, x, wallTop, bw, bh - (wallTop - y), 0xa29b8c); for (let yy = wallTop + 3; yy < y + bh; yy += 7) for (let xx = x + ((yy / 7) % 2) * 6; xx < x + bw; xx += 12) rect(g, xx, yy, 11, 6, 0x928b7d);
  rect(g, x, wallTop, bw, 10, 0x7a5a3e);
  for (const w of windowSpots(b).slice(0, 1)) { rect(g, w.x - 8, w.y - 7, 16, 14, 0x5a4330); rect(g, w.x - 6, w.y - 5, 12, 10, 0x9fc3cb); }
  rect(g, doorX - 12, y + bh - 28, 24, 28, 0x3b2e24); rect(g, doorX - 10, y + bh - 26, 20, 26, 0x5d4632);
  roof(g, x, y - 10, bw, wallTop, 0x6d7a8a, season === 'winter');
  rect(g, x + bw - 26, y - 20, 11, 26, 0x8f8a80); rect(g, x + bw - 28, y - 23, 15, 4, 0xa8a398);
  rect(g, x + bw + 2, y + bh - 12, 14, 5, 0x4a4a4e); rect(g, x + bw + 6, y + bh - 7, 6, 7, 0x3a3a3e);
  rect(g, x - 18, y + bh - 10, 16, 3, 0x8a6a45); rect(g, x - 16, y + bh - 7, 2, 7, 0x6b4e33); rect(g, x - 6, y + bh - 7, 2, 7, 0x6b4e33); rect(g, x - 17, y + bh - 14, 14, 4, 0x9a7a52);
}
// Ground-level parts first, then walls, then furnishings, and roofs over everything.
const layer: Record<string, number> = { floor: 0, planter: 0, wall: 1, shelf: 2, hearth: 2, bed: 2, seat: 2, bench: 2, smoker: 2, kiln: 2, roof: 3 };
function place(g: G, b: Building, season: Season) {
  const garden = !(b.blocks || []).some(x => x.kind === 'floor');
  rect(g, b.x * T - 2, b.y * T - 2, b.w * T + 4, b.h * T + 4, garden ? 0x5a4a30 : 0x6f5a3e, garden ? .35 : .5);
  for (const block of [...(b.blocks || [])].sort((p, q) => layer[p.kind] - layer[q.kind])) {
    const x = (b.x + block.x) * T, y = (b.y + block.y) * T;
    if (!block.placedBy) { g.lineStyle(1, 0xf3e3b0, .45).strokeRect(x + 1, y + 1, T - 2, T - 2); continue; }
    if (block.kind === 'floor') { rect(g, x, y, T, T, 0xb58e5c); rect(g, x, y + 5, T, 1, 0x93703f); rect(g, x, y + 11, T, 1, 0x93703f); rect(g, x + (block.x % 2) * 8, y, 1, 5, 0x93703f); }
    // Walls and roofs show what they are made of, and how worn they are.
    const material = materialOf(block), wear = block.wear || 0;
    if (block.kind === 'wall') {
      if (material === 'daub') { rect(g, x, y - 8, T, T + 6, 0xe0cfa4); rect(g, x, y - 8, 2, T + 6, 0x6b4e33); rect(g, x + T - 2, y - 8, 2, T + 6, 0x6b4e33); rect(g, x, y - 1, T, 2, 0x6b4e33); }
      else if (material === 'brick') { rect(g, x, y - 8, T, T + 6, 0xd2b39a); for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) rect(g, x + j * 8 + (i % 2) * 4 - (i % 2 && j ? 8 : 0), y - 7 + i * 4, 7, 3, 0xa9573a); }
      else { rect(g, x, y - 8, T, T + 6, 0x8b8577); for (let i = 0; i < 3; i++) rect(g, x + (i % 2) * 4, y - 6 + i * 6, 11, 5, 0xa39c8c); }
      if (wear >= 1) { rect(g, x + 5, y - 6, 2, 9, 0x3d3a33); rect(g, x + 7, y - 2, 3, 2, 0x3d3a33); } else if (wear >= .6) rect(g, x + 3, y - 4, 4, 3, 0x000000, .18);
    }
    if (block.kind === 'roof') {
      if (material === 'thatch') { rect(g, x - 1, y - 15, T + 2, 13, 0xc9a24e); for (let i = 0; i < 5; i++) rect(g, x + i * 3, y - 13, 1, 10, 0xa8843a); rect(g, x - 1, y - 15, T + 2, 3, 0xdcbb68); }
      else if (material === 'brick') { rect(g, x - 1, y - 14, T + 2, 12, 0xb4583a); for (let i = 0; i < 3; i++) rect(g, x - 1, y - 11 + i * 4, T + 2, 1, 0x8e4028); rect(g, x - 1, y - 14, T + 2, 2, 0xcf7a52); }
      else { rect(g, x - 1, y - 14, T + 2, 12, 0x9e6650); rect(g, x - 1, y - 14, T + 2, 3, 0xc08964); }
      if (wear >= 1) rect(g, x + 4, y - 10, 6, 5, 0x2f2a25); else if (wear >= .6) rect(g, x + 2, y - 9, 5, 3, 0x000000, .2);
      if (season === 'winter' && wear < 1) rect(g, x - 1, y - 16, T + 2, 4, 0xffffff);
    }
    if (block.kind === 'kiln') { g.fillStyle(0x8e5234).fillEllipse(x + 8, y + 9, 15, 13); g.fillStyle(0xa8643c).fillEllipse(x + 8, y + 8, 12, 10); rect(g, x + 5, y + 9, 6, 5, 0x2f2622); rect(g, x + 6, y + 11, 4, 2, 0xf0a040, .9); rect(g, x + 7, y, 2, 3, 0x6e4a32); }
    if (block.kind === 'seat') { rect(g, x + 2, y + 5, 12, 5, 0x6b4e33); rect(g, x + 3, y + 10, 2, 4, 0x4b3826); rect(g, x + 11, y + 10, 2, 4, 0x4b3826); rect(g, x + 2, y + 5, 12, 1, 0x8a6a45); }
    if (block.kind === 'hearth') { g.fillStyle(0x6f7269).fillCircle(x + 8, y + 9, 8); g.fillStyle(0x3d3a33).fillCircle(x + 8, y + 9, 5); rect(g, x + 6, y + 5, 4, 7, 0xf0a040); rect(g, x + 7, y + 3, 2, 4, 0xfbe07a); }
    if (block.kind === 'bed') { rect(g, x + 1, y + 1, 14, 14, 0x6b4e33); rect(g, x + 2, y + 2, 12, 4, 0xf3ecd8); rect(g, x + 2, y + 6, 12, 8, block.x % 2 ? 0x7e9ec2 : 0xc27e7e); rect(g, x + 2, y + 9, 12, 1, 0x000000, .15); }
    if (block.kind === 'shelf') for (const dy of [-4, 3]) { rect(g, x + 1, y + dy, 14, 2, 0x6b4e33); for (let i = 0; i < 4; i++) rect(g, x + 2 + i * 3, y + dy - 3, 2, 3, [0xd9a040, 0xe0645a, 0x8fbf5a, 0xf3e9d2][(i + dy) & 3]); }
    if (block.kind === 'planter') { rect(g, x + 1, y + 2, 14, 12, 0x8a6039); rect(g, x + 2, y + 3, 12, 10, 0x5a3e28); const sprout = season === 'winter' ? 0xf3f7f8 : season === 'autumn' ? 0xd9a040 : 0x7fc36a; for (let i = 0; i < 3; i++) { rect(g, x + 3 + i * 4, y + 5, 2, season === 'winter' ? 1 : 4, sprout); if (season === 'summer') rect(g, x + 3 + i * 4, y + 4, 2, 2, 0xe0645a); } }
    if (block.kind === 'smoker') { rect(g, x + 2, y + 1, 12, 14, 0x8a8078); rect(g, x + 3, y + 2, 10, 10, 0x4a3f38); for (let i = 0; i < 3; i++) rect(g, x + 4 + i * 3, y + 3, 2, 6, 0xb0603a); rect(g, x + 3, y + 12, 10, 2, 0xf0a040, .8); }
    if (block.kind === 'bench') { rect(g, x + 1, y + 5, 14, 4, 0x9a7048); rect(g, x + 1, y + 5, 14, 1, 0xc49a68); rect(g, x + 2, y + 9, 2, 6, 0x6b4e33); rect(g, x + 12, y + 9, 2, 6, 0x6b4e33); rect(g, x + 4, y + 2, 5, 3, 0x9a9c94); rect(g, x + 10, y + 3, 1, 2, 0x6b4e33); }
  }
}
export function drawBuilding(g: G, b: Building, season: Season) {
  g.clear();
  if (b.kind === 'home' || b.kind === 'outpost') house(g, b, season);
  else if (b.kind === 'store') store(g, b, season);
  else if (b.kind === 'market') market(g, b, season);
  else if (b.kind === 'workshop') workshop(g, b, season);
  else if (b.kind === 'place') place(g, b, season);
}
// The board beneath the oak: one paper per rule, a sealed notice for each open proposal.
export function drawNoticeBoard(g: G, hall: Building, rules: number, open: number, season: Season) {
  g.clear(); const x = (hall.x - 1) * T + 2, y = (hall.y + hall.h) * T - 4;
  rect(g, x + 3, y - 2, 3, 20, 0x5e4630); rect(g, x + 27, y - 2, 3, 20, 0x5e4630); rect(g, x, y - 22, 33, 22, 0x6b4e33); rect(g, x + 2, y - 20, 29, 18, 0x9a7a52); rect(g, x - 1, y - 24, 35, 3, 0x5e4630);
  if (season === 'winter') rect(g, x - 1, y - 26, 35, 2, 0xffffff);
  for (let i = 0; i < Math.min(6, rules); i++) { const px = x + 4 + (i % 3) * 9, py = y - 18 + Math.floor(i / 3) * 8; rect(g, px, py, 7, 7, 0xf3ecd8); rect(g, px + 1, py + 2, 5, 1, 0x9a9488); rect(g, px + 1, py + 4, 4, 1, 0x9a9488); rect(g, px + 3, py, 1, 1, 0xb0603a); }
  for (let i = 0; i < Math.min(2, open); i++) { const px = x + 22 - i * 6, py = y - 12 + i * 2; rect(g, px, py, 8, 9, 0xfff4d6); rect(g, px + 1, py + 2, 6, 1, 0x7a6a5a); rect(g, px + 1, py + 4, 6, 1, 0x7a6a5a); rect(g, px + 3, py + 6, 3, 3, 0xc9453f); }
}
// Unfinished homes show their foundation, rising walls, scaffolding and delivered materials.
export function drawSite(g: G, p: Project, season: Season) {
  g.clear(); const b = p.building; if (!b) return;
  if (b.kind === 'place') { place(g, b, season); return; }
  const x = b.x * T, y = b.y * T, bw = b.w * T, bh = b.h * T, work = p.labor / Math.max(1, p.requiredLabor);
  rect(g, x - 2, y + bh * .4, bw + 4, bh * .6 + 2, 0x9a9488); rect(g, x + 2, y + bh * .4 + 3, bw - 4, bh * .6 - 6, 0x8a6f4f);
  const wallH = (bh * .55) * work; if (wallH > 1) { rect(g, x, y + bh - wallH, 6, wallH, 0xe6d6b2); rect(g, x + bw - 6, y + bh - wallH, 6, wallH, 0xe6d6b2); rect(g, x, y + bh - Math.min(wallH, 10), bw, Math.min(wallH, 10), 0xe6d6b2); }
  g.lineStyle(2, 0x8a6a45); for (const px of [x - 4, x + bw + 3]) g.lineBetween(px, y + bh, px, y + bh * .2); g.lineBetween(x - 4, y + bh * .35, x + bw + 3, y + bh * .35);
  const logs = Math.min(6, Math.ceil(p.supplied.wood / Math.max(1, p.requires.wood) * 6)), stones = Math.min(6, Math.ceil(p.supplied.stone / Math.max(1, p.requires.stone) * 6));
  for (let i = 0; i < logs; i++) { rect(g, x + bw + 8 + (i % 3) * 3, y + bh - 5 - Math.floor(i / 3) * 5, 14, 4, 0x8a6039); rect(g, x + bw + 8 + (i % 3) * 3, y + bh - 5 - Math.floor(i / 3) * 5, 3, 4, 0xc8a070); }
  for (let i = 0; i < stones; i++) rect(g, x - 20 + (i % 3) * 6, y + bh - 5 - Math.floor(i / 3) * 5, 5, 4, i % 2 ? 0x9a9c94 : 0xb4b6ac);
}
export function drawBridge(g: G, w: WorldState, season: Season) {
  g.clear(); const p = w.projects.find(p => p.id === 'bridge'); if (!p) return;
  const x0 = bridgeSpan.x0 * T, x1 = (bridgeSpan.x1 + 1) * T, y0 = bridgeRows[0] * T, y1 = (bridgeRows.at(-1)! + 1) * T;
  if (p.complete) {
    rect(g, x0, y0 - 2, x1 - x0, y1 - y0 + 4, 0x6b4e33); for (let x = x0; x < x1; x += 5) { rect(g, x, y0, 4, y1 - y0, 0xa88a59); rect(g, x, y0, 4, 2, 0xc9a870); }
    for (const yy of [y0 - 6, y1 + 1]) { rect(g, x0, yy, x1 - x0, 3, 0x7a5a3a); for (let x = x0; x <= x1; x += 16) rect(g, x, yy - 3, 3, 8, 0x5e4630); }
    if (season === 'winter') rect(g, x0, y0 - 8, x1 - x0, 2, 0xffffff);
    return;
  }
  const done = Math.floor(p.labor / p.requiredLabor * 8);
  for (let i = 0; i < 8; i++) { const x = x0 + 6 + i * ((x1 - x0 - 12) / 7); rect(g, x, y0 + 4, 4, y1 - y0 - 4, i < done ? 0x6b4e33 : 0x6b4e33, i < done ? 1 : .25); if (i < done) rect(g, x - 4, y0 + 2, 14, 4, 0xa88a59); }
  const logs = Math.min(8, Math.ceil(p.supplied.wood / p.requires.wood * 8)), stones = Math.min(8, Math.ceil(p.supplied.stone / p.requires.stone * 8));
  for (let i = 0; i < logs; i++) { rect(g, x0 - 40 + (i % 4) * 3, y0 - 22 - Math.floor(i / 4) * 5, 16, 4, 0x8a6039); rect(g, x0 - 40 + (i % 4) * 3, y0 - 22 - Math.floor(i / 4) * 5, 3, 4, 0xc8a070); }
  for (let i = 0; i < stones; i++) rect(g, x0 - 36 + (i % 4) * 6, y1 + 8 - Math.floor(i / 4) * 5, 5, 4, i % 2 ? 0x9a9c94 : 0xb4b6ac);
}
// Stockpiles make wealth and hoarding visible: a household's wood, stone and food sit by its door.
export function drawStockpile(g: G, b: Building, totals: { food: number; preserves: number; wood: number; stone: number }, season: Season) {
  g.clear(); const x = (b.x + b.w) * T + 2, y = (b.y + b.h) * T - 2;
  const logs = Math.min(9, Math.ceil(totals.wood / 4)), crates = Math.min(6, Math.ceil(totals.food / 8)), jars = Math.min(6, Math.ceil(totals.preserves / 5)), stones = Math.min(6, Math.ceil(totals.stone / 6));
  for (let i = 0; i < logs; i++) { const row = Math.floor(i / 3); rect(g, x + (row % 2) * 2, y - 4 - row * 4, 14, 4, 0x8a6039); rect(g, x + 11 + (row % 2) * 2, y - 4 - row * 4, 3, 4, 0xc8a070); }
  for (let i = 0; i < crates; i++) { const cx = x - b.w * T - 16 + (i % 2) * 9, cy = y - 8 - Math.floor(i / 2) * 8; rect(g, cx, cy, 8, 8, 0xa87c4a); rect(g, cx + 1, cy + 1, 6, 1, 0xc99a5c); rect(g, cx + 2, cy + 3, 4, 3, i % 2 ? 0xd9543f : 0x8fbf5a); }
  for (let i = 0; i < jars; i++) { const jx = x - b.w * T - 28 + (i % 3) * 4, jy = y - 6 - Math.floor(i / 3) * 6; rect(g, jx, jy, 3, 5, 0xd9a040); rect(g, jx, jy, 3, 1, 0xf3e9d2); }
  for (let i = 0; i < stones; i++) rect(g, x + 16 + (i % 2) * 6, y - 5 - Math.floor(i / 2) * 5, 5, 4, i % 2 ? 0x9a9c94 : 0xb4b6ac);
  if (season === 'winter' && (logs || crates)) rect(g, x, y - 5 - Math.max(1, Math.ceil(logs / 3)) * 4, 16, 2, 0xffffff);
}
