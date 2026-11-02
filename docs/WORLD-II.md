# Little Elsewhere II: systems and tuning

Started 25 September 2026. The first town ran Days 1–14 and is archived at `data/archive/little-elsewhere-I-day14.sqlite` (code snapshot alongside). Its Day 14 state showed why a new world was needed: an 808-food pantry, residents holding hundreds of spare food and stone, coins that never moved, an average warmth of 50 with 2 of 236 ties negative, and five resident-built places that were all hearths. Nothing could go wrong, so little happened.

World II keeps the architecture (server-owned rules, Jev choosing among legal actions, evidence-backed events) and changes what the rules make possible.

## The loops that create pressure

| Loop | Mechanism | What it can produce |
|---|---|---|
| Seasons | 7-day seasons; fields yield 12/18/26/0 food per day in spring/summer/autumn/winter; berries regrow 1/1/1/0 per bush; fishing 2 per spot per day all year | Autumn rush, lean winters, preserving and stockpiling |
| Spoilage | Personal fresh food loses 8/12/8/3% a day; the pantry half that; preserves 1% | A reason to share surplus or preserve it; hoards visibly shrink |
| Firewood | Homes burn ½ wood per resident per autumn night and 1 per winter night; whoever holds most wood feeds the fire first; otherwise the home goes cold and rest recovers 35 instead of 65 | Household cooperation, wood prices peaking in winter, resentment of free riders |
| Finite nature | Individual trees (12 wood; elders 20), rocks, bushes and fishing spots; stumps can be replanted; saplings take about a week of growing season to mature | Clearings near the village, walks lengthening, conflict between people who value the forest and people who need timber |
| Prices | Valuation = base × season × need × role; trade only where bid ≥ ask; buyers buy only what they need (traders up to double); going rate is a moving average | Price spikes, traders accumulating coin, bargains and overcharges |
| Deeds and values | Observers judge actors through their own nature/sharing/industry values; gossip carries half strength; warmth fades 2.5% a day; chat alone saturates near 70 | Factions around the forest, reputations for generosity or stinginess, estrangement |
| Hunger | Four consecutive days hungry with no food means departure; hungry residents resent well-stocked neighbors nearby | Real stakes; overshoot and loss after population growth |
| Worn paths | Each step wears grass; worn grass is cheaper to walk; wear decays 15% a day | Desire lines that reflect actual routines |

## Balance, measured

Routine-only runs (`scripts/simulate.ts`, two in-game years, seeds 4217, 99 and 31337) diverge. All three grow to 24 residents; in seed 4217 the second winter runs the village's food down to 2, while the others end it with 350–470 in store. Mature trees cycle between about 230 in late winter and 330 in summer. Wealth Gini ranges 0.23–0.47 and average warmth 15–21, with strained ties (up to 28) and strong ties (up to 8) both present. No one departed within two years in these runs, though seed 4217 was days from it. Jev-driven residents will behave differently from routines; watch the Village pulse card. 

Three balance failures were found and fixed while tuning, and they are worth knowing:

1. **Idle busywork.** When nothing scored well, the least-bad action won, which was often felling trees to fill the pantry. Idle residents now seek company or take it easy at home.
2. **A phantom supply chain.** Carpenters valued wood highly and bought it without limit; gatherers felled trees to sell to them; carpenters deposited the surplus. Buyers now stop at what they need.
3. **Idle cooking.** Cooking required no hunger and burned a food and a wood each time. It now requires real hunger.

## Tuning knobs

- `src/server/nature.ts` → `seasonal`: growth, yields, farm capacity, spoilage, firewood and weather by season; `nodeYield`; habitat densities in `habitat()`.
- `src/server/economy.ts` → `basePrice`, `seasonalDemand`, `roleNeeds`, `comfort()` (how much people want on hand), `margin()`.
- `src/server/society.ts` → `traitValues`, `roleValues`, `conversationWarmth`, `fadeRelationships`.
- `src/server/world.ts` → `routine()` scores (fallback behavior and the routine-only mode), deed magnitudes in `finishAction`, departure threshold and newcomer rule in `newDay`.
- `src/shared/map.ts` → layout: roads, buildings and doors, plots, frontier sites, river curve.

Always rerun `node --import tsx scripts/simulate.ts 56 <seed>` for two or three seeds after changing a number, and `npm test`.

## Developer tools

