// Builds a throwaway world advanced to a given day and hour, for previewing the renderer.
// Usage: node --import tsx scripts/preview-world.ts <db-path> <day> <hour> [seed]
import { Store } from '../src/server/store.ts';
import { advance, createWorld, emit, routine, startAction } from '../src/server/world.ts';
const [path, day = '1', hour = '10', seed = '4217'] = process.argv.slice(2);
const w = createWorld(Number(seed)), target = (Number(day) - 1) * 1440 + Number(hour) * 60, store = new Store(path);
const events = [emit(w, 'arrival', 'A little place to begin again', 'Preview world.', w.residents.map(r => r.id), { x: 40, y: 32 }, [], 9)];
while (w.minute < target) { for (const r of w.residents) if (!r.task && r.nextDecision <= w.minute) startAction(w, r, routine(w, r)); events.push(...advance(w, Math.min(2, target - w.minute))); }
store.save(w, events.slice(-2000)); store.close(); console.log(path, 'day', day, 'hour', hour, 'residents', w.residents.length);
