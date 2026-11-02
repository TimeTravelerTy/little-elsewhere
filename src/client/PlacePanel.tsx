import { buildGoods, capabilityLabels, materialOf, placeCapabilities, warmth, weathers, type ElementKind } from '../shared/construction';
import { VillageRules } from './Rules';

const glyphs: Record<ElementKind, string> = { floor: '▰', wall: '▥', roof: '⌂', seat: '═', hearth: '♨', bed: '▭', shelf: '☰', planter: '✿', smoker: '≋', bench: '⚒', kiln: '◘' };
import { worldPlaces } from '../shared/places';
import type { WorldState } from '../shared/types';

// What a place is built of, how warm it keeps, and which walls or roof are wearing thin.
function Condition({ building }: { building: NonNullable<WorldState['buildings'][number]> }) {
  const envelope = (building.blocks || []).filter(x => x.placedBy && weathers(x)); if (!envelope.length) return null;
  const of = (kind: 'wall' | 'roof') => [...new Set(envelope.filter(x => x.kind === kind).map(materialOf))].join(' and ');
  const walls = of('wall'), roof = of('roof'), worn = envelope.filter(x => (x.wear || 0) >= .5), failed = envelope.filter(x => (x.wear || 0) >= 1);
  return <p className={failed.length ? 'cold' : ''}>{[walls && `${walls[0].toUpperCase()}${walls.slice(1)} walls`, roof && `${walls ? 'a' : 'A'} roof of ${roof}`].filter(Boolean).join(' and ')}; keeps out {Math.round(Math.max(0, warmth(building)) * 100)}% of the cold.{' '}
    {failed.length ? `${failed.length} section${failed.length > 1 ? 's have' : ' has'} worn through and need${failed.length > 1 ? '' : 's'} patching.` : worn.length ? `${worn.length} section${worn.length > 1 ? 's are' : ' is'} wearing thin.` : 'In good repair.'}</p>;
}
export function PlacePanel({ world, selected, onSelect, onResident, onClose }: {
  world: WorldState; selected: string | null; onSelect: (id: string) => void;
  onResident: (id: string) => void; onClose: () => void;
}) {
  const places = worldPlaces(world), place = places.find(item => item.id === selected);
  const project = place?.project, built = place?.building?.kind === 'place' ? place.building : project?.building;
  const additions = place?.building ? world.projects.filter(p => p.extension?.building === place.building!.id && !p.complete) : [];
  const blocks = [...(built?.blocks || []), ...additions.flatMap(p => p.extension!.blocks)];
  const occupants = world.residents.filter(resident => place?.building && resident.home === place.building.id);
  return <section className="place-panel">
    <div className="drawer-head"><div><span className="eyebrow">VILLAGE DIRECTORY</span><h2>Places</h2></div><button className="icon-button" aria-label="Close places" onClick={onClose}>×</button></div>
    <label className="place-picker">Explore a place<select value={place?.id || ''} onChange={event => onSelect(event.target.value)}><option value="" disabled>Choose a place…</option>{places.map(item => <option key={item.id} value={item.id}>{item.name}{item.project && !item.project.complete ? ' · Building' : ''}</option>)}</select></label>
    {place ? <div className="place-content" aria-live="polite">
      <span className="eyebrow">{place.kind} · {project && !project.complete ? 'In progress' : 'In use'}</span>
      <h2>{place.name}</h2><p>{place.description}</p>
      {project?.design && <><p>Proposed by {world.residents.find(r => r.id === project.design?.proposedBy)?.name || 'a resident'}.</p>
        {place.building?.namedBy && <p>Named by {world.residents.find(r => r.id === place.building?.namedBy)?.name || 'a builder'}.</p>}
        <div className="blueprint-grid" aria-label="Material blueprint">{Array.from({ length: 16 }, (_, i) => {
          const cell = blocks.filter(b => b.x === i % 4 && b.y === Math.floor(i / 4));
          const placed = cell.filter(b => b.placedBy), top = placed.at(-1);
          return <span key={i} className={`blueprint-cell ${top?.kind || 'planned'}`} title={cell.map(b => `${b.material && b.material !== 'timber' && b.material !== 'stone' ? `${b.material} ` : ''}${b.kind}: ${b.placedBy ? world.residents.find(r => r.id === b.placedBy)?.name || world.departed.find(d => d.id === b.placedBy)?.name || 'a neighbor' : 'planned'}`).join(', ')}>{top ? glyphs[top.kind] : '·'}</span>;
        })}</div><p>{blocks.filter(b => b.placedBy).length} / {blocks.length} parts placed</p>
        {project.complete && built && <p>Available: {placeCapabilities(built).map(c => capabilityLabels[c]).join(' · ') || 'nothing yet'}.</p>}
        {built && <Condition building={built} />}
        {additions.map(p => <p key={p.id} className="addition">Being added: {p.name.replace(/ for .*$/, '').toLowerCase()} ({p.labor}/{p.requiredLabor}, {buildGoods.filter(g => p.requires[g]).map(g => `${p.supplied[g] || 0}/${p.requires[g]} ${g}`).join(', ')}). Proposed by {world.residents.find(r => r.id === p.extension!.proposedBy)?.name || 'a resident'}.</p>)}
        {project.complete && !project.building?.namedBy && <p>Finished and usable. Waiting for a builder to give it a name.</p>}
      </>}
      {place.building?.kind === 'store' && <><h3>In the pantry</h3><dl className="ledger">{([['Fresh food', world.stocks.food], ['Preserves', world.stocks.preserves], ['Wood', world.stocks.wood], ['Stone', world.stocks.stone]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="muted">Anyone may add or take. Neighbors notice who does which.</p></>}
      {place.building?.kind === 'market' && <><h3>Going rates</h3><dl className="ledger">{(Object.entries(world.market) as [string, { price: number; trades: number; volume: number }][]).map(([good, m]) => <div key={good}><dt>{good}</dt><dd>{m.price.toFixed(1)} coins <small>· {m.trades} trades</small></dd></div>)}</dl><p className="muted">Prices move with each deal residents strike.</p></>}
      {place.building?.kind === 'farm' && <p>Today's harvest: {world.farm.harvested} food so far.</p>}
      {place.building?.kind === 'hall' && <><h3>Village rules</h3><VillageRules world={world} onResident={onResident} /></>}
      {place.building && (['home', 'outpost'].includes(place.building.kind) || placeCapabilities(place.building).includes('home')) && <>{place.building.cold && <p className="cold">This home went cold last night for lack of firewood.</p>}<h3>Lives here</h3>{occupants.length ? occupants.map(person => <button className="place-person" key={person.id} onClick={() => onResident(person.id)}>{person.name} <span>{person.role} →</span></button>) : <p>No residents have moved in yet.</p>}</>}
      {project ? <><h3>{project.complete ? 'Built together' : 'Construction ledger'}</h3>{!project.complete && <dl>{([...buildGoods.filter(g => project.requires[g]).map(g => [g[0].toUpperCase() + g.slice(1), project.supplied[g] || 0, project.requires[g] || 0] as const), ['Labor', project.labor, project.requiredLabor] as const]).map(([label, value, total]) => <div key={label}><dt>{label}</dt><dd>{value} / {total}</dd><progress aria-label={label} value={value} max={total} /></div>)}</dl>}<p>{project.contributors.length ? project.contributors.map(id => world.residents.find(person => person.id === id)?.name || id).join(', ') : 'Waiting for its first helping hands.'}</p><small>Project available since Day {project.unlockedDay}</small></> : <p className="place-origin">Part of the original village.</p>}
    </div> : <p className="empty">Choose a place above or tap a building on the map to discover its purpose and people.</p>}
  </section>;
}