- `scripts/simulate.ts [days] [seed]` – fast routine-only run printing daily signals and action mixes.
- `scripts/map-preview.ts` – ASCII map with scenery, doors and plots.
- `scripts/preview-world.ts <db> <day> <hour>` – builds a throwaway world at any season and hour to look at in the browser (run the server with `DATABASE_PATH` pointing at it and an empty `OPENROUTER_API_KEY`).
- `scripts/new-world.ts [archive-name]` – with the server stopped, archives the current world and prepares an empty database, carrying this month's inference ledger so the budget cap keeps counting.

## Phase 2: parts and rules (added Day 5, 26 September 2026)

The live world ran four in-game days under Jev before phase 2, and showed four problems that were fixed alongside it:

1. **Stone hoarding.** Jev kept choosing to quarry; one resident carried 133 stone while a frontier cottage waited for 13. Residents now carry at most 30 wood and stone together, and each build trip delivers up to 6 of each instead of 3.
2. **Laundering through the pantry.** Withdrawing food, preserving it and depositing the preserves earned a generosity deed every cycle. Deposits now credit only a resident's net contribution (which fades 10% a day), and food counts as spare only well above the point where a resident would draw from the pantry again.
3. **Gift inflation.** Warmth reached 97 within four days. A gift's warmth now shrinks as a friendship deepens, the recipient no longer also judges the gift as a witness, and one resident cannot gift the same neighbor twice within twelve hours. Admiration from any deed has diminishing returns.
4. **Opaque options.** Jev saw bare words like `farm`. Every option now carries its concrete effect: yield left today, batch size, tool cost, whether home is cold, how much the resident already carries, and whether it breaks a village rule.

**Parts.** `src/shared/construction.ts` defines ten element kinds and eight parts with fixed cells in the 4×4 footprint, so any combination fits. `placeCapabilities` derives uses from completed kinds only; an unfinished addition changes nothing. `extensionParts` enforces the three-furnishing room limit. Additions are separate projects (`project.extension`) whose blocks join the building on completion; at most two run at once, one per place, and each resident sees only the three the village most needs (`partNeed`). Capacity is recounted from homes and beds (`recountCapacity`), capped at 24.

**Rules.** `src/shared/norms.ts` lists the seven rules with the values they express. `src/server/civics.ts` holds proposals, votes, resolution and breaches. A proposal needs recent evidence (`w.signals`, set when a relevant incident happens) and a resident whose values favor it. Only one proposal is open at a time, with two days between proposals; a rule that failed waits five days, a dropped rule seven, and a repeal needs seven days in force and three breaches. A rule passes with more voices for than against and at least a quarter of the village (minimum three) for it. Voting is itself a judged deed, and losing voters cool slightly toward the proposer. `wouldBreach` flags actions in Jev's option text and in routine scoring. Breaches (`breach`) are judged by the deed's values plus −3 from supporters, −1.5 from those who did not vote and −0.5 from opponents, at most once per person, rule and day.

Measured with `scripts/simulate.ts 56` on seeds 4217, 99 and 31337:
- Food at the end of the second winter is 158, 458 and 639.
- Every seed adopted spare-the-elders, replant and fair-prices.
- The seasonal rest day was proposed, adopted, dropped and re-proposed as industrious and easygoing residents disagreed.
- Replanting is broken most often (about 45 times in 34 days), mostly by winter firewood cutters; felling in winter is forgiven until the second day of spring.
- About 400–500 civic events in 56 days, versus 1,700 before throttling.

Tuning knobs: `canPropose` and `resolve` in `civics.ts` (gaps, quorum), `normBook` tags, the breach weights in `society.judge`, `partNeed` and `FURNISHING_ROOM`, `seasonal.gardenYield`, `CARRY` in `economy.ts`, and the larder cap in `newDay`.

## Phase 3: lives and culture (added Day 9, 27 September 2026)

**What the live world showed first.** By Day 9 the village had drifted toward universal friendship: average warmth 30 and rising, no negative ties at all, 22 very strong ones. Population sat at 12 because residents kept their food privately as preserves and the pantry could not meet the newcomer threshold. A crash in the new civic dialogue (a vote has no conversation partner) made the engine retry the same paid decision every two seconds; the daily cap held spending to one day's $0.67. The crash is fixed, and the engine now defers any resident whose decision fails after a paid call.

**Friction from values, not scripts.** The old hardcoded clashes (protective versus carpenter, impatient versus stubborn) are gone. Any conversation between people whose values differ can turn into a disagreement, more often the further apart they are, and the event names what they disagreed about. People who think alike bond a little faster. Relationships also keep a `balance` of goods given each way: a refusal from someone you have given a lot to hurts twice as much, someone in your debt is likelier to help, and generosity that is never returned turns into resentment for those who do not value giving for its own sake.

