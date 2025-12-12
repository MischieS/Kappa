export interface Trader {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  reputation: number;
  reputationRequiredForNextLevel: number;
  kappaRequired: boolean;
}
