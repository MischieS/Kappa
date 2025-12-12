export type ItemRarity = "common" | "rare" | "epic" | "legendary";

export interface Item {
  id: string;
  name: string;
  category: string;
  rarity: ItemRarity;
  neededForKappa: boolean;
  quantityRequired: number;
  quantityOwned: number;
  foundInRaid: boolean;
}
