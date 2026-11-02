import { normBook } from '../shared/norms';
import { clockLabel, dayOf, type WorldState } from '../shared/types';

// The board beneath the gathering oak: what the village has agreed, and what it is deciding.
export function VillageRules({ world, onResident }: { world: WorldState; onResident?: (id: string) => void }) {
  const name = (id: string) => world.residents.find(r => r.id === id)?.name || world.departed.find(d => d.id === id)?.name || 'someone';
  const people = (ids: string[]) => ids.length ? ids.map((id, i) => <span key={id}>{i ? ', ' : ''}{onResident && world.residents.some(r => r.id === id) ? <button className="text-link" onClick={() => onResident(id)}>{name(id)}</button> : name(id)}</span>) : 'no one';
  const open = (world.proposals ?? []).filter(p => p.status === 'open'), closed = (world.proposals ?? []).filter(p => p.status !== 'open').slice(-4).reverse();
  return <div className="rules">
    {open.map(p => <div className="proposal" key={p.id}>
      <span className="eyebrow">UNDER DISCUSSION · CLOSES DAY {dayOf(p.closes)} {clockLabel(p.closes)}</span>
      <strong>{p.repeal ? 'Drop: ' : ''}“{normBook[p.norm].text}”</strong>
      <small>Proposed by {name(p.proposedBy)}</small>
      <div className="tally"><i style={{ flex: p.for.length || .001 }} className="for" /><i style={{ flex: p.against.length || .001 }} className="against" /></div>
      <p><b>{p.for.length} for</b>: {people(p.for)}</p><p><b>{p.against.length} against</b>: {people(p.against)}</p>
    </div>)}
    {(world.norms ?? []).length ? <ol className="rule-list">{(world.norms ?? []).map(n => <li key={n.id}>
      <strong>“{normBook[n.id].text}”</strong>
      <small>Since Day {n.adoptedDay} · proposed by {name(n.proposedBy)} · {n.supporters.length}–{n.opponents.length} · broken {n.breaches} time{n.breaches === 1 ? '' : 's'}</small>
    </li>)}</ol> : <p className="muted">No rules yet. Anyone may propose one at the gathering oak when something happens that they think the village should settle.</p>}
    {closed.length > 0 && <><span className="eyebrow">RECENT DECISIONS</span><ul className="decisions">{closed.map(p => <li key={p.id}>{p.status === 'adopted' ? (p.repeal ? 'Dropped' : 'Adopted') : 'Turned down'}: {p.repeal ? 'dropping ' : ''}“{normBook[p.norm].text}” <small>{p.for.length}–{p.against.length}, Day {dayOf(p.closes)}</small></li>)}</ul></>}
  </div>;
}
