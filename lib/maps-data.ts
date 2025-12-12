
export interface MapLocation {
  id: string;
  name: string;
  x: number;
  y: number;
  type: "quest" | "extract" | "spawn" | "loot";
  description?: string;
  questId?: string;
}

export interface GameMap {
  id: string;
  name: string;
  tarkovMapId: string;
  description: string;
  imageUrl: string;
  width: number;
  height: number;
  players: string;
  duration: string;
  locations: MapLocation[];
}

export const MAPS: GameMap[] = [
  {
    id: "customs",
    name: "Customs",
    tarkovMapId: "customs",
    description: "Industrial area of Tarkov.",
    imageUrl: "/maps/customs.webp",
    width: 4096,
    height: 2623,
    players: "8-12",
    duration: "40 min",
    locations: [
      { id: "c1", name: "Dorm Room 206", x: 300, y: 250, type: "quest", description: "Operation Aquarius Part 1", questId: "aquarius1" },
      { id: "c2", name: "Crossroads Extract", x: 50, y: 300, type: "extract", description: "Always Open" },
      { id: "c3", name: "Big Red", x: 150, y: 200, type: "loot", description: "Director's Office Key needed" }
    ]
  },
  {
    id: "woods",
    name: "Woods",
    tarkovMapId: "woods",
    description: "Forest area with a sawmill.",
    imageUrl: "/maps/woods.webp",
    width: 1000,
    height: 1000,
    players: "8-14",
    duration: "45 min",
    locations: []
  },
  {
    id: "factory",
    name: "Factory",
    tarkovMapId: "factory",
    description: "Small industrial factory.",
    imageUrl: "/maps/factory.webp",
    width: 4096,
    height: 2028,
    players: "4-6",
    duration: "20 min",
    locations: []
  },
  {
    id: "interchange",
    name: "Interchange",
    tarkovMapId: "interchange",
    description: "Large shopping mall.",
    imageUrl: "/maps/interchange.webp",
    width: 4096,
    height: 2304,
    players: "10-14",
    duration: "45 min",
    locations: []
  },
  {
    id: "reserve",
    name: "Reserve",
    tarkovMapId: "reserve",
    description: "Military base.",
    imageUrl: "/maps/reserve.webp",
    width: 4096,
    height: 2304,
    players: "9-12",
    duration: "40 min",
    locations: []
  },
  {
    id: "shoreline",
    name: "Shoreline",
    tarkovMapId: "shoreline",
    description: "Coastal area with a health resort.",
    imageUrl: "/maps/shoreline.webp",
    width: 4096,
    height: 1943,
    players: "10-13",
    duration: "45 min",
    locations: []
  },
  {
    id: "lighthouse",
    name: "Lighthouse",
    tarkovMapId: "lighthouse",
    description: "Coastal lighthouse area.",
    imageUrl: "/maps/lighthouse.webp",
    width: 4096,
    height: 2644,
    difficulty: "Hard",
    players: "9-12",
    duration: "40 min",
    locations: []
  },
   {
    id: "streets",
    name: "Streets of Tarkov",
    tarkovMapId: "streets-of-tarkov",
    description: "Downtown city center.",
    imageUrl: "/maps/streets.webp",
    width: 4096,
    height: 3405,
    players: "12-16",
    duration: "50 min",
    locations: []
  },
    {
    id: "ground_zero",
    name: "Ground Zero",
    tarkovMapId: "ground-zero",
    description: "Starter map for beginners.",
    imageUrl: "/maps/groundzero.webp",
    width: 2092,
    height: 2160,
    players: "10-12",
    duration: "45 min",
    locations: []
  }
];
