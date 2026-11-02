import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { worldPlaces } from '../shared/places';
import { residentOffsets } from './residentLayout';
import { MAP_H, MAP_W, TILE as T, fields } from '../shared/map';
import type { Resident, Season, WorldState } from '../shared/types';
import { actionLabels, hourOf, seasonOf, yearsOld } from '../shared/types';
import { bushKey, clayKey, glowKey, hallOakKey, iconKey, reedKey, residentKeys, rockKey, treeKey } from './render/textures';
import { lamps, paintGround } from './render/ground';
import { chimneySpot, drawBridge, drawBuilding, drawNoticeBoard, drawSite, drawStockpile, windowSpots } from './render/structures';
import { palettes } from './render/palette';

const W = MAP_W * T, H = MAP_H * T, FONT = "'Pixelify Sans', monospace";
type Controls = { place: (id: string) => void; zoom: (n: number) => void; home: () => void; follow: (id: string | null) => void };
type Person = { body: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Image; overlay: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text; bubble: Phaser.GameObjects.Container; bubbleText: Phaser.GameObjects.Text; bubbleBox: Phaser.GameObjects.Graphics; badge: Phaser.GameObjects.Container; badgeIcon: Phaser.GameObjects.Image; progress: Phaser.GameObjects.Graphics; keys: Record<string, string>; season: Season; look: string; spoken: string; speechAt: number; lastX: number; lastY: number; facing: 'f' | 'b' };
type Light = { img: Phaser.GameObjects.Image; base: number; flicker: number; when: (w: WorldState, h: number) => number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; kind: 'rain' | 'snow' | 'leaf' | 'petal' | 'smoke' | 'firefly' | 'butterfly'; color: number; size: number };
// Multiply tint by hour: deep blue night, rosy dawn, clear day, amber dusk.
const tintKeys: [number, number, number][] = [[0, 0x28366e, .62], [4.5, 0x28366e, .62], [6, 0xf0a08a, .34], [7.5, 0xffffff, 0], [17, 0xffffff, 0], [18.8, 0xf59a5c, .3], [20.3, 0x6a4c92, .46], [21.7, 0x28366e, .62], [24, 0x28366e, .62]];
function tintAt(h: number): [number, number] {
  for (let i = 1; i < tintKeys.length; i++) if (h <= tintKeys[i][0]) {
    const [h0, c0, a0] = tintKeys[i - 1], [h1, c1, a1] = tintKeys[i], t = (h - h0) / (h1 - h0 || 1);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.IntegerToColor(c0), Phaser.Display.Color.IntegerToColor(c1), 100, t * 100);
    return [Phaser.Display.Color.GetColor(c.r, c.g, c.b), a0 + (a1 - a0) * t];
  }
  return [0x28366e, .62];
}

