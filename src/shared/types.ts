import type { BlueprintKind, BuildGood, ConstructionBlock, Method, PartKind } from './construction';
import type { Technique } from './making';
import type { Norm, NormId, Proposal } from './norms';
// Clay and reeds are raw; brick, pots and baskets have to be made, and making them takes know-how.
export type Goods = 'food' | 'preserves' | 'wood' | 'stone' | 'tools' | 'clay' | 'reeds' | 'brick' | 'pots' | 'baskets';
export type Resource = Goods | 'coins';
export type Inventory = Record<Resource, number>;
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Weather = 'sunny' | 'cloudy' | 'rain' | 'snow';
// What a resident cares about. Observers judge deeds through these, so the same act can earn
// admiration from one neighbor and resentment from another.
export type Value = 'nature' | 'sharing' | 'industry';
export type ActionKind = 'gather' | 'farm' | 'cook' | 'preserve' | 'craft' | 'trade' | 'gift' | 'ask' | 'deposit' | 'withdraw' | 'plant' | 'socialize' | 'rest' | 'eat' | 'explore' | 'build' | 'club' | 'festival' | 'promise' | 'share' | 'design' | 'name_place' | 'extend' | 'propose' | 'vote' | 'court' | 'play' | 'experiment' | 'teach' | 'repair';
export type Position = { x: number; y: number };
export type AgentAction = { kind: ActionKind; target?: string; speech?: string; reason: string; projectId?: string; sharedMemoryId?: string; placeName?: string; dialogueTopic?: string; item?: Goods; quantity?: number; mode?: 'buy' | 'sell'; part?: PartKind; stance?: 'for' | 'against'; repeal?: boolean; method?: Method; technique?: Technique };
export type Deed = { actor: string; tags: Partial<Record<Value, number>>; summary: string; norm?: NormId; recipient?: string };
export type AgentMemory = { id: string; minute: number; text: string; importance: number; eventIds: number[]; kind: 'observation' | 'reflection' | 'commitment' | 'belief'; source?: string; deed?: Deed; event?: WorldEvent['kind'] };
// balance: goods this person has given the other minus what came back; the basis of gratitude and resentment.
export type Relationship = { trust: number; warmth: number; interactions: number; note?: string; balance?: number };
export type Task = { action: AgentAction; destination: Position; route: Position[]; remaining: number; started: number };
export type Commitment = { to: string; project: string; due: number; status: 'open' | 'kept' | 'missed' | 'released'; eventId: number };
export type Resident = {
  id: string; name: string; role: string; bio: string; traits: string[]; ambition: string; color: string; values: Record<Value, number>;
  position: Position; home: string; inventory: Inventory; needs: { hunger: number; energy: number; social: number };
  skills: { farming: number; crafting: number; exploring: number }; relationships: Record<string, Relationship>;
  memories: AgentMemory[]; plan: string; task: Task | null; nextDecision: number; lastReason: string;
  speech?: { text: string; until: number }; promises: Commitment[];
  lastPlanDay: number; lastReflectionDay: number; lastSocial: Record<string, number>; lastAction: ActionKind | null;
  reply?: { from: string; eventId: number; expires: number; speech?: string; topic?: string };
  hungryDays: number; arrived: number; lastAsked: Record<string, number>;
  // Net pantry contribution (decays daily), gifts by recipient, trees felled but not replanted, pantry gifts this season.
  pantryNet: number; lastGave: Record<string, number>; treeDebt: number; treeDebtSince?: number; seasonGiven: number; lastProposed: number;
  // Life: one year of age passes each season. Children practise what they see and come of age into a role.
  born: number; partner?: string; parents?: string[]; practice?: Partial<Record<ActionKind, number>>; lastCourted?: number;
  // Know-how is personal: 1 means they can do it; below that, how much they have picked up by watching, being shown or failing.
  knows?: Partial<Record<Technique, number>>; tries?: Partial<Record<Technique, number>>;
};
export type WorldEvent = { id: number; minute: number; kind: 'arrival' | 'work' | 'conversation' | 'project' | 'discovery' | 'social' | 'weather' | 'system' | 'trade' | 'nature' | 'civic' | 'life' | 'culture'; title: string; detail: string; actors: string[]; location: Position; observers: string[]; effects?: string; causeIds: number[] };
export type Building = { id: string; name: string; kind: 'home' | 'farm' | 'workshop' | 'market' | 'hall' | 'outpost' | 'place' | 'store'; blocks?: ConstructionBlock[]; namedBy?: string; namedAt?: number; x: number; y: number; w: number; h: number; roof: string; door: Position; capacity?: number; cold?: boolean };
export type Project = { id: string; name: string; description: string; location: Position; requires: Materials; supplied: Materials; labor: number; requiredLabor: number; complete: boolean; contributors: string[]; unlockedDay: number; building?: Building; design?: { blueprint: BlueprintKind; proposedBy: string; eventId: number }; extension?: { building: string; part: PartKind; blocks: ConstructionBlock[]; proposedBy: string; eventId: number } };
export type Materials = { wood: number; stone: number } & Partial<Record<Exclude<BuildGood, 'wood' | 'stone'>, number>>;
export type Region = { id: string; name: string; description: string; x: number; y: number; discovered: boolean; progress: number; required: number };
// Trees, rocks and berry bushes are individual, finite and visible. Felling a tree leaves a stump.
export type NodeKind = 'oak' | 'pine' | 'elder' | 'rock' | 'bush' | 'fish' | 'clay' | 'reeds';
export type ResourceNode = { id: string; kind: NodeKind; x: number; y: number; stage: 'sapling' | 'young' | 'mature' | 'stump' | 'spent'; amount: number; growth: number; region?: string; plantedBy?: string };
export type MarketGood = { price: number; trades: number; volume: number };
export type DayStats = { day: number; season: Season; population: number; pantryFood: number; totalFood: number; trees: number; stumps: number; prices: Partial<Record<Goods, number>>; wealthGini: number; meanWarmth: number; negativeTies: number; strongTies: number; actionVariety: number; trades: number; gifts: number; coldHomes: number; hungry: number; harvest: number; spoiled: number; rules?: number; births?: number; deaths?: number; legends?: number; knowhow?: number; worn?: number };
export type Departure = { id: string; name: string; role: string; color: string; minute: number; reason: string; died?: boolean; age?: number };
export type WorldState = {
  version: 2; seed: number; rng: number; minute: number; sequence: number; weather: Weather; residents: Resident[]; buildings: Building[]; projects: Project[]; regions: Region[];
  stocks: { food: number; preserves: number; wood: number; stone: number }; capacity: number; lastDay: number; lastPaperDay: number; lastVisitorDay: number;
  clubs: { name: string; members: string[]; founded: number }[]; festivals: { day: number; host: string; eventId: number }[];
  nodes: ResourceNode[]; nodeVersion: number; wear: number[]; market: Record<Goods, MarketGood>; farm: { day: number; harvested: number };
  dayActions: Partial<Record<ActionKind, number>>; history: DayStats[]; departed: Departure[];
  norms: Norm[]; proposals: Proposal[]; signals: Partial<Record<NormId, { day: number; text: string }>>;
  // Culture: stories retold often enough become legends; gatherings that recur on the same day become traditions.
  tales: Record<string, Tale>; legends: Legend[]; traditions: Tradition[]; gatherings: Gathering[];
  // How often each kind of event has happened lately. The familiar fades from memory; the new is remembered.
  familiar: Record<string, number>;
  // Who first worked out each technique, and whether anyone living still knows it.
  discoveries: Partial<Record<Technique, { by: string; day: number; lost?: boolean }>>;
};
export type Tale = { eventId: number; text: string; tellers: string[]; retellings: number; lastDay: number };
export type Legend = { eventId: number; title: string; text: string; day: number; tellers: string[]; named: boolean; actors: string[] };
export type Gathering = { day: number; seasonDay: number; season: Season; host: string; attendees: string[]; eventId: number };
export type Tradition = { id: string; name: string; season: Season; seasonDay: number; founded: number; hosts: string[]; kept: number; missed: number; lastKept: number; named: boolean; faded?: boolean; eventIds: number[] };
export type WorldSnapshot = { state: WorldState; serverTime: string; secondsPerSimMinute: number; mode: 'ai' | 'routines'; latestPaper?: NewspaperEntry; recentEvents: WorldEvent[] };
export type NewspaperEntry = { id: number; day: number; createdAt: string; headline: string; dek: string; articles: { title: string; body: string; eventIds: number[]; interpretation: boolean }[]; mode: 'model' | 'event-highlights' };
export type BudgetCategory = 'residents' | 'newspaper' | 'retries';
export type Health = { status: string; uptime: number; mode: string; model: string; decisionModel: string; newspaperModel: string; decisionReady: boolean; lastTick: string; lastAIError: string | null; databaseBytes: number; budget: { monthlyLimit: number; dailyLimit: number; monthSpent: number; daySpent: number; reserved: number; calls: number; byCategory: Record<string, number> }; catalogUpdated: string | null; pendingDecisions: number };
export const DAYS_PER_SEASON = 7;
export const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
// A year of age passes each season.
export const yearsOld = (r: Pick<Resident, 'born' | 'arrived'>, minute: number) => Math.floor((minute - (r.born ?? r.arrived)) / (DAYS_PER_SEASON * 1440));
export const lifeStage = (age: number) => age < 14 ? 'child' : age >= 60 ? 'elder' : 'adult';
export const dayOf = (minute: number) => Math.floor(minute / 1440) + 1;
export const hourOf = (minute: number) => (minute % 1440) / 60;
export const seasonOf = (minute: number): Season => seasons[Math.floor((dayOf(minute) - 1) / DAYS_PER_SEASON) % 4];
export const seasonDay = (minute: number) => (dayOf(minute) - 1) % DAYS_PER_SEASON + 1;
export const yearOf = (minute: number) => Math.floor((dayOf(minute) - 1) / (DAYS_PER_SEASON * 4)) + 1;
export const clockLabel = (minute: number) => `${String(Math.floor(minute % 1440 / 60)).padStart(2, '0')}:${String(Math.floor(minute % 60)).padStart(2, '0')}`;
export const actionLabels: Record<ActionKind, string> = { gather: 'Gathering supplies', farm: 'Tending the fields', cook: 'Cooking a meal', preserve: 'Putting food by', craft: 'Making tools', trade: 'Striking a deal', gift: 'Giving a gift', ask: 'Asking for help', deposit: 'Stocking the pantry', withdraw: 'Drawing from the pantry', plant: 'Planting a tree', socialize: 'Catching up', rest: 'Taking a rest', eat: 'Having a bite', explore: 'Exploring the frontier', build: 'Working on a project', club: 'Meeting with friends', festival: 'Organizing a gathering', promise: 'Making a commitment', share: 'Sharing a story', design: 'Planning a place', name_place: 'Naming a place', extend: 'Planning an addition', propose: 'Proposing a rule', vote: 'Speaking at the oak', court: 'Asking to share a life', play: 'Playing', experiment: 'Trying something new', teach: 'Showing how it is done', repair: 'Making repairs' };
export const goodsLabels: Record<Goods, string> = { food: 'food', preserves: 'preserves', wood: 'wood', stone: 'stone', tools: 'tools', clay: 'clay', reeds: 'reeds', brick: 'brick', pots: 'pots', baskets: 'baskets' };
