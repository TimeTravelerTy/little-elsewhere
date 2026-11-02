import { it, expect } from 'vitest';
import { createWorld, createResident, refreshAims } from '../src/server/world.ts';
import { residentOffsets } from '../src/client/residentLayout.ts';
it('newcomers have their own goals and completed goals move on only once', () => {
 const w=createWorld(),r=createResident(12);expect(r.ambition).not.toContain('bridge');expect(r.values).toBeDefined();
 w.residents.push(r);w.projects[0].complete=true;
 const events=refreshAims(w);expect(w.residents[0].ambition).toContain('beyond the bridge');expect(events).toHaveLength(1);expect(refreshAims(w)).toHaveLength(0);
});
it('a completed storytelling goal progresses without removing the club', () => {
 const w=createWorld(),sol=w.residents.find(r=>r.id==='sol')!;w.clubs.push({name:'The evening stories',members:['sol'],founded:w.minute});
 refreshAims(w);expect(sol.ambition).toContain('welcome new voices');expect(w.clubs).toHaveLength(1);
});
it('stacked residents remain separately visible without mutating world positions', () => {
 const residents=Array.from({length:6},(_,i)=>({id:String(i),position:{x:20,y:20}}));const before=structuredClone(residents);
 const offsets=residentOffsets(residents,.6);expect(new Set([...offsets.values()].map(o=>`${o.x}:${o.y}`)).size).toBe(6);expect(residents).toEqual(before);expect(residentOffsets([...residents].reverse(),.6)).toEqual(offsets);
});