export function WorldCanvas({ world, selected, onSelect, onPlace, controls }: { world: WorldState; selected: string | null; onSelect: (id: string) => void; onPlace: (id: string) => void; controls: React.MutableRefObject<Controls | null> }) {
  const element = useRef<HTMLDivElement>(null); const state = useRef(world); state.current = world; const selection = useRef(selected); selection.current = selected; const callback = useRef(onSelect); callback.current = onSelect;
  const placeCallback = useRef(onPlace); placeCallback.current = onPlace;
  useEffect(() => {
    if (!element.current) return;
    class Village extends Phaser.Scene {
      people = new Map<string, Person>(); nodes = new Map<string, { img: Phaser.GameObjects.Image; key: string }>();
      buildings = new Map<string, Phaser.GameObjects.Graphics>(); sites = new Map<string, Phaser.GameObjects.Graphics>(); stockpiles = new Map<string, Phaser.GameObjects.Graphics>();
      ground?: Phaser.GameObjects.RenderTexture; wearG!: Phaser.GameObjects.Graphics; cropG!: Phaser.GameObjects.Graphics; waterG!: Phaser.GameObjects.Graphics; shadowG!: Phaser.GameObjects.Graphics; bridgeG!: Phaser.GameObjects.Graphics; boardG!: Phaser.GameObjects.Graphics;
      mist: Phaser.GameObjects.Image[] = []; cloudG!: Phaser.GameObjects.Graphics; fxG!: Phaser.GameObjects.Graphics; glowFx!: Phaser.GameObjects.Graphics; night!: Phaser.GameObjects.Rectangle; hallOak?: Phaser.GameObjects.Image; ring!: Phaser.GameObjects.Graphics;
      glows: Light[] = []; particles: Particle[] = []; placeLabels: Phaser.GameObjects.Text[] = []; placeZones: Phaser.GameObjects.Zone[] = [];
      season: Season | null = null; groundKey = ''; structureKey = ''; stockKey = ''; cropKey = ''; wearKey = ''; nodeKey = ''; lastSlow = 0; lastWear = 0; lastSmoke = 0;
      hovered: string | null = null; followed: string | null = null; dragging = false; lastPointer = { x: 0, y: 0 }; moved = false;
      constructor() { super('village'); }
      create() {
        this.cameras.main.setBackgroundColor('#5f7f4a').setBounds(-T * 12, -T * 10, W + T * 24, H + T * 20); glowKey(this);
        this.wearG = this.add.graphics().setDepth(1); this.cropG = this.add.graphics().setDepth(2); this.waterG = this.add.graphics().setDepth(3); this.shadowG = this.add.graphics().setDepth(4); this.bridgeG = this.add.graphics().setDepth(5); this.boardG = this.add.graphics();
        this.ring = this.add.graphics().setDepth(6);
        this.cloudG = this.add.graphics().setDepth(1800);
        this.night = this.add.rectangle(W / 2, H / 2, W + T * 40, H + T * 40, 0x28366e, 0).setDepth(2000).setBlendMode(Phaser.BlendModes.MULTIPLY);
        this.glowFx = this.add.graphics().setDepth(2150).setBlendMode(Phaser.BlendModes.ADD); this.fxG = this.add.graphics().setDepth(2200);
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.dragging = true; this.moved = false; this.placeLabels.forEach(label => label.setVisible(false)); this.lastPointer = { x: p.x, y: p.y }; });
        this.input.on('pointerup', () => { this.dragging = false; });
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (!this.dragging) return; const dx = p.x - this.lastPointer.x, dy = p.y - this.lastPointer.y; if (Math.abs(dx) + Math.abs(dy) > 2) { this.moved = true; this.followed = null; this.cameras.main.scrollX -= dx / this.cameras.main.zoom; this.cameras.main.scrollY -= dy / this.cameras.main.zoom; } this.lastPointer = { x: p.x, y: p.y }; });
        this.input.on('wheel', (_p: unknown, _o: unknown, _x: number, dy: number) => this.zoom(dy > 0 ? -.12 : .12));
        this.scale.on('resize', () => { this.cameras.main.setSize(this.scale.width, this.scale.height); if (!this.followed) this.home(); });
        controls.current = { place: id => { const p = worldPlaces(state.current).find(p => p.id === id); if (p) { this.followed = null; this.cameras.main.setZoom(Math.max(1.4, this.cameras.main.zoom)).centerOn(p.position.x * T, p.position.y * T); } }, zoom: n => this.zoom(n), home: () => this.home(), follow: id => { this.followed = id; if (id) this.cameras.main.setZoom(Math.max(1.8, this.cameras.main.zoom)); } };
        this.home();
      }
      home() { this.followed = null; const z = Math.min(this.scale.width / (66 * T), this.scale.height / (46 * T)); this.cameras.main.setZoom(Phaser.Math.Clamp(z, .5, 2.2)).centerOn(38 * T, 29 * T); }
      zoom(n: number) { this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom + n, .4, 3.5)); }
      // Slow-changing layers are rebuilt only when the state they depict changes.
      sync(w: WorldState, time: number) {
        const season = seasonOf(w.minute), bridge = !!w.projects.find(p => p.id === 'bridge')?.complete, gk = `${season}:${bridge}`;
        if (gk !== this.groundKey) { this.groundKey = gk; this.season = season; this.ground?.destroy(); this.ground = paintGround(this, season, w.seed, bridge); this.structureKey = ''; this.nodeKey = ''; this.stockKey = ''; this.cropKey = ''; }
        const sk = JSON.stringify([w.buildings.map(b => [b.id, b.name, b.blocks?.length, b.blocks?.filter(x => x.placedBy).length, b.blocks?.map(x => `${x.material?.[0] || ''}${Math.min(2, Math.floor((x.wear || 0) / .6))}`).join('')]), w.projects.map(p => [p.id, p.labor, p.supplied.wood, p.supplied.stone, p.complete]), (w.norms ?? []).length, (w.proposals ?? []).filter(p => p.status === 'open').length]);
        if (sk !== this.structureKey) { this.structureKey = sk; this.drawStructures(w, season); }
        if (time - this.lastSlow < 700) return; this.lastSlow = time;
        const nk = `${w.nodeVersion}:${w.nodes.length}:${w.nodes.reduce((s, n) => s + (n.kind === 'bush' || n.kind === 'rock' ? Math.min(4, Math.ceil(n.amount / 4)) : n.kind === 'clay' || n.kind === 'reeds' ? Math.ceil(n.amount / 2) * 7 : 0), 0)}`;
        if (nk !== this.nodeKey) { this.nodeKey = nk; this.drawNodes(w, season); }
        const stock = JSON.stringify([w.stocks, w.buildings.filter(b => b.kind === 'home' || b.kind === 'outpost').map(b => w.residents.filter(r => r.home === b.id).reduce((s, r) => s + Math.ceil(r.inventory.wood / 4) * 1000 + Math.ceil(r.inventory.food / 8) * 10 + Math.ceil(r.inventory.preserves / 5) + Math.ceil(r.inventory.stone / 6) * 100000, 0))]);
        if (stock !== this.stockKey) { this.stockKey = stock; this.drawStockpiles(w, season); }
        const ck = `${season}:${Math.round(w.farm.harvested / 3)}`; if (ck !== this.cropKey) { this.cropKey = ck; this.drawCrops(w, season); }
        if (time - this.lastWear > 4000) { this.lastWear = time; const wk = w.wear.reduce((s, v, i) => v > 12 ? s + v * (i % 7 + 1) : s, 0) + season; if (String(wk) !== this.wearKey) { this.wearKey = String(wk); this.drawWear(w, season); } }
      }
      drawStructures(w: WorldState, season: Season) {
        const seen = new Set<string>();
        for (const b of w.buildings) {
          if (b.kind === 'farm' || b.kind === 'hall') continue; seen.add(b.id);
          let g = this.buildings.get(b.id); if (!g) { g = this.add.graphics(); this.buildings.set(b.id, g); }
          // Additions under way show as outlines on the place they will belong to.
          const extra = w.projects.filter(p => p.extension?.building === b.id && !p.complete).flatMap(p => p.extension!.blocks);
          g.setDepth(10 + (b.y + b.h) * T); drawBuilding(g, extra.length ? { ...b, blocks: [...(b.blocks || []), ...extra] } : b, season);
        }
        for (const p of w.projects.filter(p => !p.complete && p.building)) { seen.add(`site:${p.id}`); let g = this.sites.get(p.id); if (!g) { g = this.add.graphics(); this.sites.set(p.id, g); } g.setDepth(10 + (p.building!.y + p.building!.h) * T); drawSite(g, p, season); }
        for (const [id, g] of this.sites) if (!seen.has(`site:${id}`)) { g.destroy(); this.sites.delete(id); }
        drawBridge(this.bridgeG, w, season);
        const hall = w.buildings.find(b => b.kind === 'hall');
        if (hall) { this.boardG.setDepth(10 + (hall.y + hall.h) * T); drawNoticeBoard(this.boardG, hall, (w.norms ?? []).length, (w.proposals ?? []).filter(p => p.status === 'open').length, season); }
        if (hall) { const key = hallOakKey(this, season); if (!this.hallOak) this.hallOak = this.add.image((hall.x + hall.w / 2) * T, (hall.y + hall.h - 1) * T, key).setOrigin(.5, 1); this.hallOak.setTexture(key).setDepth(10 + (hall.y + hall.h - 1) * T); }
        this.buildLights(w); this.buildPlaces(w);
      }
      drawNodes(w: WorldState, season: Season) {
        this.shadowG.clear();
        for (const n of w.nodes) {
          if (n.kind === 'fish') continue;
          const key = n.kind === 'rock' ? rockKey(this, n, season) : n.kind === 'bush' ? bushKey(this, n, season) : n.kind === 'clay' ? clayKey(this, n, season) : n.kind === 'reeds' ? reedKey(this, n, season) : treeKey(this, n, season);
          let entry = this.nodes.get(n.id);
          if (!entry) { const img = this.add.image(n.x * T + T / 2, n.y * T + T - 1, key).setOrigin(.5, 1).setDepth(10 + n.y * T + T - 1); entry = { img, key }; this.nodes.set(n.id, entry); }
          else if (entry.key !== key) { entry.img.setTexture(key); entry.key = key; }
          const big = n.kind === 'elder' ? 1.5 : n.stage === 'young' ? .6 : n.stage === 'mature' && n.kind !== 'bush' && n.kind !== 'rock' ? 1 : .45;
          if (n.stage !== 'spent' && n.kind !== 'clay' && n.kind !== 'reeds') this.shadowG.fillStyle(0x1f3322, season === 'winter' ? .12 : .2).fillEllipse(n.x * T + T / 2 + 3, n.y * T + T - 2, 26 * big, 9 * big);
        }
      }
      drawStockpiles(w: WorldState, season: Season) {
        for (const b of w.buildings.filter(b => b.kind === 'home' || b.kind === 'outpost' || b.kind === 'store')) {
          const people = w.residents.filter(r => r.home === b.id), totals = b.kind === 'store' ? w.stocks : { food: 0, preserves: 0, wood: 0, stone: 0 };
          if (b.kind !== 'store') for (const r of people) { totals.food += r.inventory.food; totals.preserves += r.inventory.preserves; totals.wood += r.inventory.wood; totals.stone += r.inventory.stone; }
          let g = this.stockpiles.get(b.id); if (!g) { g = this.add.graphics(); this.stockpiles.set(b.id, g); }
          g.setDepth(11 + (b.y + b.h) * T); drawStockpile(g, b, b.kind === 'store' ? { food: totals.food / 3, preserves: totals.preserves / 3, wood: totals.wood / 3, stone: totals.stone / 3 } : totals, season);
        }
      }
      drawCrops(w: WorldState, season: Season) {
        const g = this.cropG, p = palettes[season], [fx, fy, fw, fh] = fields; g.clear();
        const capacity = { spring: 12, summer: 18, autumn: 26, winter: 0 }[season], cut = capacity ? Math.min(1, w.farm.harvested / capacity) : 1;
        for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) {
          const X = x * T, Y = y * T, harvested = (x - fx) / fw < cut;
          for (const row of [4, 12]) {
            if (season === 'winter') { g.fillStyle(0xf4f8f9).fillRect(X, Y + row - 2, T, 3); continue; }
            if (harvested) { for (let i = 0; i < 4; i++) g.fillStyle(0xb89a5a).fillRect(X + 1 + i * 4, Y + row - 2, 1, 2); continue; }
            const tall = season === 'spring' ? 3 : season === 'summer' ? 7 : 8;
            for (let i = 0; i < 4; i++) { g.fillStyle(p.crop[0]).fillRect(X + 1 + i * 4, Y + row - tall, 1, tall); g.fillStyle(p.crop[1]).fillRect(X + i * 4, Y + row - tall, 3, 2); }
            if (season === 'autumn' && (x * 7 + y * 3) % 11 === 0) { g.fillStyle(0xd9782b).fillEllipse(X + 8, Y + row, 8, 6); g.fillStyle(0x5a7a35).fillRect(X + 7, Y + row - 5, 2, 2); }
          }
        }
      }
      drawWear(w: WorldState, season: Season) {
        const g = this.wearG, [light, dark] = palettes[season].wear; g.clear();
        for (let i = 0; i < w.wear.length; i++) {
          const v = w.wear[i]; if (v < 10) continue; const x = (i % MAP_W) * T, y = Math.floor(i / MAP_W) * T;
          if (v < 30) { g.fillStyle(light, .5); for (let k = 0; k < 3; k++) g.fillRect(x + ((i * 7 + k * 5) % 12), y + ((i * 3 + k * 7) % 12), 3, 2); }
          else { g.fillStyle(light, Math.min(.85, .35 + v / 150)).fillRect(x + 2, y + 2, T - 4, T - 4); g.fillStyle(dark, .5).fillRect(x + 4 + (i % 5), y + 5, 3, 2); }
        }
      }
      buildLights(w: WorldState) {
        for (const l of this.glows) l.img.destroy(); this.glows = [];
        const add = (x: number, y: number, tint: number, scale: number, base: number, when: Light['when'], flicker = 0) => this.glows.push({ img: this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(scale).setDepth(2100).setAlpha(0), base, flicker, when });
        const evening = (h: number) => h >= 17 && h < 23.5 ? 1 : h < 6.5 ? .35 : 0;
        for (const b of w.buildings) {
          if (b.kind === 'home' || b.kind === 'outpost') for (const s of windowSpots(b)) add(s.x, s.y, 0xffc46a, .5, .9, (world, h) => world.residents.some(r => r.home === b.id) ? evening(h) * (world.buildings.find(x => x.id === b.id)?.cold ? .35 : 1) : 0, .08);
          if (b.kind === 'workshop') for (const s of windowSpots(b)) add(s.x, s.y, 0xffb45a, .55, .8, (world, h) => world.residents.some(r => r.task && ['craft', 'cook', 'preserve'].includes(r.task.action.kind) && !r.task.action.target && !r.task.route.length) ? 1 : evening(h) * .4, .15);
          if (b.kind === 'store') for (const s of windowSpots(b)) add(s.x, s.y + 6, 0xffcf7a, .45, .8, (_w, h) => evening(h));
          if (b.kind === 'place') for (const block of b.blocks || []) if (block.kind === 'hearth' && block.placedBy) add((b.x + block.x + .5) * T, (b.y + block.y + .5) * T, 0xff9a3a, .8, 1, () => 1, .25);
          if (b.kind === 'hall') { for (let i = 0; i < 5; i++) add((b.x + b.w / 2) * T - 32 + i * 16, (b.y + b.h - 1) * T - 44 + (i % 2) * 4, 0xffd37a, .35, .9, (world, h) => evening(h) + (world.festivals.some(f => f.day === Math.floor(world.minute / 1440) + 1) ? .4 : 0), .1); add((b.x + b.w / 2) * T, (b.y + b.h) * T, 0xffb060, 1.6, .5, (world) => world.residents.filter(r => r.task?.action.kind === 'festival' || r.task?.action.kind === 'club').length ? 1 : 0, .2); }
        }
        for (const l of lamps) add(l.x * T + 8, l.y * T - 15, 0xffe3a0, .7, .85, (_w, h) => h >= 18.5 || h < 6.5 ? 1 : 0, .03);
      }
      buildPlaces(w: WorldState) {
        this.placeLabels.forEach(label => label.destroy()); this.placeZones.forEach(zone => zone.destroy()); this.placeZones = [];
        this.placeLabels = worldPlaces(w).map(place => {
          const label = this.add.text(place.position.x * T, (place.position.y + 1) * T, `${place.name}\n${place.project && !place.project.complete ? `${place.project.labor}/${place.project.requiredLabor} work · under construction` : place.kind}`, { fontFamily: FONT, fontSize: '12px', color: '#fff0cc', backgroundColor: '#1c3328', padding: { x: 8, y: 6 }, wordWrap: { width: 220 }, align: 'center' }).setOrigin(.5, 0).setDepth(3500).setVisible(false);
          const b = place.building || place.project?.building;
          const zone = this.add.zone(b ? (b.x + b.w / 2) * T : place.position.x * T, b ? (b.y + b.h / 2) * T : place.position.y * T, b ? b.w * T : 6 * T, b ? (b.h + 1) * T : 4 * T).setDepth(50).setInteractive({ useHandCursor: true });
          zone.on('pointerover', () => { if (!this.dragging) label.setVisible(true); }); zone.on('pointerout', () => label.setVisible(false));
          zone.on('pointerup', () => { if (!this.moved) { label.setVisible(false); placeCallback.current(place.id); } });
          this.placeZones.push(zone); return label;
        });
      }
      addResident(r: Resident, season: Season): Person {
        const age = yearsOld(r, state.current.minute), keys = residentKeys(this, r, season, age);
        // Children are drawn smaller; they grow into full size as they come of age.
        const shadow = this.add.ellipse(0, 1, 16, 6, 0x1f3322, .28), sprite = this.add.image(0, 0, keys.f0).setOrigin(.5, 1).setScale(age < 14 ? .8 + age * .03 : 1.25);
        const body = this.add.container(r.position.x * T + T / 2, r.position.y * T + T / 2, [shadow, sprite]);
        sprite.setInteractive({ useHandCursor: true }); sprite.on('pointerover', () => { this.hovered = r.id; }); sprite.on('pointerout', () => { this.hovered = null; }); sprite.on('pointerup', () => { if (!this.moved) callback.current(r.id); });
        const label = this.add.text(0, 0, r.name, { fontFamily: FONT, fontSize: '12px', color: '#fff5df', backgroundColor: '#1c3328', padding: { x: 6, y: 3 } }).setOrigin(.5).setVisible(false);
        const bubbleBox = this.add.graphics(), bubbleText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', color: '#2a3a2e', wordWrap: { width: 190 }, lineSpacing: 2 }).setOrigin(.5, 1);
        const bubble = this.add.container(0, 0, [bubbleBox, bubbleText]).setVisible(false);
        const badgeBg = this.add.circle(0, 0, 9, 0x1c3328, .92).setStrokeStyle(1, 0xe9c87d, .7), badgeIcon = this.add.image(0, 0, iconKey(this, 'rest')).setScale(1.3);
        const badge = this.add.container(0, 0, [badgeBg, badgeIcon]);
        const progress = this.add.graphics();
        const overlay = this.add.container(body.x, body.y, [progress, badge, label, bubble]).setDepth(3000);
        const person: Person = { body, sprite, overlay, label, bubble, bubbleText, bubbleBox, badge, badgeIcon, progress, keys, season, look: `${r.role}:${age}`, spoken: '', speechAt: 0, lastX: body.x, lastY: body.y, facing: 'f' };
        this.people.set(r.id, person); return person;
      }
      setBubble(p: Person, text: string) {
        p.bubbleText.setText(text); const w = Math.max(40, p.bubbleText.width + 16), h = p.bubbleText.height + 12;
        p.bubbleBox.clear().fillStyle(0x1f3322, .25).fillRoundedRect(-w / 2 + 2, -h - 6, w, h, 6).fillStyle(0xfff8e6).fillRoundedRect(-w / 2, -h - 8, w, h, 6).fillTriangle(-5, -9, 5, -9, 0, -2).lineStyle(1, 0xc9b98a).strokeRoundedRect(-w / 2, -h - 8, w, h, 6);
        p.bubbleText.setPosition(0, -14);
      }
      spawn(kind: Particle['kind'], x: number, y: number, extra: Partial<Particle> = {}) { if (this.particles.length < 900) this.particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 4000, kind, color: 0xffffff, size: 2, ...extra }); }
      weather(w: WorldState, time: number, delta: number, dark: number) {
        const cam = this.cameras.main.worldView, season = seasonOf(w.minute), h = hourOf(w.minute), rand = Math.random, area = cam.width * cam.height / 250000;
        const rate = (n: number) => rand() < n * delta / 16 * Math.min(4, area);
        if (w.weather === 'rain' && rate(3)) for (let i = 0; i < 3; i++) this.spawn('rain', cam.x + rand() * cam.width, cam.y - 20 + rand() * cam.height * .3, { vx: -.05, vy: .7, max: 900, color: 0xd6e6ec });
        if ((w.weather === 'snow' || (season === 'winter' && w.weather === 'cloudy')) && rate(w.weather === 'snow' ? 1.6 : .25)) this.spawn('snow', cam.x + rand() * cam.width, cam.y - 10, { vx: (rand() - .5) * .03, vy: .06 + rand() * .05, max: 9000, size: rand() < .3 ? 3 : 2 });
        if (season === 'autumn' && rate(.08)) { const trees = [...this.nodes.values()].filter(n => cam.contains(n.img.x, n.img.y) && n.img.height > 30); const t = trees[Math.floor(rand() * trees.length)]; if (t) this.spawn('leaf', t.img.x + (rand() - .5) * 20, t.img.y - t.img.height * .7, { vx: .02 + rand() * .03, vy: .025, max: 5000, color: palettes.autumn.leaves[Math.floor(rand() * 3)][1 + Math.floor(rand() * 2)] }); }
        if (season === 'spring' && rate(.05) && dark < .3) this.spawn('petal', cam.x + rand() * cam.width, cam.y + rand() * cam.height, { vx: .03, vy: .01, max: 5000, color: 0xf6c3d6 });
        if (season === 'summer' && dark > .35 && rate(.12)) this.spawn('firefly', cam.x + rand() * cam.width, cam.y + rand() * cam.height, { max: 5000, color: 0xe8ff9a });
        if ((season === 'spring' || season === 'summer') && dark < .2 && w.weather === 'sunny' && rate(.015)) this.spawn('butterfly', cam.x + rand() * cam.width, cam.y + rand() * cam.height, { vx: .03, max: 8000, color: [0xf5d45e, 0xf6f0e0, 0x9fb8f0][Math.floor(rand() * 3)] });
        if (time - this.lastSmoke > 350) {
          this.lastSmoke = time;
          for (const b of w.buildings) {
            if (!(b.kind === 'home' || b.kind === 'outpost' || b.kind === 'workshop') || b.cold) continue;
            const busy = b.kind === 'workshop' ? w.residents.some(r => r.task && ['craft', 'cook', 'preserve'].includes(r.task.action.kind) && !r.task.route.length) : w.residents.some(r => r.home === b.id) && (season === 'winter' || season === 'autumn' || h < 9 || h > 17);
            const c = chimneySpot(b); if (busy && cam.contains(c.x, c.y)) this.spawn('smoke', c.x + 3 + rand() * 3, c.y, { vx: .006 + rand() * .006, vy: -.018, max: 3200, size: 3, color: 0xd9dcd6 });
          }
        }
        this.fxG.clear(); this.glowFx.clear();
        this.particles = this.particles.filter(p => {
          p.life += delta; if (p.life > p.max || p.y > cam.bottom + 40) return false;
          const t = p.life / p.max; p.x += p.vx * delta; p.y += p.vy * delta;
          if (p.kind === 'rain') this.fxG.lineStyle(1, p.color, .5).lineBetween(p.x, p.y, p.x - 1, p.y + 7);
          else if (p.kind === 'snow') { p.x += Math.sin((time + p.max) / 700) * .08; this.fxG.fillStyle(0xffffff, .9).fillRect(p.x, p.y, p.size, p.size); }
          else if (p.kind === 'leaf' || p.kind === 'petal') { p.x += Math.sin((time + p.life) / 400) * .25; this.fxG.fillStyle(p.color, 1 - t * t).fillRect(p.x, p.y, 3, 2); }
          else if (p.kind === 'smoke') { const s = p.size + t * 7; this.fxG.fillStyle(p.color, .45 * (1 - t)).fillCircle(p.x + Math.sin((time + p.max) / 500) * 2, p.y, s); }
          else if (p.kind === 'firefly') { const a = Math.max(0, Math.sin(t * Math.PI) * (.5 + .5 * Math.sin(time / 180 + p.max))); p.x += Math.sin(time / 600 + p.life) * .1; p.y += Math.cos(time / 700 + p.life) * .08; this.glowFx.fillStyle(p.color, a * .35).fillCircle(p.x, p.y, 5).fillStyle(p.color, a).fillRect(p.x, p.y, 2, 2); }
          else if (p.kind === 'butterfly') { p.y += Math.sin(time / 150 + p.life) * .3; const flap = Math.sin(time / 60) > 0 ? 3 : 1; this.fxG.fillStyle(p.color, Math.min(1, (1 - t) * 3)).fillRect(p.x - flap, p.y, flap, 2).fillRect(p.x + 1, p.y, flap, 2); }
          return true;
        });
      }
      ambience(w: WorldState, time: number) {
        const cam = this.cameras.main.worldView, season = seasonOf(w.minute), p = palettes[season], g = this.waterG; g.clear();
        for (let y = Math.max(0, Math.floor(cam.y / T)); y < Math.min(MAP_H, Math.ceil(cam.bottom / T)); y++) { const cx = (70 + Math.sin(y / 10 + .6) * 2.2 + 2) * T; for (let i = 0; i < 3; i++) { const yy = y * T + ((time * .012 + i * 5 + y * 3) % T), off = Math.sin(y * 1.7 + i * 2.3) * 1.1 * T; g.fillStyle(p.waterLight, season === 'winter' ? .3 : .55).fillRect(cx + off - 3, yy, 1, 5); } }
        for (const n of w.nodes) if (n.kind === 'fish' && n.amount > 0 && cam.contains(n.x * T, n.y * T)) { const t = ((time + n.x * 300) % 2600) / 2600; g.lineStyle(1, p.foam, .7 * (1 - t)).strokeEllipse(n.x * T + 8, n.y * T + 8, 4 + t * 14, 2 + t * 6); }
        const c = this.cloudG; c.clear(); const cloudiness = { sunny: .06, cloudy: .11, rain: .13, snow: .09 }[w.weather];
        for (let i = 0; i < 7; i++) { const x = ((time * .006 + i * 420) % (W + 600)) - 300, y = ((i * 263 + time * .003) % (H + 400)) - 200; c.fillStyle(0x1b2a3a, cloudiness).fillEllipse(x, y, 320 + (i % 3) * 90, 150 + (i % 2) * 60); }
        // Unexplored land sits under soft drifting mist, built from the same radial texture as the lights.
        const bridge = !!w.projects.find(p => p.id === 'bridge')?.complete;
        const hidden = (x: number, y: number) => x >= 76 && (!bridge || (y < 27 ? !w.regions.find(r => r.id === 'meadow')?.discovered : y >= 36 ? !w.regions.find(r => r.id === 'outpost')?.discovered : false));
        if (!this.mist.length) for (let y = -2; y < MAP_H + 2; y += 3) for (let x = 77; x < MAP_W + 3; x += 3) { const img = this.add.image(x * T + ((y * 13) % 20), y * T, 'glow').setDepth(1900).setTint(0xeef1e8).setScale(1.3 + ((x * 7 + y * 3) % 5) * .18).setAlpha(0); img.setData('home', img.x).setData('weight', (x < 80 ? .45 : .6) + ((x * 5 + y * 11) % 7) * .03); this.mist.push(img); }
        for (const m of this.mist) { const on = hidden(Math.max(76, Math.floor(m.getData('home') / T)), Math.max(0, Math.min(MAP_H - 1, Math.floor(m.y / T)))); m.setAlpha(Phaser.Math.Linear(m.alpha, on ? m.getData('weight') : 0, .04)); if (m.alpha > .01) m.x = m.getData('home') + Math.sin(time / 4000 + m.y * .01) * 10; }
      }
      update(time: number, delta: number) {
        const w = state.current; this.sync(w, time);
        const season = seasonOf(w.minute), h = hourOf(w.minute), [tint, alpha] = tintAt(h), overcast = w.weather === 'rain' ? .14 : w.weather === 'cloudy' || w.weather === 'snow' ? .08 : 0;
        this.night.setFillStyle(alpha > overcast ? tint : 0x9aa4b0, Math.max(alpha, overcast)); const dark = Math.min(1, alpha / .62);
        for (const l of this.glows) { const on = l.when(w, h) * dark; l.img.setAlpha(on * l.base * (1 - l.flicker + l.flicker * Math.sin(time / 90 + l.img.x) ** 2)); }
        this.ambience(w, time); this.weather(w, time, delta, dark);
        this.placeLabels.forEach(label => label.setScale(1 / Math.max(.85, this.cameras.main.zoom)));
        const zoom = this.cameras.main.zoom, offsets = residentOffsets(w.residents, zoom);
        const speakers = w.residents.filter(r => r.speech).sort((a, b) => (b.speech?.until || 0) - (a.speech?.until || 0)).slice(0, 3).map(r => r.id);
        const present = new Set(w.residents.map(r => r.id));
        for (const [id, p] of this.people) if (!present.has(id)) { p.body.destroy(); p.overlay.destroy(); this.people.delete(id); }
        this.ring.clear();
        for (const r of w.residents) {
          let p = this.people.get(r.id) || this.addResident(r, season);
          const age = yearsOld(r, w.minute); if (p.season !== season || p.look !== `${r.role}:${age}`) { p.keys = residentKeys(this, r, season, age); p.season = season; p.look = `${r.role}:${age}`; p.sprite.setScale(age < 14 ? .8 + age * .03 : 1.25); }
          const offset = offsets.get(r.id)!, tx = r.position.x * T + T / 2 + offset.x, ty = r.position.y * T + T / 2 + offset.y;
          p.body.x = Phaser.Math.Linear(p.body.x, tx, Math.min(1, delta / 350)); p.body.y = Phaser.Math.Linear(p.body.y, ty, Math.min(1, delta / 350));
          const dx = p.body.x - p.lastX, dy = p.body.y - p.lastY, moving = Math.abs(dx) + Math.abs(dy) > .15; p.lastX = p.body.x; p.lastY = p.body.y;
          if (moving) { p.facing = Math.abs(dy) > Math.abs(dx) && dy < 0 ? 'b' : 'f'; if (Math.abs(dx) > .05) p.sprite.setFlipX(dx < 0); }
          p.sprite.setTexture(p.keys[p.facing + (moving ? (Math.floor(time / 140) % 2 ? 1 : 2) : 0)]); p.sprite.y = moving ? -Math.abs(Math.sin(time / 140 * Math.PI)) : Math.sin(time / 900 + r.position.x) * .4;
          p.body.setDepth(10 + p.body.y + 6); p.overlay.setPosition(p.body.x, p.body.y).setDepth(3000 + p.body.y / 10).setScale(1 / zoom);
          const head = 32 * zoom; p.badge.setY(-head - 12); p.label.setY(-head - 34); p.bubble.setY(-head - 20);
          const focus = selection.current === r.id || this.hovered === r.id, traveling = !!r.task?.route.length;
          p.label.setText(`${r.name}${r.task ? ' · ' + (traveling ? 'On the way' : actionLabels[r.task.action.kind]) : ' · Thinking'}`).setVisible(focus);
          p.badgeIcon.setTexture(iconKey(this, r.task ? r.task.action.kind : 'socialize')); p.badge.setAlpha(r.task ? (traveling ? .7 : 1) : .45).setVisible(!focus || !r.speech);
          const text = r.speech?.text || ''; if (text !== p.spoken) { p.spoken = text; p.speechAt = time; }
          const say = !!text && (focus || (speakers.includes(r.id) && time - p.speechAt < 10000));
          if (say) { const shown = focus || text.length <= 90 ? text : text.slice(0, 87) + '…'; if (p.bubbleText.text !== shown) this.setBubble(p, shown); }
          p.bubble.setVisible(say); p.badge.setVisible(!say);
          p.progress.clear();
          if (r.task && !traveling) { const durations: Record<string, number> = { gather: 30, farm: 40, cook: 20, preserve: 30, craft: 35, trade: 10, gift: 8, ask: 8, deposit: 10, withdraw: 8, plant: 20, socialize: 10, rest: 90, eat: 5, explore: 60, build: 40, club: 25, festival: 30, promise: 10, share: 10, design: 25, name_place: 5 }; const fraction = Phaser.Math.Clamp(1 - r.task.remaining / durations[r.task.action.kind], 0, 1); p.progress.fillStyle(0x1c3328, .85).fillRoundedRect(-12, 8, 24, 5, 2).fillStyle(0xf1d28b).fillRoundedRect(-11, 9, Math.max(1, Math.round(22 * fraction)), 3, 1); }
          if (this.followed === r.id) this.cameras.main.centerOn(p.body.x, p.body.y);
          if (selection.current === r.id) this.ring.lineStyle(2, 0xffe8a6, .9).strokeEllipse(p.body.x, p.body.y + 1, 26, 10);
        }
      }
    }
    let game: Phaser.Game | undefined, cancelled = false;
    // Wait briefly for the pixel font so canvas text does not render in a fallback face.
    void Promise.race([document.fonts?.load(`12px ${FONT}`), new Promise(done => setTimeout(done, 1500))]).catch(() => undefined).then(() => {
      if (cancelled || !element.current) return;
      game = new Phaser.Game({ type: Phaser.AUTO, parent: element.current, width: element.current.clientWidth, height: element.current.clientHeight, pixelArt: true, antialias: false, transparent: false, scale: { mode: Phaser.Scale.RESIZE }, scene: Village, render: { roundPixels: true }, audio: { noAudio: true } });
    });
    return () => { cancelled = true; controls.current = null; game?.destroy(true); };
  }, []);
  return <div ref={element} className="world-canvas" aria-label="Live interactive pixel village. Drag to pan, scroll to zoom, or select a resident from the list." />;
}
export type { Controls };
