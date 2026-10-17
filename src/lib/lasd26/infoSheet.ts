/**
 * THE INFO SHEET'S LIST — the lines on /lasd26/info, in page order, with
 * the text each one starts with. Pure data and string helpers, no database
 * and no "server-only", so the fill script (scripts/lasd26-info-fill.ts,
 * a plain Node process) and the server lib (info.ts) read the SAME copy of
 * the owner's text. Nothing here may import a server-only module.
 *
 * Owner, 2026-10-16, on the first draft of the sheet: "no Group chat, no
 * Food plan, no Phone tracking, no What to bring, no Parking at the start,
 * no Exchange points, no Money" — those seven are RETIRED_KEYS and are
 * deleted from the table (they were the site's prefills, nothing of his).
 * Then he sent the real information from his phone: the vans, the running
 * pairs and the rotation, Thursday's two vans out of Vegas and the two
 * flights, the hotel rooms and their codes, the Airbnb with its house
 * rules. Later the same evening, three screenshots and a note: the Turo
 * receipt for the van (pick-up in Henderson, Thursday 10 AM), the Airbnb
 * host's directions (check-in 5 PM, the codes come at 5 PM), the hotel
 * confirmation (500 Hotel Circle North, 92108), his and Jazz's phone
 * numbers, and "Address for packet pick up on Thursday — AMP Association,
 * 1715 14th Santa Monica"; "You should be able to fill in the finish line"
 * — the official map's FINISH pin is Milestone Running Shop in Pacific
 * Beach. That text is typed in below, word for word. The fill script
 * (scripts/lasd26-info-fill.ts) writes every line into the table UNLESS
 * the owner has edited that line on the page since (updatedById set) —
 * his edits win over the list (review, 2026-10-16: an earlier "owner"
 * flag let the script clobber them); the site's own prefills go in the
 * same way.
 *
 * NOTES AND REMOVAL (owner, 2026-10-16, night: "Remove emergency. Allow me
 * to add / remove notes on the info page."). "emergency" joined
 * RETIRED_KEYS. A line the owner adds on the page is a NOTE: a row whose
 * key is NOTE_PREFIX + slugLabel(label) ("n-gas-money"), sorted after every
 * built-in line, with a label he may rename — a built-in line's label is
 * the list's. Built-in keys never start with "n-", so a retired key can
 * never hit a note. REMOVE (built-in or note alike) sets removedAt on the
 * row instead of deleting it: a removed built-in is never seeded again,
 * and the key stays taken, so a new note with the same name gets "-2".
 *
 * Nothing here is public: the hotel confirmations, the phone numbers and
 * the Airbnb are read behind the team's sign-in only.
 */

export type DefaultItem = {
  key: string;
  label: string;
  value: string;
  hint: string;
};

/** A value may run a page (the Airbnb's house rules) — not an essay. */
export const MAX_VALUE = 4000;

/** A note's name is an eyebrow, not a sentence. */
export const MAX_LABEL = 60;

/** A key may be this long with its prefix; parseKey() refuses longer. */
const MAX_KEY = 40;

/**
 * Every note's key starts with this. No built-in key does (they are plain
 * words: "airbnb", "van-pick-up"), which is how the client and the API tell
 * a note from a built-in line without a column for it.
 */
export const NOTE_PREFIX = "n-";

/**
 * Lines the owner struck off (2026-10-16: "no Group chat, no Food plan, no
 * Phone tracking, no What to bring, no Parking at the start, no Exchange
 * points, no Money"; that night: "Remove emergency"). ensureInfoItems()
 * and the fill script hard-delete these rows; a key listed here must not
 * be in DEFAULT_ITEMS and can never be a note's (those start with "n-").
 */
export const RETIRED_KEYS: readonly string[] = [
  "group-chat",
  "food-plan",
  "phone-tracking",
  "what-to-bring",
  "parking-at-the-start",
  "exchange-points",
  "money",
  "emergency",
];

