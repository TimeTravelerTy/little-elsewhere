import type { AgentAction, WorldState } from './types';
import { partLabels } from './construction';
import { normBook, isNormId } from './norms';
import { techniques } from './making';
// Character-facing wording of the chosen action, not an invented explanation of hidden motives.
export function actionIntention(action: AgentAction, world: Pick<WorldState, 'residents' | 'projects' | 'regions'> & Partial<Pick<WorldState, 'buildings' | 'nodes'>>): string {
  const neighbor = world.residents.find(r => r.id === action.target)?.name || 'my neighbor';
  const project = world.projects.find(p => p.id === (action.projectId || action.target))?.name || 'our next project';
  const region = world.regions.find(r => r.id === action.target)?.name || 'the frontier';
  switch (action.kind) {
    case 'design': return "I'll draw up a small place the village can build.";
    case 'name_place': return `I'll give ${project} a name.`;
    case 'gather': { const kind = world.nodes?.find(n => n.id === action.target)?.kind; if (kind === 'clay' || kind === 'reeds') return `I'll ${kind === 'clay' ? 'dig some clay' : 'cut some reeds'}.`; }
      return `I'll gather some ${action.target?.startsWith('r') ? 'stone' : action.target?.startsWith('b') ? 'berries' : action.target?.startsWith('f') ? 'fish' : 'wood'}.`;
    case 'farm': return "I'll tend the fields and bring in some food.";
    case 'cook': return "I'll make myself a warm meal.";
    case 'craft': return action.item === 'brick' ? "I'll fire some brick." : action.item === 'pots' ? "I'll fire a pot or two." : action.item === 'baskets' ? "I'll weave a basket." : "I'll make a tool for the work ahead.";
    case 'socialize': return `I'll stop and talk with ${neighbor}.`;
    case 'rest': return "I'll take a little time to rest.";
    case 'eat': return "I'll have something to eat.";
    case 'explore': return `I'll take a closer look at ${region}.`;
    case 'build': return `I'll lend a hand with ${project}.`;
    case 'club': return "I'll spend some time with the club.";
    case 'festival': return "I'll arrange a gathering under the oak.";
    case 'promise': return `I'll promise ${neighbor} a hand with ${project}.`;
    case 'share': return `I'll share a story with ${neighbor}.`;
    case 'preserve': return "I'll put some food by for the lean days.";
    case 'trade': return action.mode === 'sell' ? `I'll offer ${neighbor} some ${action.item} for coin.` : `I'll buy some ${action.item} from ${neighbor}.`;
    case 'gift': return `I'll give ${neighbor} some ${action.item}. They need it more than I do.`;
    case 'ask': return `I'll ask ${neighbor} if they can spare some ${action.item}.`;
    case 'deposit': return `I'll put my spare ${action.item} in the pantry.`;
    case 'withdraw': return `I'll take some ${action.item} from the pantry.`;
    case 'plant': return "I'll plant a sapling where a tree came down.";
    case 'extend': return `I'll suggest adding ${action.part ? partLabels[action.part].label : 'something'} to one of our places.`;
    case 'propose': return isNormId(action.target) ? `I'll ask the village to ${action.repeal ? 'drop the rule' : 'agree'}: “${normBook[action.target].text}”` : "I'll put a rule to the village.";
    case 'vote': return `I'll speak ${action.stance || 'up'} at the gathering oak.`;
    case 'court': return `I'll ask ${neighbor} whether we might share a life.`;
    case 'experiment': return `I'll try working this ${action.item || 'material'} into something useful.`;
    case 'teach': return `I'll show ${neighbor} ${action.technique ? techniques[action.technique].how : 'what I know'}.`;
    case 'repair': return `I'll patch up the worn parts of ${world.buildings?.find(b => b.id === action.target)?.name || 'one of our places'}.`;
    case 'play': return action.target ? `I'll go and play with ${neighbor}.` : "I'll go and play by the oak.";
  }
}
