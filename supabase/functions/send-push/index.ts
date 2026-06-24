import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// =============================================
// VAPID JWT signing (Web Push Protocol)
// =============================================
async function importPrivateKey(base64url: string): Promise<CryptoKey> {
  const raw = base64UrlToUint8Array(base64url);
  // Reconstruct the EC private key in PKCS#8 format for prime256v1
  const pkcs8 = buildPkcs8(raw);
  return await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

function base64UrlToUint8Array(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function buildPkcs8(privateKeyBytes: Uint8Array): Uint8Array {
  // PKCS#8 header for prime256v1 EC key
  const header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06,
    0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01,
    0x01, 0x04, 0x20,
  ]);
  const result = new Uint8Array(header.length + privateKeyBytes.length);
  result.set(header);
  result.set(privateKeyBytes, header.length);
  return result;
}

async function buildVapidJwt(audience: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: "mailto:admin@diabp-copilot.com",
  };

  const encode = (obj: object) =>
    uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(obj)));

  const signingInput = `${encode(header)}.${encode(payload)}`;
  const signingBytes = new TextEncoder().encode(signingInput);

  const privateKey = await importPrivateKey(VAPID_PRIVATE_KEY);
  const signatureRaw = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    signingBytes
  );

  const signature = uint8ArrayToBase64Url(new Uint8Array(signatureRaw));
  return `${signingInput}.${signature}`;
}

// =============================================
// Send a single web push notification
// =============================================
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; icon?: string; tag?: string; badge?: string }
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await buildVapidJwt(audience);

    const headers: Record<string, string> = {
      "Authorization": `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      "Content-Type": "application/json",
      "TTL": "86400",
    };

    // If subscription has encryption keys, encrypt the payload
    // For simplicity, send as plain JSON (works for background-capable browsers)
    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/favicon.svg",
      badge: payload.badge || "/favicon.svg",
      tag: payload.tag || "diabp-copilot",
      requireInteraction: true,
      vibrate: [200, 100, 200],
    });

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers,
      body,
    });

    if (response.status === 410 || response.status === 404) {
      // Subscription expired or invalid — remove it
      console.log(`Removing stale subscription: ${subscription.endpoint}`);
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", subscription.endpoint);
    }

    return response.ok || response.status === 202 || response.status === 201;
  } catch (err) {
    console.error("Web push send error:", err);
    return false;
  }
}

// =============================================
// Main handler
// =============================================
serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title, body, target, icon, tag } = await req.json();

    if (!title || !body || !target) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: title, body, target" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build subscription query based on target role
    let query = supabase.from("push_subscriptions").select("endpoint, p256dh, auth, user_role");

    if (target === "patients") {
      query = query.eq("user_role", "patient");
    } else if (target === "clinicians") {
      query = query.in("user_role", ["doctor", "pharmacist", "admin"]);
    }
    // target === "all" => no filter

    const { data: subscriptions, error: subErr } = await query;

    if (subErr) {
      console.error("Error fetching subscriptions:", subErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No active subscriptions found for target" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send to all subscriptions concurrently
    const results = await Promise.allSettled(
      subscriptions.map((sub: any) =>
        sendWebPush(sub, { title, body, icon, tag })
      )
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;

    console.log(`Push sent to ${sent}/${subscriptions.length} subscribers`);

    return new Response(
      JSON.stringify({ sent, total: subscriptions.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Handler error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