export const DEFAULT_ITEMS: readonly DefaultItem[] = [
  {
    key: "race",
    label: "Race",
    // Measured off the organizer's directions map (scripts/lasd26-route-from-kml.ts):
    // 115.3 miles of running plus a 17.5-mile van ride through Camp Pendleton;
    // the organizer's poster rounds it to 120.
    value:
      "No Shortcuts Time Trial, 7th edition — Santa Monica → San Diego. 115 miles of running (the poster says 120) with one van ride through Camp Pendleton, two teams of 8 running in pairs. @noshortcutstt",
    hint: "",
  },
  {
    key: "race-day",
    label: "Race day",
    value: "Friday 10.23 · start 5:00 AM PT",
    hint: "the start time, and when the van leaves the Airbnb",
  },
  {
    key: "start-line",
    label: "Start line",
    value: "Santa Monica Pier (the official map's START pin)",
    hint: "exact meeting spot + what time to be there",
  },
  {
    key: "finish",
    label: "Finish",
    // The official map's FINISH pin (scripts/lasd26-route-from-kml.ts reads
    // it as "FINISH: Milestone Running Shop PB"); the street address is the
    // shop's (1892 Garnet Ave, at Lamont). Owner, 2026-10-16: "You should
    // be able to fill in the finish line."
    value: [
      "Milestone Running Shop, Pacific Beach — the official map's FINISH pin",
      "1892 Garnet Ave, San Diego, CA 92109 (Garnet at Lamont, across from the Broken Yolk)",
      "The hotel is 10 minutes away up the 8.",
    ].join("\n"),
    hint: "the finish line in San Diego and where the van parks",
  },
  {
    key: "the-weekend",
    label: "The weekend",
    value: [
      "Thu 10.22 — Vegas → LA (two vans + two flights). Packet pick-up at AMP Association in Santa Monica. Airbnb check-in 5 PM.",
      "Fri 10.23 — race day, 5:00 AM start at the pier. The hotel in San Diego after the finish.",
      "Sat 10.24 — breakfast, then the drive home. The van is due back in Henderson by 10 PM.",
    ].join("\n"),
    hint: "the plan, day by day",
  },
  {
    key: "leaving-vegas",
    label: "Leaving Vegas",
    // The owner's updated list (2026-10-16, late): the counts as he sent
    // them (9 in the late van), the two flights' times, and the meeting
    // spot from his screenshot ("Meeting at the phone screenshot address
    // when leaving Vegas" — 1250 Wigwam Pkwy, Henderson NV 89074, Apt 6306).
    value: [
      "THURSDAY, OCTOBER 22 — Las Vegas → Los Angeles",
      "Meet at 1250 Wigwam Pkwy, Henderson, NV 89074 — Apt 6306.",
      "",
      "EARLY VAN (7): Nat, Alli, Jasmine, Aizalyn, Mikian, Johnny, Jacob",
      "",
      "LATE VAN (9): Kelz (off at 1 PM), Ximena (off at 2 PM), Ruby (volunteering for the later van), Tasha (off at 1 PM), Karla (off at 1 PM), Cindy (off at 2 PM), Joe (off at 4 AM), Keith (off at 12 PM), Dann (off at 1 PM)",
      "",
      "FLYING IN (2): Amy's flight gets in at 12:05 AM on Friday · Faith's flight gets in at 9:50 PM on Thursday",
      "",
      "An itinerary with times and meeting spots is coming.",
    ].join("\n"),
    hint: "Thursday: what time, where we meet, who rides in which van",
  },
  {
    key: "van-pick-up",
    label: "Van pick-up",
    // The Turo receipt the owner sent (2026-10-16): Ford Transit 2023, host
    // Christine, guest Jasmine, Thu 22 Oct 10:00 PDT → Sat 24 Oct 22:00 PDT,
    // 1016 Santa Helena Avenue, Henderson, NV 89002, 600 miles included.
    value: [
      "Thursday 10.22, 10:00 AM — Turo, Ford Transit 2023 (Jasmine's booking)",
      "1016 Santa Helena Ave, Henderson, NV 89002",
      "Back to the same spot by Saturday 10.24, 10:00 PM. 600 miles included; $0.60 a mile over.",
      "",
      "The second van — tbd.",
    ].join("\n"),
    hint: "where and when we get the vans (Thursday)",
  },
  {
    key: "packet-pick-up",
    label: "Packet pick-up",
    // Owner, 2026-10-16: "Address for packet pick up on Thursday — Amp
    // association, 1715 14th Santa Monica" (AMP Association, the gym at
    // 14th and Olympic).
    value: ["Thursday 10.22 — AMP Association", "1715 14th St, Santa Monica, CA 90404"].join("\n"),
    hint: "where the race hands out the bibs, and when",
  },
  {
    key: "vans",
    label: "Vans",
    value: [
      "VAN 1 — Karla (driver)",
      "Nat & Jazz · Kelz & Alli · Ruby & Ximena · Keith & Tasha",
      "",
      "VAN 2 — Amy (driver)",
      "Mikian & Aiz · Joe & Johnny · Dann & Faith · Cindy & Jacob",
    ].join("\n"),
    hint: "who drives, who rides in which van",
  },
  {
    key: "pairs-rotation",
    label: "Pairs & rotation",
    value: [
      "1. (Keith & Tasha) & (Joe & Johnny)",
      "2. (Nat & Jazz) & (Dann & Faith)",
      "3. (Kelz & Ali) & (Cindy & Jacob)",
      "4. (Ruby & Ximena) & (Mikian & Aiz)",
      "",
      "Keith & Tasha start the race. Pairs run for ~1 hour at a time: when pair 1 is done, pair 2 takes over, then 3, then 4, and back to pair 1. One hour running, three hours of rest.",
    ].join("\n"),
    hint: "the order we run in",
  },
  {
    key: "airbnb",
    label: "Airbnb",
    // The host's directions (Kai and Ariel, the Airbnb message the owner
    // sent 2026-10-16): check-in 5 PM, the access codes arrive at 5 PM,
    // $15 a head if the party changes, street cleaning Tuesdays 8–10 AM.
    value: [
      "1842 S Sycamore Ave, Los Angeles, CA 90019",
      "https://maps.app.goo.gl/BciyfhFcY4UvJTpo6",
      "House: 6 bedrooms · 5 bathrooms · 10 beds · 3 floors",
      "",
      "CHECK-IN: Thursday, 5 PM. The door codes come from the host at 5 PM — self check-in.",
      "Extra guest fee $15 a person if the head count changes. Hosts: Kai and Ariel.",
      "",
      "HOUSE RULES",
      "• Quiet hours 11 PM – 7 AM.",
      "• No shoes inside the house.",
      "• No smoking, vaping, marijuana or illegal drug use anywhere on the property. $500 fine.",
      "• No pets.",
      "• Clean up after yourself, wash your dishes, dispose of trash properly.",
      "• Damaged or missing items may be charged.",
      "• If a toilet clogs, use the plunger; a plumber's fee is on us.",
      "• Lost keys or lockouts may cost a locksmith / replacement.",
      "",
      "PARKING",
      "• FREE street parking ONLY. Nothing in the driveway or on the property — vehicles may be towed.",
      "• Check street-cleaning signs (Tuesdays 8–10 AM); don't block neighbors' driveways.",
      "",
      "OTHER",
      "• Self check-in with door codes; the instructions arrive at 5 PM on arrival day.",
      "• Host assistance until 10 PM Pacific.",
      "• Laundry $15 per load (wash and dry). Kitchen and Wi-Fi.",
      "",
      "Breaking house rules can mean immediate eviction without a refund.",
    ].join("\n"),
    hint: "address, door code, check-in / check-out",
  },
  {
    // The key stays "hotel-friday" (the row the owner may already have typed
    // on); only the label changed, 2026-10-16: "Hotel after the race".
    key: "hotel-friday",
    label: "Hotel after the race",
    // The confirmation the owner sent (2026-10-16): the No Shortcuts room
    // block, Oct 23–24, Town and Country San Diego, 500 Hotel Circle North,
    // 92108; its acknowledgement number reads ZKD0HIPI (a zero) — the room
    // 4 line below follows the screenshot, his typed list had the letter O.
    value: [
      "Town and Country San Diego — the No Shortcuts room block",
      "500 Hotel Circle North, San Diego, CA 92108",
      "Friday 10.23 → Saturday 10.24, one night. The codes are the confirmation numbers — give yours at the desk.",
      "",
      "ROOM 1 · 3836V89X — Jazz, Nat, Aiz, Ali",
      "ROOM 2 · SOKXU5UI — Tash, Keith, Joe, Johnny",
      "ROOM 3 · SX6S8RX4 — Karla, Ruby, Ximena, Amy",
      "ROOM 4 · ZKD0HIPI — Cindy, Faith",
      "ROOM 5 · Y09LVL2L — Mikian, Kelz, Dann, Jacob",
      "",
      "Reservations: tcsd-reservations@towncountry.com",
    ].join("\n"),
    hint: "address, which names the rooms are under",
  },
  {
    key: "crew-phones",
    label: "Crew phones",
    // Owner, 2026-10-16: "My phone number 7025404190 / Jazz's phone number
    // +1 (702) 544-9097".
    value: ["Mikian — (702) 540-4190", "Jazz — (702) 544-9097"].join("\n"),
    hint: "Mikian, the crew captains",
  },
  // "Emergency" was the last line until the owner struck it (2026-10-16,
  // night: "Remove emergency") — it is in RETIRED_KEYS now.
];

