import { expect, it } from 'vitest';
import { createWorld, legalActions, startAction, finishAction, emit } from '../src/server/world.ts';
it('keeps a pending reply available even when several other neighbors are closer', () => {
  const w = createWorld(), r = w.residents[0], partner = w.residents[11];
  r.position = { x: 35, y: 27 };
  for (const other of w.residents.slice(1)) other.position = { x: 36, y: 27 };
  partner.position = { x: 40, y: 27 };
  r.reply = { from: partner.id, eventId: 1, expires: w.minute + 120 };
  expect(legalActions(w, r).some(a => a.kind === 'socialize' && a.target === partner.id)).toBe(true);
});

it('shares the selected memory even if new observations arrive during the action', () => {
  const w = createWorld(), r = w.residents[0], partner = w.residents[1]; partner.position = { ...r.position };
  const old = emit(w, 'work', 'A useful discovery', 'Found a sheltered clearing.', [r.id], r.position);
  const chosen = r.memories.find(m => m.eventIds.includes(old.id))!;
  expect(startAction(w, r, { kind: 'share', target: partner.id, sharedMemoryId: chosen.id, reason: 'Tell the story.' })).toBe(true);
  for (let i = 0; i < 10; i++) emit(w, 'work', 'New observation', `Ordinary work ${i}`, [r.id], r.position);
  finishAction(w, r);
  expect(partner.memories.filter(m => m.kind === 'belief').at(-1)?.text).toContain('sheltered clearing');
});
it('does not silently redirect a promise to a different project', () => {
  const w = createWorld(), r = w.residents[0], partner = w.residents[1]; partner.position = { ...r.position };
  expect(startAction(w, r, { kind: 'promise', target: partner.id, reason: 'Promise bridge help.' })).toBe(true);
  w.projects.push({ ...structuredClone(w.projects[0]), id: 'another-project', name: 'Another project' });
  w.projects[0].complete = true; finishAction(w, r);
  expect(r.promises).toHaveLength(0);
});
