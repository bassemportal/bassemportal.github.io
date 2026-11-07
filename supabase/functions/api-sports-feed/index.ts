import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Bassem-Auth",
};

function normalizeMac(mac: string): string {
  if (!mac) return "";
  let cleaned = mac.toUpperCase().replace(/[^A-F0-9]/g, "");
  if (cleaned.length === 12) {
    return cleaned.match(/.{2}/g)!.join(":");
  }
  cleaned = mac.toUpperCase().replace(/-/g, ":").replace(/\s/g, "");
  if (/^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(cleaned)) {
    return cleaned;
  }
  return mac.toUpperCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const settingsRes = await supabase.from("settings").select("key, value");
    const settings: Record<string, any> = {};
    if (settingsRes.data) {
      for (const row of settingsRes.data) {
        settings[row.key] = row.value;
      }
    }

    const authHeaderName = settings.api_auth_header || "X-Bassem-Auth";
    const expectedToken = settings.api_auth_token || "";
    const providedToken = req.headers.get(authHeaderName) || req.headers.get("x-bassem-auth") || "";

    if (!expectedToken || providedToken !== expectedToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const rawMac = url.searchParams.get("mac") || "";
    const mac = normalizeMac(rawMac);
    const days = parseInt(url.searchParams.get("days") || String(settings.sports_feed_days || 7));

    const now = new Date();
    const timezone = settings.sports_feed_timezone || "Africa/Tunis";
    const utcOffset = parseInt(String(settings.sports_feed_utc_offset || 3600));

    const { data: leagues } = await supabase
      .from("sports_leagues")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    const { data: manualEvents } = await supabase
      .from("sports_manual_events")
      .select("*")
      .eq("is_active", true)
      .gte("event_time", now.toISOString())
      .lte("event_time", new Date(now.getTime() + days * 86400000).toISOString())
      .order("event_time", { ascending: true });

    const sportsMap: Record<string, any> = {};
    const leagueMap: Record<string, any> = {};

    if (leagues) {
      for (const league of leagues) {
        if (!sportsMap[league.sport]) {
          sportsMap[league.sport] = {
            name: league.sport,
            leagues: [],
          };
        }
        const leagueData = {
          id: league.thesportsdb_league_id || league.id,
          name: league.name,
          country: league.country,
          logo: league.logo_url,
          events: [],
        };
        sportsMap[league.sport].leagues.push(leagueData);
        leagueMap[league.thesportsdb_league_id || league.id] = leagueData;
      }
    }

    if (manualEvents) {
      for (const evt of manualEvents) {
        const sport = evt.sport || "Soccer";
        if (!sportsMap[sport]) {
          sportsMap[sport] = { name: sport, leagues: [] };
        }
        const leagueId = evt.league_id || "manual";
        if (!leagueMap[leagueId]) {
          const leagueData = {
            id: leagueId,
            name: "Manual Events",
            country: "",
            logo: "",
            events: [],
          };
          sportsMap[sport].leagues.push(leagueData);
          leagueMap[leagueId] = leagueData;
        }
        leagueMap[leagueId].events.push({
          id: evt.id,
          homeTeam: evt.home_team,
          awayTeam: evt.away_team,
          time: evt.event_time,
          streamUrl: evt.stream_url,
          logoHome: evt.logo_home_url,
          logoAway: evt.logo_away_url,
        });
      }
    }

    const theSportsDbKey = settings.thesportsdb_api_key || "3";
    const daysArray: any[] = [];
    for (let d = 0; d < days; d++) {
      const dayDate = new Date(now.getTime() + d * 86400000);
      const dayStr = dayDate.toISOString().split("T")[0];
      daysArray.push({
        date: dayStr,
        events: [],
      });
    }

    const feed = {
      version: parseInt(String(settings.sports_feed_version || 1)),
      generated: now.toISOString(),
      key: "sports_guide",
      type: "sports_guide",
      days: daysArray.length,
      timezone: timezone,
      utc_offset: utcOffset,
      title: settings.sports_feed_title || "Sports Guide",
      live_interval: parseInt(String(settings.sports_feed_live_interval || 300)),
      sports: Object.values(sportsMap),
      leagues: leagues ? leagues.map(l => ({
        id: l.thesportsdb_league_id || l.id,
        name: l.name,
        sport: l.sport,
        country: l.country,
        logo: l.logo_url,
      })) : [],
      events: [],
    };

    return new Response(
      JSON.stringify(feed),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