/** A key is a slug: "airbnb", "van-pick-up", "n-gas-money". Null for anything else. */
export function parseKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const k = v.trim();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(k) && k.length <= MAX_KEY ? k : null;
}

/** A note the owner added, as opposed to a built-in line of the list. */
export function isNoteKey(key: string): boolean {
  return key.startsWith(NOTE_PREFIX);
}

/**
 * A note's label as stored: trimmed, runs of blanks folded to one space,
 * 1–MAX_LABEL characters. Null when there is nothing usable in it — the
 * API answers 400.
 */
export function cleanLabel(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s.length >= 1 && s.length <= MAX_LABEL ? s : null;
}

/**
 * The slug a note's key is built from: "Gas money!" → "gas-money" — lower
 * case, accents stripped (é → e), every run of anything but a–z / 0–9 a
 * single hyphen, no hyphen at either end, and short enough that
 * NOTE_PREFIX + slug + a "-2" collision suffix still passes parseKey().
 * "note" when nothing survives (a label of only punctuation or emoji).
 */
export function slugLabel(label: string): string {
  // Room for the prefix and a "-NN" suffix inside MAX_KEY.
  const room = MAX_KEY - NOTE_PREFIX.length - 3;
  const slug = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, room)
    .replace(/-+$/g, "");
  return slug || "note";
}

/**
 * The value as stored: Windows line ends folded, trailing blanks off every
 * line, trimmed at both ends, cut at MAX_VALUE. Never throws.
 */
export function cleanValue(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim()
    .slice(0, MAX_VALUE);
}
