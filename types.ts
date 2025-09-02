export enum GamePhase {
  LORE_CREATION,
  SCENARIO_CREATION,
  GAMEPLAY,
}

export interface Faction {
  name: string;
  description: string;
  leader: string;
  headquarters: string;
  ideology: string;
  relationships: string;
  sigilImageUrl: string;
}

export interface TimelineEvent {
  era: string;
  description:string;
}

export interface Lore {
  worldName: string;
  coreConcept: string;
  factions: Faction[];
  timeline: TimelineEvent[];
  locations: { name: string; description: string; }[];
  characters: { name: string; description: string; }[];
  knowledge: string[];
  secrets: { title: string; description: string; }[];

  // Expanded lore
  cosmology: {
    creationMyth: string;
    deities: {
      name: string;
      domain: string;
      description: string;
    }[];
  };
  magicSystem: {
    name: string;
    description: string;
    rules: string[];
  };
  races: {
    name: string;
    description: string;
    abilities: string;
  }[];
  creatures: {
    name: string;
    description: string;
    habitat: string;
  }[];
  historicalFigures: {
    name: string;
    description: string;
    significance: string;
  }[];
}

export interface Character {
  name: string;
  backstory: string;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  level: number;
  xp: number;
  xpToNextLevel: number;
}

export interface Setting {
  name: string;
  description: string;
}

export interface Scenario {
  character: Character;
  setting: Setting;
  goal: string;
  objective: string; // The first actionable step
}

export interface Objective {
  text: string;
  isCompleted: boolean;
  subObjectives?: Objective[];
}

export interface Quest {
  title: string;
  description: string;
  status: 'active' | 'completed' | 'failed';
  objectives: Objective[];
}

export type ItemRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
export type ItemType = 'Consumable' | 'Quest Item' | 'Equipment' | 'Tome';

export interface ItemEffect {
    stat: 'health' | 'mana' | 'stamina';
    value: number;
}

export interface Item {
    name: string;
    description: string;
    rarity: ItemRarity;
    type: ItemType;
    usable: boolean;
    effects: ItemEffect[];
}

export interface GameState {
  lore: Lore;
  scenario: Scenario;
  inventory: Item[];
  currentLocation: string;
  storyLog: StoryEntry[];
  objective: string; // Main quest's current objective
  quests: Quest[]; // Side quests
  isGameOver: boolean;
  gameOverMessage: string;
}

export interface StoryEntry {
    type: 'player' | 'narrator';
    text: string;
    characterName?: string; // For NPC dialogue
    imageUrl?: string;
    imageIsLoading?: boolean;
}

export interface GeminiResponse {
  narrative: string;
  dialogue?: { characterName: string; text: string }[];
  newLocation: string;
  updatedInventory: Item[];
  newObjective: string; // For main quest
  newQuest?: Quest; // For new side quests
  questUpdate?: { // For updating side quests
    questTitle: string;
    objectiveText: string;
    newStatus?: 'completed' | 'failed';
  };
  isGameOver: boolean;
  gameOverMessage: string;
  characterUpdate?: {
    health?: number;
    mana?: number;
    stamina?: number;
    xpGained?: number;
  };
  loreUpdate?: {
    type: 'location' | 'character' | 'knowledge';
    name: string;
    description: string;
  };
  requestImageGeneration?: boolean;
}