**Life stages** (`src/server/life.ts`). A year of age passes each season. Founders and newcomers arrive aged 20 to 64 (derived from their id), so some are already elders.
- **Partnership.** Adults who care deeply for each other can ask to become partners. The answer depends on the other person's feelings and how alike they are. Anyone who quietly hoped for one of them feels a pang. Partners move in together when there is room, and part ways if warmth between them wears thin.
- **Children.** A couple under fifty, with room for children in one of their homes, food in the house and a mild season, may have a child. Children share their parents' rooms (up to three per home), so births do not compete with newcomers for beds, and they are spaced at least two seasons apart.
- **Growing up.** Children start with values between their parents' and drift toward whoever they spend time with. They help with light work (mostly whatever their parents do), play, eat from the household, and never cost an inference call. At fourteen they come of age into a role chosen from what they practised and what they value.
- **Old age and death.** Elders tire faster and gather less. Their daily chance of dying rises gently after sixty and sharply with hunger. The dead are mourned by those who cared for them, and what they owned passes to a partner, children or the closest friend.

**Culture** (`src/server/culture.ts`).
- **Legends.** A story becomes a legend when it has been retold eight times by four different people, and only if it was about people (a deed, a life event, a quarrel, a discovery) and mattered when it happened. People retell the most striking stories, and those already going around, so legends snowball.
- **Traditions.** A tradition takes root when someone who attended a gathering hosts one on the same day of the same season a year later; there is at most one per season. Residents are reminded when a year has passed since a gathering, so repeating it is a choice. A tradition missed two years running fades.
- **Naming.** The language model names each legend and tradition once, with a plain fallback.

Measured with `scripts/simulate.ts 112` on seeds 4217, 99 and 31337:
- **Seed 4217** has lean winters: two adults left hungry, six elders died, and two of four traditions faded.
- **Seeds 99 and 31337** prospered, with 1 to 7 children depending on housing and couples, and traditions kept every year.
- **Relationships:** average warmth is 12–24 with 13–67 strained ties, instead of a flat climb.

Tuning knobs: `ADULT_AGE`, `ELDER_AGE` and `deathChance` in `life.ts`; the birth conditions in `newDay`; `LEGEND_RETELLINGS`, `LEGEND_TELLERS` and `LEGEND_IMPORTANCE` in `culture.ts`; the clash curve in the `socialize` branch of `finishAction`; the balance thresholds in `newDay` and `willingness`.

## Phase 4: making (added Day 23, 1 October 2026)

**What the live world showed first.** By Day 23 both legends were "X made a promise", and residents mostly retold promises to each other. The cause was mechanical. A promise event had a fixed importance of 9, storytellers always chose their most important memory, and around 55 near-identical promises crowded out everything else. Listeners were also told stories they already knew. The pantry held 1,176 wood and no food, because depositing wood still earned admiration however full the pantry was. All eight building plots had been claimed in the first week.

**Stories from surprise, not from a list.** Nothing says which events are interesting.
- **Novelty.** Each event gets a signature: its kind and title, with names and numbers removed (`signature` in `world.ts`). The more often that signature has happened lately (`w.familiar`, fading 3% a day), the less it stays with the people who saw it (`felt`). The first of anything is remembered at full weight; the fiftieth promise hardly at all. Things that stop happening become news again.
- **Stakes.** People remember more of what happens to themselves and to those they feel strongly about, liked or disliked (`stakeIn`).
- **Hearsay.** A heard story starts one point below the teller's sense of it, plus the listener's own stake, so only striking stories survive many retellings.
- **Choosing what to tell.** People prefer news the listener has not heard and stories about people they feel strongly about. A story retold more than about a dozen times starts to go stale (`storyWeight` in `dialogue.ts`).
- **Pantry gifts.** These earn credit only as far as the pantry needs them.

**Materials.** Clay pits on the village riverbank and reed beds around the pond and bank (`wetlandNodes` in `nature.ts`). Reeds regrow through the growing season. Clay pits refill in spring and on rainy days. New goods: clay, reeds, brick, pots and baskets. Clay, reeds and brick count toward what a person can carry. Demand for them comes only from people who can use them: builders with projects waiting, or makers who know how (`comfort`).

**Know-how** (`src/shared/making.ts`). There are three techniques: firing clay, weaving reeds, and wattle and daub. Nobody starts knowing them; some newcomers bring one from elsewhere.
- **Working it out.** Anyone holding the materials can experiment (`experiment`). It usually fails, and each failure uses up the materials. Watching someone at work, earlier failures and a tinkering temperament all raise the chance of success.
- **Records.** The first success is a discovery with an importance of 8, and `w.discoveries` records who and when. Later independent successes are smaller news.
- **Teaching.** Know-how travels by being watched or taught. A lesson is shown with real materials, which are used up, and usually takes three or four sessions. It is judged as generosity and earns the learner's gratitude. Residents' option text says when they are the only one who knows something, so keeping a skill to yourself is a live choice.
- **Loss.** When the last person who knew a technique dies or leaves, the village is told no one remembers how. A later success is recorded as a rediscovery.

