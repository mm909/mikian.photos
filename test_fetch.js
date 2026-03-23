async function test() {
  const params = new URLSearchParams();
  params.set("lang", "EN_CAP");
  params.set("startpage", "startlist_responsive");
  params.set("startpage_type", "search");
  params.set("event_main_group", "");
  params.set("event", "");
  params.set("search[name]", "Musser");
  params.set("submit", "Search");

  console.log("Sending POST body:", params.toString());

  const res = await fetch(
    "https://startlist.hyrox.com/?pid=startlist_list&pidp=upcoming_nav",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
      },
      body: params.toString(),
    }
  );

  console.log("Status:", res.status);
  const html = await res.text();
  console.log("HTML length:", html.length);

  const countMatch = html.match(/<span class="list-info__text str_num">(\d+) Results?<\/span>/);
  console.log("Results count:", countMatch?.[1]);

  const hasMusser = html.includes("Musser");
  console.log("Contains Musser:", hasMusser);
}

test().catch(console.error);
