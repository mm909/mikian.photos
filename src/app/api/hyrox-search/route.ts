import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STARTLIST_URL = "https://startlist.hyrox.com/";

interface EventGroup {
  value: string;
  text: string;
}

// Fetch the search page to get current event_main_groups
async function getEventMainGroups(): Promise<EventGroup[]> {
  const res = await fetch(`${STARTLIST_URL}?pid=search&pidp=upcoming_nav`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  const html = await res.text();
  const groups: EventGroup[] = [];
  const re =
    /<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g;
  // Find the event_main_group select
  const selectMatch = html.match(
    /<select[^>]*id="simple-search-event_main_group"[^>]*>([\s\S]*?)<\/select>/
  );
  if (!selectMatch) return groups;
  let m;
  while ((m = re.exec(selectMatch[1])) !== null) {
    groups.push({ value: m[1], text: m[2].trim() });
  }
  return groups;
}

interface SearchResult {
  name: string;
  firstName: string;
  lastName: string;
  country: string;
  bib: string;
  ageGroup: string;
  day: string;
  startwave: string;
  eventMainGroup: string;
  eventCode: string;
  detailUrl: string;
}

// Search a specific event_main_group for an athlete
async function searchEvent(
  group: EventGroup,
  lastName: string,
  firstName: string
): Promise<SearchResult[]> {
  const params = new URLSearchParams();
  params.set("lang", "EN_CAP");
  params.set("startpage", "startlist_responsive");
  params.set("startpage_type", "search");
  params.set("event_main_group", group.value);
  params.set("event", "");
  params.set("search[name]", lastName);
  if (firstName) params.set("search[firstname]", firstName);
  params.set("submit", "Search");

  const res = await fetch(
    `${STARTLIST_URL}?pid=startlist_list&pidp=upcoming_nav`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
      },
      body: params.toString(),
      cache: "no-store",
    }
  );
  const html = await res.text();
  return parseSearchResults(html, group.text);
}

function parseSearchResults(
  html: string,
  eventMainGroup: string
): SearchResult[] {
  const results: SearchResult[] = [];

  // Check for 0 results
  const countMatch = html.match(
    /<span class="list-info__text str_num">(\d+) Results?<\/span>/
  );
  if (!countMatch || countMatch[1] === "0") return results;

  // Split by list-group-item rows (each athlete entry)
  const rowRe =
    /<li class="[^"]*list-group-item row">([\s\S]*?)(?=<li class="[^"]*list-group-item|<\/ul>)/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const row = rowMatch[1];

    // Skip header rows
    if (row.includes("list-group-header")) continue;
    // Skip "No results found"
    if (row.includes("No results found")) continue;

    // Name + detail link
    const nameMatch = row.match(
      /<a href="([^"]*)"[^>]*>([^<]+)<\/a>/
    );
    if (!nameMatch) continue;

    const detailUrl = nameMatch[1].replace(/&amp;/g, "&");
    const fullName = nameMatch[2].trim();

    // Parse "Last, First" or "Last, First (COUNTRY)"
    const nameParts = fullName.match(/^(.+?),\s*(.+?)(?:\s*\((\w+)\))?$/);
    const lastName = nameParts ? nameParts[1].trim() : fullName;
    const firstName = nameParts ? nameParts[2].trim() : "";
    const country = nameParts?.[3] || "";

    // Extract event code from detail URL
    const eventCodeMatch = detailUrl.match(/event=([^&]+)/);
    const eventCode = eventCodeMatch ? eventCodeMatch[1] : "";

    // Bib number
    const bibMatch = row.match(
      /Bib no\.<\/div>(\d+)<\/div>/
    );
    const bib = bibMatch ? bibMatch[1] : "";

    // Age Group
    const ageMatch = row.match(
      /Age Group<\/div>([^<]+)<\/div>/
    );
    const ageGroup = ageMatch ? ageMatch[1].trim() : "";

    // Day
    const dayMatch = row.match(
      /Day<\/div>([^<]+)<\/div>/
    );
    const day = dayMatch ? dayMatch[1].trim() : "";

    // Startwave
    const waveMatch = row.match(
      /Startwave<\/div>([^<]+)<\/div>/
    );
    const startwave = waveMatch ? waveMatch[1].trim() : "";

    // Also try for country from flag if not in name
    let countryFromFlag = country;
    if (!countryFromFlag) {
      const flagMatch = row.match(
        /class="nation__abbr">(\w+)<\/span>/
      );
      if (flagMatch) countryFromFlag = flagMatch[1];
    }

    results.push({
      name: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      country: countryFromFlag,
      bib,
      ageGroup,
      day,
      startwave,
      eventMainGroup,
      eventCode,
      detailUrl,
    });
  }

  return results;
}

