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

    const url = new URL(req.url);
    const path = url.pathname;

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

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        body[key] = value;
      }
    }

    const rawMac = body.mac || body.mac_address || body.MAC || "";
    const mac = normalizeMac(rawMac);

    if (!mac) {
      return new Response(
        JSON.stringify({ success: false, error: "MAC address required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const deviceName = body.device_name || body.name || "";
    const serial = body.serial || body.device_id || "";
    const version = body.version || body.app_version || "";
    const ip = body.ip || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const userAgent = body.user_agent || req.headers.get("user-agent") || "";

    const { data: existing } = await supabase
      .from("mac_devices")
      .select("*")
      .eq("mac_address", mac)
      .maybeSingle();

    let device = existing;

    if (!existing) {
      const autoAuthorize = settings.auto_authorize_new_devices === true || settings.auto_authorize_new_devices === "true";
      const { data: newDevice, error } = await supabase
        .from("mac_devices")
        .insert({
          mac_address: mac,
          device_name: deviceName,
          is_authorized: autoAuthorize,
          is_blocked: false,
          metadata: { serial, version, first_ip: ip, first_ua: userAgent },
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to register device" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      device = newDevice;
    } else {
      await supabase
        .from("mac_devices")
        .update({
          last_seen_at: new Date().toISOString(),
          device_name: deviceName || existing.device_name,
          metadata: { ...existing.metadata, serial, version, last_ip: ip, last_ua: userAgent },
        })
        .eq("mac_address", mac);
    }

    await supabase.from("activity").insert({
      device_type: "mac",
      device_identifier: mac,
      mac_address: mac,
      action: "register",
      ip_address: ip,
      user_agent: userAgent,
      details: { device_name: deviceName, serial, version },
    });

    if (device && device.is_blocked) {
      return new Response(
        JSON.stringify({ success: false, error: "Device is blocked", status: "blocked" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (device && !device.is_authorized) {
      return new Response(
        JSON.stringify({ success: false, error: "Device not authorized", status: "unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let server = null;
    if (device && device.server_id) {
      const { data: srv } = await supabase
        .from("servers")
        .select("*")
        .eq("id", device.server_id)
        .maybeSingle();
      server = srv;
    }
    if (!server) {
      const { data: srv } = await supabase
        .from("servers")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      server = srv;
    }

    const xtreamUsername = device?.xtream_username || server?.username || "";
    const xtreamPassword = device?.xtream_password || server?.password || "";
    const serverHost = server?.host || "";
    const serverPort = server?.port || 8080;

    const responseData: any = {
      success: true,
      mac: mac,
      status: "authorized",
      server: {
        host: serverHost,
        port: serverPort,
        username: xtreamUsername,
        password: xtreamPassword,
      },
      xtream: {
        host: serverHost,
        port: serverPort,
        username: xtreamUsername,
        password: xtreamPassword,
        protocol: "http",
      },
      settings: {
        heartbeat_interval: settings.heartbeat_interval_seconds || 60,
        sports_guide_enabled: settings.feature_sports_guide !== false,
        vpn_enabled: settings.feature_vpn_profiles !== false,
        stremio_enabled: settings.feature_stremio !== false,
        remote_control_enabled: settings.feature_remote_control !== false,
        menu_ads_enabled: settings.feature_menu_ads !== false,
        panel_url: settings.panel_url || "",
        app_version_min: settings.app_version_min || "1.0.0",
        app_version_latest: settings.app_version_latest || "1.0.0",
        apk_update_required: settings.apk_update_required === true,
        apk_update_url: settings.apk_update_url || "",
        force_https: settings.force_https === true,
      },
    };

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
