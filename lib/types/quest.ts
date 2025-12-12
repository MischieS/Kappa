export type QuestStatus =
  | "locked"
  | "available"
  | "in_progress"
  | "completed";

export type GameEdition =
  | "Standard"
  | "Left Behind"
  | "Prepare for Escape"
  | "Edge of Darkness"
  | "Unheard";

export interface QuestObjectiveSummary {
  id: string;
  description: string;
  requiredCount?: number;
  collectedCount?: number;
  isKeyObjective?: boolean;
  requiresFir?: boolean;
}

export interface Quest {
  id: string;
  title: string;
  trader: string;
  map: string;
  levelRequirement?: number;
  editionRequirement?: GameEdition;
  status: QuestStatus;
  objectivesCompleted: number;
  objectivesTotal: number;
  reputationReward: number;
  experienceReward: number;
  kappaRequired: boolean;
  requiredKeys?: string[];
  requirementTags?: ("marker" | "jammer" | "camera" | "item")[];
  lightkeeperRequired?: boolean;
  requiredItemsFir?: string[];
  requiredItemsNonFir?: string[];
  requiredEquipment?: string[];
  objectives?: QuestObjectiveSummary[];
  wikiLink?: string;
  taskImageLink?: string;
  mapWikiLink?: string;
  previousQuestIds?: string[];
  nextQuestIds?: string[];
  requiredPrestige?: number;
  requiredTraderLevels?: { traderName: string; loyaltyLevel: number }[];
  lockReasons?: string[];
}
