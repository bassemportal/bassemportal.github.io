/*
# Bassem TV — Reverse Proxy Configuration for paneltv.ddns.net URL Preservation

## Problem
The Android APK (ar.tvbassem.tv) has the URL `http://paneltv.ddns.net:8080` hardcoded.
Supabase Edge Functions are served from `https://<project>.supabase.co/functions/v1/`.
The APK cannot be modified or rebuilt, so the original URL must continue to work.

## Solution
Deploy a lightweight reverse proxy (nginx, Caddy, or a small Node/Deno server) on the
host at `paneltv.ddns.net:8080` that forwards incoming requests to the Supabase Edge
Functions. The APK's hardcoded paths map as follows:

  http://paneltv.ddns.net:8080/api/device/register.php  →  https://<project>.supabase.co/functions/v1/api-device-register
  http://paneltv.ddns.net:8080/api/device/resolve.php   →  https://<project>.supabase.co/functions/v1/api-device-resolve
  http://paneltv.ddns.net:8080/api/heartbeat.php        →  https://<project>.supabase.co/functions/v1/api-heartbeat
  http://paneltv.ddns.net:8080/api/sports/feed.php      →  https://<project>.supabase.co/functions/v1/api-sports-feed

The proxy passes through all headers including the custom auth header (X-Bassem-Auth).

## Option A: Nginx Configuration
*/

/* Save as /etc/nginx/sites-available/bassem-tv-proxy

server {
    listen 8080;
    server_name paneltv.ddns.net;

    # API device register
    location /api/device/register.php {
        proxy_pass https://YOUR_PROJECT.supabase.co/functions/v1/api-device-register;
        proxy_ssl_server_name on;
        proxy_set_header Host YOUR_PROJECT.supabase.co;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_request_headers on;
    }

    # API device resolve
    location /api/device/resolve.php {
        proxy_pass https://YOUR_PROJECT.supabase.co/functions/v1/api-device-resolve;
        proxy_ssl_server_name on;
        proxy_set_header Host YOUR_PROJECT.supabase.co;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_request_headers on;
    }

    # API heartbeat
    location /api/heartbeat.php {
        proxy_pass https://YOUR_PROJECT.supabase.co/functions/v1/api-heartbeat;
        proxy_ssl_server_name on;
        proxy_set_header Host YOUR_PROJECT.supabase.co;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_request_headers on;
    }

    # API sports feed
    location /api/sports/feed.php {
        proxy_pass https://YOUR_PROJECT.supabase.co/functions/v1/api-sports-feed;
        proxy_ssl_server_name on;
        proxy_set_header Host YOUR_PROJECT.supabase.co;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_request_headers on;
    }

    # Admin portal (optional — serve the static admin UI)
    location / {
        root /var/www/bassem-tv-admin;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}

*/

/* Option B: Caddy Configuration (simpler, automatic HTTPS)

:8080 {
    reverse_proxy /api/device/register.php  https://YOUR_PROJECT.supabase.co {
        header_up Host YOUR_PROJECT.supabase.co
        rewrite /functions/v1/api-device-register
    }

    reverse_proxy /api/device/resolve.php  https://YOUR_PROJECT.supabase.co {
        header_up Host YOUR_PROJECT.supabase.co
        rewrite /functions/v1/api-device-resolve
    }

    reverse_proxy /api/heartbeat.php  https://YOUR_PROJECT.supabase.co {
        header_up Host YOUR_PROJECT.supabase.co
        rewrite /functions/v1/api-heartbeat
    }

    reverse_proxy /api/sports/feed.php  https://YOUR_PROJECT.supabase.co {
        header_up Host YOUR_PROJECT.supabase.co
        rewrite /functions/v1/api-sports-feed
    }

    root * /var/www/bassem-tv-admin
    file_server
    try_files {path} /index.html
}

*/

/* Option C: Deno reverse proxy (for minimal deployments without nginx/Caddy)

// Save as proxy.ts, run with: deno run --allow-net proxy.ts

import { serve } from "https://deno.land/std/http/server.ts";

const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";

const ROUTES: Record<string, string> = {
  "/api/device/register.php": "/functions/v1/api-device-register",
  "/api/device/resolve.php":  "/functions/v1/api-device-resolve",
  "/api/heartbeat.php":       "/functions/v1/api-heartbeat",
  "/api/sports/feed.php":     "/functions/v1/api-sports-feed",
};

serve(async (req: Request) => {
  const url = new URL(req.url);
  const route = ROUTES[url.pathname];

  if (route) {
    const targetUrl = SUPABASE_URL + route + url.search;
    const headers = new Headers(req.headers);
    headers.set("Host", new URL(SUPABASE_URL).host);

    const resp = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    });

    const newHeaders = new Headers(resp.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    return new Response(resp.body, {
      status: resp.status,
      headers: newHeaders,
    });
  }

  return new Response("Not Found", { status: 404 });
}, { port: 8080 });

*/