// Cross-event search (no event_main_group filter) to catch all season registrations
async function searchAllEvents(
  lastName: string,
  firstName: string
): Promise<SearchResult[]> {
  const params = new URLSearchParams();
  params.set("lang", "EN_CAP");
  params.set("startpage", "startlist_responsive");
  params.set("startpage_type", "search");
  params.set("event_main_group", "");
  params.set("event", "");
  params.set("search[name]", lastName);
  if (firstName) params.set("search[firstname]", firstName);
  params.set("submit", "Search");

  const res = await fetch(
    `${STARTLIST_URL}?pid=startlist_list&pidp=upcoming_nav`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
      },
      body: params.toString(),
      cache: "no-store",
    }
  );
  const html = await res.text();
  return parseCrossEventResults(html);
}

function parseCrossEventResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  const countMatch = html.match(
    /<span class="list-info__text str_num">(\d+) Results?<\/span>/
  );
  if (!countMatch || countMatch[1] === "0") return results;

  const rowRe =
    /<li class="[^"]*list-group-item row">([\s\S]*?)(?=<li class="[^"]*list-group-item|<\/ul>)/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const row = rowMatch[1];
    if (row.includes("list-group-header")) continue;
    if (row.includes("No results found")) continue;

    const nameMatch = row.match(/<a href="([^"]*)"[^>]*>([^<]+)<\/a>/);
    if (!nameMatch) continue;

    const detailUrl = nameMatch[1].replace(/&amp;/g, "&");
    const fullName = nameMatch[2].trim();

    // Event code from li class
    const liClassMatch = rowMatch[0].match(
      /event-([A-Za-z0-9_]+)/
    );
    const eventCodeFromClass = liClassMatch ? liClassMatch[1] : "";

    // Also from URL
    const eventCodeMatch = detailUrl.match(/event=([^&]+)/);
    const eventCode = eventCodeMatch ? eventCodeMatch[1] : eventCodeFromClass;

    // Skip OVERALL aggregates
    if (eventCode.includes("_OVERALL")) continue;

    // Parse name: "Last, First (COUNTRY)"
    const nameParts = fullName.match(/^(.+?),\s*(.+?)(?:\s*\((\w+)\))?$/);
    const lastName = nameParts ? nameParts[1].trim() : fullName;
    const firstName = nameParts ? nameParts[2].trim() : "";
    const country = nameParts?.[3] || "";

    // Bib
    const bibMatch = row.match(/Bib no\.<\/div>(\d+)<\/div>/);
    const bib = bibMatch ? bibMatch[1] : "";

    // Startwave
    const waveMatch = row.match(
      /Startwave<\/div>([^<]+)<\/div>/
    );
    const startwave = waveMatch ? waveMatch[1].trim() : "";

    // Division field (cross-event has this)
    const divMatch = row.match(
      /Division<\/div>([^<]+)<\/div>/
    );
    const division = divMatch ? divMatch[1].trim() : "";

    results.push({
      name: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      country,
      bib,
      ageGroup: "",
      day: "",
      startwave: startwave.includes("\u2013") ? "" : startwave,
      eventMainGroup: division || "",
      eventCode,
      detailUrl,
    });
  }

  return results;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Detail page fetch: returns event name, day, and partner info for doubles
  const detailPath = searchParams.get("detail");
  if (detailPath) {
    try {
      const detailUrl = `${STARTLIST_URL}${detailPath.replace(/^\/?\??/, "?")}`;
      const res = await fetch(detailUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      });
      const html = await res.text();

      // Race name from "Workout summary" table
      const raceMatch = html.match(
        /class="f-__meeting last">([^<]+)<\/td>/
      );
      const race = raceMatch ? raceMatch[1].trim() : "";

      // Day from "Workout summary" table
      const dayMatch = html.match(
        /class="f-__date_start last">([^<]+)<\/td>/
      );
      const day = dayMatch ? dayMatch[1].trim() : "";

      // Members (for doubles/relay)
      const members: { name: string; firstName: string; lastName: string }[] = [];
      const memberRe = /Member \d+<\/th>\s*<td[^>]*>([^<]+)<\/td>/g;
      let mm;
      while ((mm = memberRe.exec(html)) !== null) {
        const raw = mm[1].trim();
        const parts = raw.match(/^(.+?),\s*(.+?)(?:\s*\((\w+)\))?$/);
        if (parts) {
          members.push({
            name: `${parts[2].trim()} ${parts[1].trim()}`,
            firstName: parts[2].trim(),
            lastName: parts[1].trim(),
          });
        } else {
          members.push({ name: raw, firstName: raw.split(/\s+/)[0], lastName: raw });
        }
      }

      return NextResponse.json({ race, day, members });
    } catch {
      return NextResponse.json({ race: "", day: "", members: [] });
    }
  }

  const q = (searchParams.get("q") || searchParams.get("name") || "").trim();
  const explicitFirst = searchParams.get("firstname") || "";

  if (!q && !explicitFirst) {
    return NextResponse.json(
      { error: "Provide a name to search" },
      { status: 400 }
    );
  }

  try {
    const parts = q.split(/\s+/).filter(Boolean);
    let searches: { lastName: string; firstName: string }[];

    if (parts.length >= 2) {
      // Two words: treat as "firstname lastname"
      searches = [{ firstName: parts[0], lastName: parts.slice(1).join(" ") }];
    } else if (parts.length === 1) {
      // Single word: search as both first and last name
      searches = [
        { lastName: parts[0], firstName: "" },
        { lastName: "", firstName: parts[0] },
      ];
    } else {
      searches = [{ lastName: "", firstName: explicitFirst }];
    }

    const groups = await getEventMainGroups();

    // Run all search variants in parallel
    const perEventPromises: Promise<SearchResult[]>[] = [];
    const crossEventPromises: Promise<SearchResult[]>[] = [];

    for (const s of searches) {
      crossEventPromises.push(searchAllEvents(s.lastName, s.firstName));
      // Only do per-event search if we have a last name (avoids doubling calls)
      if (s.lastName && groups.length) {
        for (const g of groups) {
          perEventPromises.push(searchEvent(g, s.lastName, s.firstName));
        }
      }
    }

    const [perEventBatches, crossEventBatches] = await Promise.all([
      Promise.all(perEventPromises),
      Promise.all(crossEventPromises),
    ]);

    // Merge: prefer per-event results (richer data), add cross-event for missing
    const seen = new Set<string>();
    const results: SearchResult[] = [];

    for (const batch of perEventBatches) {
      for (const r of batch) {
        if (r.eventCode.includes("_OVERALL")) continue;
        const key = `${r.bib}-${r.eventCode}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(r);
        }
      }
    }

    for (const batch of crossEventBatches) {
      for (const r of batch) {
        if (r.eventCode.includes("_OVERALL")) continue;
        const key = `${r.bib}-${r.eventCode}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(r);
        }
      }
    }

    return NextResponse.json({ results, events: groups.map(g => g.text) });
  } catch (e) {
    console.error("HYROX search error:", e);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