**Making** (`recipes`). The know-how gates these recipes:
- **Tools:** as before.
- **Brick:** 2 clay and 2 wood make 2 brick (firing).
- **Pots:** 2 clay and 1 wood make 1 pot (firing). Each pot keeps five fresh food from spoiling, and pots crack slowly.
- **Baskets:** 3 reeds make 1 basket (weaving). A basket adds one food per picking, fishing or harvesting trip and wears out.

A **kiln** is a new furnishing and a kiln yard is a new blueprint, both needing someone who knows firing. A kiln fires twice the clay on the same wood.

**Building methods** (`methods` in `shared/construction.ts`). A place can be planned in one of three methods; anything a method does not cover stays timber.
- **Timber and stone.** Walls and roof as before.
- **Wattle, daub and thatch.** Daub walls and a thatched roof. Planning it needs daubing.
- **Fired brick.** Brick walls, a tiled roof and a brick hearth. Planning it needs firing.

Each material differs in cost, warmth and weathering (`materialTraits`):

| Material | Warmth (firewood saved) | Wear per day (extra on rain or snow) |
|---|---|---|
| Timber | 10% | 0.010 (+0.006) |
| Stone | 15% | 0.002 |
| Daub | 30% | 0.012 (+0.020) |
| Thatch | 35% | 0.020 (+0.015) |
| Brick | 40% | 0.0015 |

Building in daub teaches the builders and onlookers a little daubing.

**Weathering and repair.** Walls and roofs wear daily, and wet days are worse. A wall or roof that wears through no longer counts, so a leaking roof costs a place its rest and home uses, and a leaking home is cold. When something fails, the people who live there and the place's namer are told.
- **Patching** a worn section takes one unit of its own material.
- **Rebuilding** it in another method the resident knows costs a whole new block. Re-roofing a timber roof in thatch or tile is how places change material once the plots are full. Routine villages end up with patchwork roofs.
- **Credit.** Repairing someone else's place is judged as generous.

Firewood for resident-built homes is scaled by warmth and rounded by chance, so small households still feel the difference.

Measured with `scripts/simulate.ts 112` on seeds 4217, 99 and 31337:
- **Legends** are now partnerships, births, deaths and gatherings, plus discoveries ("Jun worked out wattle and daub"), lessons ("Bea taught Sage firing clay") and re-roofings ("Sol re-roofed Moss's Larder in thatch"). Promises appear rarely. The most-retold story reaches 50–70 retellings instead of about 300.
- **Discovery.** Firing, weaving and daubing are first worked out between days 1 and 8.
- **Spread.** By day 112 the share who know firing ranges from 8 of 22 residents to 21 of 26.
- **Repair.** About 26–29 patch or rebuild jobs happen per run. Routine villages patch before anything wears through; under Jev that may not hold.
- **Stability.** Food, population and wealth are close to phase 3. One hungry departure occurred in seed 4217, the lean seed.

Tuning knobs:
- **Novelty:** `felt` and `novelty` in `world.ts`, and the 0.97 fade in `newDay`.
- **Storytelling:** `storyWeight` in `dialogue.ts`.
- **Discovery and teaching:** the experiment odds and the teaching increment in `finishAction`, plus `watch`.
- **Materials:** `materialTraits`, `variantCosts` and `methods` in `shared/construction.ts`; `recipes` and `POT_KEEPS` in `making.ts`; `wetlandNodes` and `reedRegrowth` in `nature.ts`.

**Migration.** `migrate` adds clay and reeds, new goods, market entries and empty know-how. It rebuilds familiarity from what residents remember, matching old memories by title when they predate event kinds, and settles everyday memories to the weight they would have had. Existing walls and roofs start with the wear their age implies.

## Next

**Still open from earlier phases:**
- A procedural frontier: caravans and visitors from elsewhere who buy the village's surplus and bring news, strangers and know-how. More building plots as the map grows.
- Recipes with distinct ingredients.
- Grown children building their own homes.

**New, from Phase 4:**
- Residents keep food privately as preserves, so the pantry's food runs dry, which stops newcomers arriving (the live world has sat at 12 since Day 9).
- Know-how could be traded for coin as well as taught.
- A village rule about who maintains shared places.
