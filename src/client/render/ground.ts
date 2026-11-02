import Phaser from 'phaser';
import { Ground, MAP_H, MAP_W, TILE as T, bridgeSpan, bridgeRows, groundAt, riverX } from '../../shared/map';
import type { Season } from '../../shared/types';
import { palettes } from './palette';

function seeded(seed: number) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const isPath = (k: number) => k === Ground.Road || k === Ground.Plaza;
// Street lamps along main street and the lane to the green; they glow after dusk.
export const lamps = [[8, 30], [22, 30], [36, 30], [44, 30], [58, 30], [37, 23], [37, 28], [32, 33], [47, 33], [66, 33]].map(([x, y]) => ({ x, y }));

// Terrain is painted once per season into a single texture; only water and weather animate.
export function paintGround(scene: Phaser.Scene, season: Season, seed: number, bridgeBuilt: boolean): Phaser.GameObjects.RenderTexture {
  const p = palettes[season], rand = seeded(seed + season.length * 977), g = scene.make.graphics({ x: 0, y: 0 }, false);
  const rect = (x: number, y: number, w: number, h: number, c: number, a = 1) => { g.fillStyle(c, a).fillRect(x, y, w, h); };
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const k: number = groundAt(x, y), X = x * T, Y = y * T, r = rand();
    if (k === Ground.Grass || k === Ground.Meadow) {
      // Smooth, low-frequency patches instead of per-tile noise, so grass reads as a field, not a checkerboard.
      const base = k === Ground.Meadow ? p.meadow : p.grass, n = (Math.sin(x * .31 + seed) + Math.sin(y * .27 + seed * .7) + Math.sin((x + y) * .13) + Math.sin((x - y) * .21)) / 4;
      const d = n + (rand() - .5) * .22, shade = base[(d > .35 ? 3 : d > .05 ? 0 : d > -.3 ? 1 : 2) % base.length]; rect(X, Y, T, T, shade);
      if (r < .5) rect(X + Math.floor(rand() * 13), Y + Math.floor(rand() * 13), 3, 2, base[(Math.floor(r * 8)) % base.length]);
      if (rand() < .45) { rect(X + 3 + Math.floor(rand() * 8), Y + 6 + Math.floor(rand() * 6), 1, 3, p.tuft); rect(X + 4 + Math.floor(rand() * 8), Y + 5 + Math.floor(rand() * 6), 1, 2, p.tuftLight); }
      const flowers = k === Ground.Meadow ? p.meadowFlowers : p.flowers;
      if (flowers.length && rand() < (k === Ground.Meadow ? .5 : .06)) for (let i = 0; i < (k === Ground.Meadow ? 3 : 1); i++) { const c = flowers[Math.floor(rand() * flowers.length)]; rect(X + 2 + Math.floor(rand() * 11), Y + 2 + Math.floor(rand() * 11), 2, 2, c); }
      if (p.snow && rand() < .08) rect(X + Math.floor(rand() * 12), Y + Math.floor(rand() * 12), 3, 1, 0xd3dde2);
    } else if (k === Ground.Road) {
      rect(X, Y, T, T, p.road); for (let i = 0; i < 3; i++) rect(X + Math.floor(rand() * 14), Y + Math.floor(rand() * 14), 2, 1, p.roadSpeck);
      const edge = (nx: number, ny: number) => !isPath(groundAt(nx, ny)) && groundAt(nx, ny) !== Ground.Bridge;
      if (edge(x, y - 1)) { rect(X, Y, T, 2, p.roadEdge); if (!p.snow) rect(X + Math.floor(rand() * 12), Y - 1, 2, 3, p.tuft); }
      if (edge(x, y + 1)) rect(X, Y + T - 2, T, 2, p.roadEdge);
      if (edge(x - 1, y)) rect(X, Y, 2, T, p.roadEdge);
      if (edge(x + 1, y)) rect(X + T - 2, Y, 2, T, p.roadEdge);
    } else if (k === Ground.Plaza) {
      rect(X, Y, T, T, p.mortar);
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const off = j % 2 ? 4 : 0; rect(X + i * 8 + 1 - off / 2, Y + j * 8 + 1, 7, 6, p.plaza[Math.floor(rand() * p.plaza.length)]); }
    } else if (k === Ground.Field) {
      rect(X, Y, T, T, p.soil); rect(X, Y + 3, T, 2, p.furrow); rect(X, Y + 11, T, 2, p.furrow);
    } else if (k === Ground.Quarry) {
      rect(X, Y, T, T, p.quarry); for (let i = 0; i < 4; i++) rect(X + Math.floor(rand() * 14), Y + Math.floor(rand() * 14), 2, 2, p.pebble[i % 2]);
    } else if (k === Ground.Bank || k === Ground.Bridge) {
      rect(X, Y, T, T, p.bank); for (let i = 0; i < 3; i++) rect(X + Math.floor(rand() * 14), Y + Math.floor(rand() * 14), 2, 1, p.bankSpeck);
    } else {
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const n: number = groundAt(x + dx, y + dy); return n !== Ground.Water && n !== Ground.Bridge; });
      rect(X, Y, T, T, edge ? p.water : p.waterDeep);
      if (edge) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n: number = groundAt(x + dx, y + dy); if (n !== Ground.Water && n !== Ground.Bridge) rect(dx > 0 ? X + T - 2 : X, dy > 0 ? Y + T - 2 : Y, dx ? 2 : T, dy ? 2 : T, p.foam, .8); }
    }
  }
  // The river is painted along a smooth centerline at fine resolution; navigation keeps its tile grid.
  for (let py = 0; py < MAP_H * T; py += 2) {
    const cx = (70 + Math.sin(py / T / 10 + .6) * 2.2 + 2) * T;
    rect(cx - 3 * T, py, 6 * T, 2, p.bank); if (rand() < .3) rect(cx - 3 * T + rand() * T, py, 2, 1, p.bankSpeck); if (rand() < .3) rect(cx + 2 * T + rand() * T, py, 2, 1, p.bankSpeck);
    rect(cx - 2 * T - 1, py, 4 * T + 2, 2, p.water); rect(cx - 1.3 * T, py, 2.6 * T, 2, p.waterDeep);
    rect(cx - 2 * T - 1, py, 2, 2, p.foam, .85); rect(cx + 2 * T - 1, py, 2, 2, p.foam, .85);
    if (p.snow) { rect(cx - 2 * T - 1, py, .55 * T, 2, 0xeef6f8); rect(cx + 1.45 * T, py, .55 * T + 1, 2, 0xeef6f8); if (rand() < .08) rect(cx - 1.2 * T + rand() * 2 * T, py, 5, 1, 0xd8ebf1); }
  }
  { const [px0, py0, pw, ph] = [51, 36, 6, 5]; g.fillStyle(p.bank).fillRoundedRect(px0 * T - 5, py0 * T - 5, pw * T + 10, ph * T + 10, 18); g.fillStyle(p.water).fillRoundedRect(px0 * T, py0 * T, pw * T, ph * T, 14); g.fillStyle(p.waterDeep).fillRoundedRect(px0 * T + 12, py0 * T + 10, pw * T - 24, ph * T - 20, 10);
    if (p.snow) g.fillStyle(0xeef6f8, .8).fillRoundedRect(px0 * T + 3, py0 * T + 3, pw * T - 6, ph * T - 6, 12);
    else if (season === 'summer' || season === 'spring') for (const [lx, ly] of [[53, 37], [55, 39], [52, 39]]) { g.fillStyle(0x5f9a4a).fillCircle(lx * T + 4, ly * T + 6, 4); if (season === 'summer') rect(lx * T + 3, ly * T + 3, 2, 2, 0xf6c3d6); } }
  // Scenery that never changes: fences, a well, flower beds, benches and lamp posts.
  for (let x = 12; x <= 27; x += 2) { rect(x * T, 34 * T + 10, 3, 9, 0xe4d2a0); rect(x * T, 34 * T + 12, 2 * T, 2, 0xcbb784); rect(x * T, 45 * T + 2, 3, 9, 0xe4d2a0); rect(x * T, 45 * T + 4, 2 * T, 2, 0xcbb784); }
  const well = { x: 36 * T, y: 15 * T }; g.fillStyle(0x8e8f86).fillEllipse(well.x + 12, well.y + 18, 26, 14); g.fillStyle(0x3d5d6a).fillEllipse(well.x + 12, well.y + 16, 16, 8); rect(well.x + 1, well.y - 8, 3, 22, 0x6b4e33); rect(well.x + 20, well.y - 8, 3, 22, 0x6b4e33); rect(well.x - 2, well.y - 12, 28, 5, 0x9b5a3c); rect(well.x + 9, well.y - 6, 6, 5, 0x8a6a4a);
  for (const [fx, fy] of [[33, 14], [40, 17], [33, 17]]) { rect(fx * T, fy * T + 4, 2 * T, 8, 0x6b4e33); if (!p.snow) for (let i = 0; i < 6; i++) rect(fx * T + 2 + i * 5, fy * T + 2 + (i % 2) * 3, 3, 3, (p.flowers.length ? p.flowers : [0xffffff])[i % Math.max(1, p.flowers.length)]); }
  for (const [bx, by] of [[34, 34], [44, 34], [34, 41], [44, 41]]) { rect(bx * T, by * T + 6, 22, 5, 0x7d5a3c); rect(bx * T + 2, by * T + 11, 3, 4, 0x5e4630); rect(bx * T + 17, by * T + 11, 3, 4, 0x5e4630); }
  for (const l of lamps) { rect(l.x * T + 7, l.y * T - 14, 3, 26, 0x3d3a36); rect(l.x * T + 4, l.y * T - 19, 9, 6, 0x2d2b28); rect(l.x * T + 6, l.y * T - 17, 5, 3, 0xf5dc9a); }
  rect(39 * T + 3, 33 * T - 6, 3, 20, 0x6b4e33); rect(39 * T - 6, 33 * T - 6, 18, 5, 0xc9a66a); rect(39 * T + 6, 33 * T + 1, 16, 5, 0xc9a66a);
  if (!bridgeBuilt) for (const y of bridgeRows) { rect(bridgeSpan.x0 * T - 6, y * T + 3, 8, 10, 0x8a6a45); }
  void riverX;
  const rt = scene.add.renderTexture(0, 0, MAP_W * T, MAP_H * T).setOrigin(0).setDepth(0);
  rt.draw(g); g.destroy(); return rt;
}
