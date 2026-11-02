// Each resident's look is derived from their id, so it is stable across restarts and needs no storage.
export type Appearance = { skin: string; skinShade: string; hair: string; hairStyle: 'short' | 'long' | 'bun' | 'curly' | 'cap'; pants: string; accessory: 'apron' | 'hat' | 'belt' | 'satchel' | 'none'; hat: string };
const skins = [['#f3d2b5', '#dfb495'], ['#eec39c', '#d6a47c'], ['#dcaa80', '#c18d63'], ['#c38b61', '#a8704a'], ['#9c6a47', '#83573a'], ['#7a5236', '#65432c']];
const hairs = ['#3b2a20', '#5e3f28', '#8f5f35', '#c79a57', '#2d2a33', '#8e3c2a', '#b9b3a9', '#e0c690'];
const trousers = ['#4f5b6e', '#5d4b3d', '#3f5a4c', '#6b5a7a', '#4a4a4a', '#7a6248'];
const styles: Appearance['hairStyle'][] = ['short', 'long', 'bun', 'curly', 'cap'];
function hash(text: string) { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export function appearance(id: string, role: string, age = 30): Appearance {
  const h = hash(id), skin = skins[h % skins.length];
  const accessory: Appearance['accessory'] = ['Baker', 'Cook'].includes(role) ? 'apron' : ['Wanderer', 'Forager', 'Naturalist'].includes(role) ? 'hat' : ['Carpenter', 'Tinkerer', 'Stonemason'].includes(role) ? 'belt' : ['Trader', 'Storykeeper'].includes(role) ? 'satchel' : 'none';
  // Hair greys after sixty.
  return { skin: skin[0], skinShade: skin[1], hair: age >= 60 ? '#cfcac2' : hairs[(h >>> 5) % hairs.length], hairStyle: styles[(h >>> 9) % styles.length], pants: trousers[(h >>> 13) % trousers.length], accessory, hat: ['#7b5a3a', '#5f6e4a', '#8a6d4a'][(h >>> 17) % 3] };
}
