import { NextResponse } from "next/server";

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function extractFirItemNames(html: string): string[] {
  const items = new Set<string>();

  // Restrict to the Modules tabber content to avoid picking up "found in raid"
  // occurrences from unrelated sections (e.g. skins, floors, targets).
  let source = html;
  const modulesMatch = html.match(
    /<div class=\"wds-tabber dealer-tabber\">([\s\S]*?)<h2><span class=\"mw-headline\" id=\"Additional_Modules_Information\">/i,
  );
  if (modulesMatch && modulesMatch[1]) {
    source = modulesMatch[1];
  }

  // Look for list items inside the Hideout page that contain "found in raid" markup.
  // For each such li, take the FIRST linked item that is not the generic "Found in raid" article.
  const liRegex = /<li>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;

  while ((match = liRegex.exec(source)) !== null) {
    const liHtml = match[1];
    if (!/found[\s\S]*?in raid/i.test(liHtml)) continue;

    // Find all anchors with /wiki/ links in this li
    const anchorRegex = /<a[^>]+href="\/wiki\/([^"#]+)"[^>]*>([^<]+)<\/a>/gi;
    let anchorMatch: RegExpExecArray | null;
    let itemName: string | null = null;

    while ((anchorMatch = anchorRegex.exec(liHtml)) !== null) {
      const hrefTitle = anchorMatch[1];
      const text = anchorMatch[2].trim();

      // Skip generic "Found in raid" / other helper links
      if (/found_in_raid/i.test(hrefTitle)) continue;
      if (!text) continue;

      itemName = text;
      break;
    }

    if (!itemName) continue;

    items.add(itemName);
  }

  return Array.from(items);
}

function extractStashEditionLevels(html: string): Record<string, number> {
  const result: Record<string, number> = {};

  const stashSectionMatch = html.match(/<th colspan=\"4\">Stash[\s\S]*?<\/table>/i);
  if (!stashSectionMatch) return result;
  const stashHtml = stashSectionMatch[0];

  const rowRegex = /<tr>\s*<th>(\d+)[\s\S]*?<td>\s*<ul>([\s\S]*?)<\/ul>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(stashHtml)) !== null) {
    const level = Number.parseInt(rowMatch[1], 10);
    if (!Number.isFinite(level)) continue;

    const ulHtml = rowMatch[2];
    const owningRegex = /Owning\s+&quot;([^&]+)&quot;\s+game edition/gi;
    let ownMatch: RegExpExecArray | null;

    while ((ownMatch = owningRegex.exec(ulHtml)) !== null) {
      const edition = ownMatch[1].trim();
      if (edition && result[edition] == null) {
        result[edition] = level;
      }
    }

    // Handle the standard edition row which is not quoted: "Owning standard game edition"
    if (/Owning\s+standard\s+game edition/i.test(ulHtml) && result["Standard"] == null) {
      result["Standard"] = level;
    }
  }

  return result;
}

function extractCultistCircleUnlockedEditions(html: string): string[] {
  const editions = new Set<string>();

  const cultistSectionMatch = html.match(/<th colspan=\"4\">Cultist Circle[\s\S]*?<\/table>/i);
  if (!cultistSectionMatch) return [];
  const cultistHtml = cultistSectionMatch[0];

  const owningRegex = /Owning\s+&quot;([^&]+)&quot;\s+game edition/gi;
  let match: RegExpExecArray | null;

  while ((match = owningRegex.exec(cultistHtml)) !== null) {
    const edition = match[1].trim();
    if (edition) editions.add(edition);
  }

  return Array.from(editions);
}

export async function GET() {
  try {
    const res = await fetch(
      "https://escapefromtarkov.fandom.com/api.php?action=parse&page=Hideout&prop=text&formatversion=2&format=json",
      { next: { revalidate: 60 * 60 } },
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to load wiki data" }, { status: 502 });
    }

    const data = (await res.json()) as { parse?: { text?: string } };
    const html = data.parse?.text ?? "";

    if (!html) {
      return NextResponse.json({ error: "Wiki response missing text" }, { status: 500 });
    }

    const firItems = extractFirItemNames(html);
    const stashEditionLevels = extractStashEditionLevels(html);
    const cultistCircleUnlockedEditions = extractCultistCircleUnlockedEditions(html);

    const firItemsNormalized = firItems.map((name) => ({
      name,
      key: normalizeName(name),
    }));

    return NextResponse.json({
      firItems: firItemsNormalized,
      stashEditionLevels,
      cultistCircleUnlockedEditions,
    });
  } catch (error) {
    console.error("Failed to load or parse hideout wiki data", error);
    return NextResponse.json({ error: "Failed to load wiki data" }, { status: 500 });
  }
}
