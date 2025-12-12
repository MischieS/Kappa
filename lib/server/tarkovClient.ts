import fs from 'fs/promises';
import path from 'path';

const TARKOV_GRAPHQL_ENDPOINT = 'https://api.tarkov.dev/graphql';
const REF_CACHE_DIR = process.env.REF_CACHE_DIR
  ? path.resolve(process.env.REF_CACHE_DIR)
  : path.join(process.cwd(), 'lib', 'ref-cache');

async function ensureCacheDir() {
  await fs.mkdir(REF_CACHE_DIR, { recursive: true }).catch(() => undefined);
}

async function readRefCache<T>(fileName: string): Promise<T | null> {
  try {
    const fullPath = path.join(REF_CACHE_DIR, fileName);
    const raw = await fs.readFile(fullPath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeRefCache(fileName: string, data: unknown): Promise<void> {
  try {
    await ensureCacheDir();
    const fullPath = path.join(REF_CACHE_DIR, fileName);
    await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // cache failures should not break the request path
  }
}

async function fetchGraphQL(query: string, variables?: Record<string, unknown>): Promise<any> {
  const response = await fetch(TARKOV_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store', // Disable Next.js cache to avoid 2MB limit errors
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || !json) {
    throw new Error('Tarkov.dev request failed');
  }

  return json;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function getCachedOrFetch<T>(
  fileName: string,
  fetchFn: () => Promise<T>,
  ttl: number = CACHE_TTL
): Promise<T> {
  try {
    const fullPath = path.join(REF_CACHE_DIR, fileName);
    const stats = await fs.stat(fullPath).catch(() => null);
    
    // If cache exists and is fresh
    if (stats && (Date.now() - stats.mtimeMs < ttl)) {
      const cached = await readRefCache<T>(fileName);
      if (cached) return cached;
    }
  } catch (e) {
    // Ignore cache read errors, proceed to fetch
  }

  try {
    const data = await fetchFn();
    await writeRefCache(fileName, data);
    return data;
  } catch (error) {
    console.error(`Failed to fetch fresh data for ${fileName}, trying fallback to stale cache.`, error);
    // Fallback to stale cache if fetch fails
    const cached = await readRefCache<T>(fileName);
    if (cached) return cached;
    throw error;
  }
}

const TASKS_REF_QUERY = `
  query TasksRef {
    tasks {
      id
      name
      kappaRequired
      lightkeeperRequired
      minPlayerLevel
      requiredPrestige {
        prestigeLevel
      }
      trader {
        name
      }
      map {
        id
        name
        normalizedName
      }
      taskRequirements {
        task {
          id
          name
        }
        status
      }
      objectives {
        id
        type
        description
        maps {
          id
          name
          normalizedName
        }
        ... on TaskObjectiveItem {
          items {
            id
            name
            shortName
            iconLink
            wikiLink
          }
          count
          foundInRaid
        }
        ... on TaskObjectiveQuestItem {
          questItem {
            id
            name
            shortName
          }
          count
        }
        ... on TaskObjectiveMark {
           markerItem {
             id
             name
             shortName
           }
        }
        ... on TaskObjectiveBasic {
          requiredKeys {
             id
             name
             shortName
             iconLink
             wikiLink
          }
        }
        ... on TaskObjectiveExtract {
           requiredKeys {
             id
             name
             shortName
             iconLink
             wikiLink
          }
        }
        ... on TaskObjectiveItem {
           requiredKeys {
             id
             name
             shortName
             iconLink
             wikiLink
          }
        }
        ... on TaskObjectiveZone {
          zone {
            id
            name
            position {
              x
              y
              z
            }
            map {
              id
              name
              normalizedName
            }
          }
        }
        ... on TaskObjectiveMark {
           requiredKeys {
             id
             name
             shortName
             iconLink
             wikiLink
          }
        }
        ... on TaskObjectiveQuestItem {
           requiredKeys {
             id
             name
             shortName
             iconLink
             wikiLink
          }
        }
        ... on TaskObjectiveShoot {
           requiredKeys {
             id
             name
             shortName
             iconLink
             wikiLink
          }
        }
        ... on TaskObjectiveUseItem {
           requiredKeys {
             id
             name
             shortName
             iconLink
             wikiLink
          }
        }
      }
    }
  }
`;

const HIDEOUT_STATIONS_REF_QUERY = `
  query HideoutStationsRef {
    hideoutStations {
      id
      name
      normalizedName
      levels {
        id
        level
        itemRequirements {
          count
          quantity
          attributes {
            type
            name
            value
          }
          item {
            id
            name
            shortName
            iconLink
            wikiLink
          }
        }
        stationLevelRequirements {
          id
          level
          station {
            id
            name
          }
        }
        skillRequirements {
          id
          name
          level
        }
        traderRequirements {
          id
          requirementType
          compareMethod
          value
          trader {
            name
          }
        }
      }
    }
  }
`;

export async function getTasksRef(): Promise<any[]> {
  return getCachedOrFetch('tasks.json', async () => {
    const result = await fetchGraphQL(TASKS_REF_QUERY);
    const tasksField = (result as any)?.data?.tasks;
    return Array.isArray(tasksField) ? tasksField : [];
  });
}

export async function getHideoutStationsRef(): Promise<any[]> {
  return getCachedOrFetch('hideoutStations.json', async () => {
    const result = await fetchGraphQL(HIDEOUT_STATIONS_REF_QUERY);
    let stationsField: any = (result as any)?.data?.hideoutStations;

    if (!Array.isArray(stationsField)) {
      if (Array.isArray(stationsField?.nodes)) {
        stationsField = stationsField.nodes;
      } else if (Array.isArray(stationsField?.edges)) {
        stationsField = stationsField.edges.map((edge: any) => edge?.node).filter(Boolean);
      }
    }

    return Array.isArray(stationsField) ? stationsField : [];
  });
}

const MAPS_REF_QUERY = `
  query TarkovDevMaps {
    maps(lang: en, gameMode: regular) {
      id
      tarkovDataId
      name
      normalizedName
      wiki
      description
      enemies
      raidDuration
      players
      bosses {
        name
        normalizedName
        spawnChance
        spawnLocations {
          spawnKey
          name
          chance
        }
        escorts {
          name
          normalizedName
          amount {
            count
            chance
          }
        }
        spawnTime
        spawnTimeRandom
        spawnTrigger
        switch {
          id
        }
      }
      spawns {
        zoneName
        position {
          x
          y
          z
        }
        sides
        categories
      }
      extracts {
        id
        name
        faction
        position {
          x
          y
          z
        }
        outline {
          x
          y
          z
        }
        top
        bottom
        switches {
          id
          name
        }
        transferItem {
          item {
            name
            normalizedName
            baseImageLink
          }
          count
        }
      }
      transits {
        id
        description
        conditions
        position {
          x
          y
          z
        }
        outline {
          x
          y
          z
        }
        top
        bottom
      }
      locks {
        lockType
        key {
          id
        }
        needsPower
        position {
          x
          y
          z
        }
        outline {
          x
          y
          z
        }
        top
        bottom
      }
      hazards {
        hazardType
        name
        position {
          x
          y
          z
        }
        outline {
          x
          y
          z
        }
        top
        bottom
      }
      lootContainers {
        lootContainer {
          id
          name
          normalizedName
        }
        position {
          x
          y
          z
        }
      }
      lootLoose {
        items {
          id
        }
        position {
          x
          y
          z
        }
      }
      switches {
        id
        name
        switchType
        activatedBy {
          id
          name
        }
        activates {
          operation
          target {
            __typename
            ... on MapSwitch {
              id
              name
            }
            ... on MapExtract {
              id
              name
              faction
            }
          }
        }
        position {
          x
          y
          z
        }
      }
      stationaryWeapons {
        stationaryWeapon {
          name
          shortName
        }
        position {
          x
          y
          z
        }
      }
      artillery {
        zones {
          position {
            x
            y
            z
          }
          outline {
            x
            y
            z
          }
          top
          bottom
        }
      }
      btrStops {
        name
        x
        y
        z
      }
    }
  }
`;

export async function getMapsRef(): Promise<any[]> {
  return getCachedOrFetch('maps.json', async () => {
    const result = await fetchGraphQL(MAPS_REF_QUERY);
    return (result as any)?.data?.maps || [];
  });
}
