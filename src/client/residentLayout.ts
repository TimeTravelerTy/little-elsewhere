import type { Resident } from '../shared/types';
// Render-only separation: meetings and shared doorways retain their real simulation coordinates.
export function residentOffsets(residents: Pick<Resident, 'id' | 'position'>[], zoom: number): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  const groups: typeof residents[] = [];
  for (const resident of [...residents].sort((a,b)=>a.id.localeCompare(b.id))) {
    const matching = groups.filter(group => group.some(other => Math.hypot(resident.position.x-other.position.x, resident.position.y-other.position.y)<1));
    if (!matching.length) groups.push([resident]);
    else {
      const group = matching[0];group.push(resident);
      for (const merged of matching.slice(1)) { group.push(...merged);groups.splice(groups.indexOf(merged),1); }
    }
  }
  const gap = Math.max(25, 28 / Math.max(.45,zoom));
  const rowGap = Math.max(40, 50 / Math.max(.45,zoom));
  for (const group of groups) {
    group.sort((a,b)=>a.id.localeCompare(b.id));
    const cols=Math.min(4,group.length),rows=Math.ceil(group.length/cols);
    group.forEach((r,i)=>result.set(r.id,{x:((i%cols)-(cols-1)/2)*gap,y:(Math.floor(i/cols)-(rows-1)/2)*rowGap}));
  }
  return result;
}
