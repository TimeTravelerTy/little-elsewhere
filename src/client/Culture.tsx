import { dayOf, yearsOld, type Resident, type WorldState } from '../shared/types';
import { knowsHow, techniqueIds, techniques } from '../shared/making';

const nameOf = (world: WorldState, id?: string) => world.residents.find(r => r.id === id)?.name || world.departed.find(d => d.id === id)?.name;

// What the village remembers and repeats: legends, traditions, and the lives that began and ended here.
export function VillageCulture({ world }: { world: WorldState }) {
  const legends = [...(world.legends ?? [])].reverse(), traditions = world.traditions ?? [];
  const deaths = world.departed.filter(d => d.died).slice(-5).reverse(), born = world.residents.filter(r => r.parents).sort((a, b) => b.born - a.born).slice(0, 5);
  const couples = world.residents.filter(r => r.partner && r.id < r.partner).map(r => `${r.name} & ${nameOf(world, r.partner)}`);
  return <div className="culture">
    {legends.length > 0 && <><span className="eyebrow">LEGENDS</span><ul className="legend-list">{legends.slice(0, 6).map(l => <li key={l.eventId}><strong>{l.title}</strong><small>{l.text}</small><small>A legend since Day {l.day} · first told by {l.tellers.slice(0, 3).map(t => nameOf(world, t)).join(', ')}</small></li>)}</ul></>}
    {traditions.length > 0 && <><span className="eyebrow">TRADITIONS</span><ul className="legend-list">{traditions.map(t => <li key={t.id} className={t.faded ? 'faded' : ''}><strong>{t.name}</strong><small>Day {t.seasonDay} of {t.season}, beneath the oak · kept {t.kept} time{t.kept === 1 ? '' : 's'}{t.faded ? ' · faded' : t.missed ? ' · missed last year' : ''}</small></li>)}</ul></>}
    {Object.keys(world.discoveries ?? {}).length > 0 && <><span className="eyebrow">KNOW-HOW</span><ul className="legend-list">{techniqueIds.filter(t => world.discoveries?.[t]).map(t => { const d = world.discoveries[t]!, knowers = world.residents.filter(r => knowsHow(r, t)); return <li key={t} className={d.lost ? 'faded' : ''}><strong>{techniques[t].label[0].toUpperCase() + techniques[t].label.slice(1)}</strong><small>First worked out by {nameOf(world, d.by) || 'someone'} on Day {d.day} · {d.lost ? 'no one living remembers how' : `known by ${knowers.length <= 3 ? knowers.map(r => r.name).join(', ') : `${knowers.length} people`}`}</small></li>; })}</ul></>}
    {!legends.length && !traditions.length && <p className="muted">Stories that people keep retelling become legends. A gathering held again on the same day a year later becomes a tradition.</p>}
    {(couples.length > 0 || born.length > 0 || deaths.length > 0) && <><span className="eyebrow">LIVES</span><ul className="decisions">
      {couples.length > 0 && <li>Partners: {couples.join(' · ')}</li>}
      {born.map(c => <li key={c.id}>{c.name} born Day {dayOf(c.born)} to {c.parents!.map(p => nameOf(world, p)).join(' and ')}</li>)}
      {deaths.map(d => <li key={d.id}>{d.name}, {d.role.toLowerCase()}, died at {d.age} on Day {dayOf(d.minute)}</li>)}
    </ul></>}
  </div>;
}
export function Family({ world, resident: r }: { world: WorldState; resident: Resident }) {
  const partner = nameOf(world, r.partner), parents = r.parents?.map(p => nameOf(world, p)).filter(Boolean), children = world.residents.filter(c => c.parents?.includes(r.id));
  if (!partner && !parents?.length && !children.length) return null;
  return <div className="detail-section"><div className="eyebrow">FAMILY</div><p>
    {partner && <>Partner: {partner}. </>}{parents?.length ? <>Child of {parents.join(' and ')}. </> : null}
    {children.length ? <>Children: {children.map(c => `${c.name} (${yearsOld(c, world.minute)})`).join(', ')}.</> : null}
  </p></div>;
}
