import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const secretHash = Deno.env.get("FLUTTERWAVE_SECRET_HASH")!;

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // 1. Verify signature from Flutterwave to prevent fraudulent requests
  const signature = req.headers.get("verif-hash");
  if (!signature || signature !== secretHash) {
    return new Response("Unauthorized signature", { status: 401 });
  }

  try {
    const payload = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Check for successful charge completion event
    if (payload.event === "charge.completed" && payload.data.status === "successful") {
      const { meta } = payload.data;
      
      const targetTypeVal = meta?.facility_type; // 'clinic' | 'pharmacy' | 'patient'
      const targetIdVal = meta?.facility_id;     // Database UUID reference
      const planVal = meta?.plan;                 // 'monthly' | 'annual'

      let targetType = targetTypeVal;
      let targetId = targetIdVal;
      let plan = planVal;

      // Parse metadata from V3 format (array of metaname/metavalue objects) if needed
      if (Array.isArray(meta)) {
        const typeItem = meta.find((m: any) => m.metaname === "facility_type");
        const idItem = meta.find((m: any) => m.metaname === "facility_id");
        const planItem = meta.find((m: any) => m.metaname === "plan");

        if (typeItem) targetType = typeItem.metavalue;
        if (idItem) targetId = idItem.metavalue;
        if (planItem) plan = planItem.metavalue;
      }

      if (!targetType || !targetId) {
        return new Response("Missing metadata in webhook data", { status: 400 });
      }

      // Calculate expiration date
      const expiryDate = new Date();
      if (plan === "annual") {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      } else {
        expiryDate.setMonth(expiryDate.getMonth() + 1);
      }
      const expiryString = expiryDate.toLocaleDateString();

      // Update the database records based on target facility type
      if (targetType === "clinic") {
        const { error } = await supabase
          .from("ncd_clinics")
          .update({ is_premium: true, premium_expiry: expiryString })
          .eq("id", targetId);
        if (error) throw error;
      } else if (targetType === "pharmacy") {
        const { error } = await supabase
          .from("ncd_pharmacies")
          .update({ is_premium: true, premium_expiry: expiryString })
          .eq("id", targetId);
        if (error) throw error;
      } else if (targetType === "patient") {
        const { error } = await supabase
          .from("ncd_profiles")
          .update({ is_premium: true, premium_expiry: expiryString })
          .eq("id", targetId);
        if (error) throw error;
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
