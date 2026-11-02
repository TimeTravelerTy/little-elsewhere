import { capabilityLabels, placeCapabilities } from './construction';
import type { Building, Position, WorldState } from './types';

export const buildingUses: Record<Building['kind'], string> = {
  place: 'A place assembled and named by residents.',
  home: 'A shared home where residents return to rest and recover energy.',
  farm: 'Fields that yield most in autumn and nothing in winter. Each day they can only give so much.',
  workshop: 'Residents make tools, cook meals and put food by as preserves here.',
  market: 'Where the village keeps an eye on prices. Residents trade goods for coins at whatever price both sides accept.',
  store: 'The shared pantry. Anyone can add to it or draw from it; neighbors notice who does which. Food keeps longer here than at home.',
  hall: 'The village gathering place for clubs and festivals. Festivals share food from the pantry.',
  outpost: 'A frontier shelter that provides room for newcomers.',
};
export type Place = {
  id: string; name: string; kind: string; description: string; position: Position;
  building?: Building; project?: WorldState['projects'][number];
};
// Derive identity from saved records; old worlds need no migration or invented history.
export function worldPlaces(world: WorldState): Place[] {
  return [
    ...world.buildings.map(building => ({
      id: `building:${building.id}`, name: building.name, kind: building.kind,
      description: building.kind === 'place' ? `Built by neighbors. ${placeCapabilities(building).map(c => capabilityLabels[c]).join(' · ')}.` : buildingUses[building.kind], position: building.kind === 'farm' || building.kind === 'hall' ? { x: building.x + building.w / 2, y: building.y + building.h / 2 } : { x: building.door.x + .5, y: building.door.y },
      building, project: world.projects.find(project => project.complete && project.building?.id === building.id),
    })),
    ...world.projects.filter(project => !project.extension && (!project.complete || !project.building)).map(project => ({
      id: `project:${project.id}`, name: project.name, kind: project.complete ? 'Landmark' : 'Construction site',
      description: project.description, position: project.location, project,
    })),
  ];
}
