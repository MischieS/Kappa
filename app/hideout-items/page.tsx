import HideoutItemsClient from "./HideoutItemsClient";
import { getHideoutStationsRef } from "@/lib/server/tarkovClient";
import { cookies } from "next/headers";
import { getUserById } from "@/lib/repository/userRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TraderStandingSummary {
  traderId: string;
  level: number;
}

export default async function HideoutItemsPage() {
  let initialStations: any[] | undefined;
  let initialTraderStandings: TraderStandingSummary[] | null = null;

  let user: any = null;

  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (userId) {
      user = await getUserById(userId);
    }
  } catch (error) {
    console.error("Failed to load hideout user on server", error);
  }

  if (user && Array.isArray(user.traderStandings)) {
    initialTraderStandings = user.traderStandings
      .filter((entry: any) => entry && entry.traderId)
      .map((entry: any) => ({
        traderId: String(entry.traderId),
        level: Number(entry.level ?? 1) || 1,
      }));
  }

  try {
    const stations = await getHideoutStationsRef();
    if (Array.isArray(stations) && stations.length > 0) {
      initialStations = stations as any[];
    }
  } catch (error) {
    console.error("Failed to load hideout stations ref on server", error);
  }

  return (
    <HideoutItemsClient
      initialStations={initialStations}
      initialTraderStandings={initialTraderStandings}
    />
  );
}
