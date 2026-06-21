import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      }
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const flwSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    if (!flwSecretKey) {
      throw new Error("Missing FLUTTERWAVE_SECRET_KEY environment variable in Supabase.");
    }

    const { account_bank, account_number, business_name, business_email } = await req.json();

    if (!account_bank || !account_number || !business_name || !business_email) {
      throw new Error("Missing required payout registration parameters.");
    }

    // Call Flutterwave subaccount creation endpoint
    const response = await fetch("https://api.flutterwave.com/v3/subaccounts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${flwSecretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        account_bank,
        account_number,
        business_name,
        business_email,
        business_contact: business_name,
        split_type: "percentage",
        split_value: 0.05
      })
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: response.status
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      }
    });
  }
});
