import { expect, it } from 'vitest';
import { createWorld, emit } from '../src/server/world.ts';
import { dialogueContext, invalidSpeech, shareableMemories } from '../src/server/dialogue.ts';
import { context } from '../src/server/ai.ts';
it('separates heard claims from facts, preserves exact reply and offers distinct voices', () => {
  const w = createWorld(), r = w.residents[0], other = w.residents[1];
  const e = emit(w, 'conversation', 'Ada spoke', 'Ada: “I found wild fruit signs.”', [r.id, other.id], r.position);
  r.reply = { from: other.id, eventId: e.id, expires: w.minute + 30 };
  const c = dialogueContext(w, r, { kind: 'socialize', target: other.id, reason: 'Reply.' });
  expect(c.reply).toEqual({ instruction: expect.stringContaining('without restating') });
  expect(JSON.stringify(c)).not.toContain('wild fruit signs'); expect(shareableMemories(r)).toEqual([]);
  expect(JSON.stringify(context(w, r))).not.toContain('wild fruit signs');
  expect(c.speaker.voice).not.toBe(dialogueContext(w, other, { kind: 'socialize', target: r.id, reason: 'Talk.' }).speaker.voice);
});
it('grounds content through a selected brief instead of vocabulary filters', () => {
  const w = createWorld(), r = w.residents[0];
  emit(w, 'conversation', 'Ada spoke', 'Ada: “Have you spotted any wild fruit signs near the edge yet?”', [r.id], r.position);
  expect(dialogueContext(w, r, { kind: 'socialize', target: w.residents[1].id, reason: 'Talk.' }).brief.fact).not.toContain('fruit');
  expect(invalidSpeech('Fruit sounds lovely in summer.', w, r, w.residents[1])).toBe(false);
  expect(invalidSpeech('I need a rest before I take on more work.', w, r, w.residents[1])).toBe(false);
});
it('rejects self-reference, third-party gossip and leaked scratch text', () => {
  const w = createWorld(), ash = w.residents[1], speaker = w.residents[0], third = w.residents[2];
  ash.name = 'Ash';
  expect(invalidSpeech("Ash, did you catch Ash's question?", w, speaker, ash)).toBe(true);
  expect(invalidSpeech(`${third.name} said the road was clear.`, w, speaker, ash)).toBe(true);
  expect(invalidSpeech('Itpthoughts: I should ask about fruit.', w, speaker, ash)).toBe(true);
});
