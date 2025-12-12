import { NextRequest, NextResponse } from "next/server";

const HIDEOUT_ITEMS_QUERY = `
  query HideoutItems {
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

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  try {
    const response = await fetch("https://api.tarkov.dev/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: HIDEOUT_ITEMS_QUERY }),
      next: { revalidate: 60 * 60 },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result) {
      return NextResponse.json({ error: "Failed to load hideout data from tarkov.dev" }, { status: 502 });
    }

    const data: any = (result as any).data ?? result;
    let stationsField: any = data?.hideoutStations;

    if (!Array.isArray(stationsField)) {
      if (Array.isArray(stationsField?.nodes)) {
        stationsField = stationsField.nodes;
      } else if (Array.isArray(stationsField?.edges)) {
        stationsField = stationsField.edges.map((edge: any) => edge?.node).filter(Boolean);
      }
    }

    const stations = Array.isArray(stationsField) ? stationsField : [];

    return NextResponse.json({ stations });
  } catch (error) {
    console.error("Failed to load hideout stations", error);
    return NextResponse.json({ error: "Failed to load hideout data" }, { status: 500 });
  }
}
