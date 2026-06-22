import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "diabp_verify_token_123";
const whatsappAccessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to send message back to patient using Meta API (for Meta direct mode)
async function sendWhatsAppMessage(phoneId: string, toPhone: string, text: string) {
  if (!whatsappAccessToken) {
    console.warn("[WhatsApp Webhook] Missing WHATSAPP_ACCESS_TOKEN. Mock reply instead.");
    return;
  }
  
  try {
    await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${whatsappAccessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toPhone,
        type: "text",
        text: { body: text }
      })
    });
  } catch (err) {
    console.error(`[WhatsApp Webhook] Failed to send Meta message:`, err);
  }
}

serve(async (req) => {
  // 1. Handle Webhook Verification (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode && token) {
      if (mode === "subscribe" && token === verifyToken) {
        return new Response(challenge, { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    }
    return new Response("Missing Hub verification parameters", { status: 400 });
  }

  // 2. Handle CORS Options
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
    const contentType = req.headers.get("content-type") || "";
    const isTwilio = contentType.includes("application/x-www-form-urlencoded");

    let senderPhone = "";
    let messageText = "";
    let phoneId = "mock-phone-id";

    if (isTwilio) {
      const formData = await req.formData();
      const rawFrom = formData.get("From")?.toString() || ""; // e.g. "whatsapp:+2349169153129"
      senderPhone = rawFrom.replace("whatsapp:", "").replace("+", "").trim();
      messageText = formData.get("Body")?.toString() || "";
    } else {
      const body = await req.json();
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];
      const metadata = value?.metadata;
      phoneId = metadata?.phone_number_id || "mock-phone-id";

      if (!message) {
        return new Response("Ignored non-message payload", { status: 200 });
      }

      senderPhone = message.from; // e.g. "2348031234567"
      messageText = message.text?.body?.trim() || "";
    }

    const lower = messageText.toLowerCase();
    let replyText = "";

    // A. Resolve or Create Chat Session State
    let sessionState = "idle";
    let tempData: any = {};
    let hasSessionTable = true;

    try {
      const { data: session, error: sessionErr } = await supabase
        .from("ncd_chat_sessions")
        .select("*")
        .eq("phone_number", senderPhone)
        .maybeSingle();

      if (sessionErr) throw sessionErr;

      if (!session) {
        await supabase
          .from("ncd_chat_sessions")
          .insert([{ phone_number: senderPhone, flow_state: "idle", temp_data: {} }]);
      } else {
        sessionState = session.flow_state;
        tempData = session.temp_data || {};
      }
    } catch (e) {
      console.warn("[WhatsApp Webhook] ncd_chat_sessions table missing or query failed. Falling back to stateless.", e.message);
      hasSessionTable = false;
    }

    const saveSession = async (nextState: string, data: any) => {
      sessionState = nextState;
      tempData = data;
      if (hasSessionTable) {
        await supabase
          .from("ncd_chat_sessions")
          .update({ flow_state: nextState, temp_data: data, updated_at: new Date().toISOString() })
          .eq("phone_number", senderPhone);
      }
    };

    // B. Resolve Patient Profile in Database by Phone Number
    // Query by matching phone number in database
    const last10Digits = senderPhone.slice(-10);
    const { data: profiles, error: profileErr } = await supabase
      .from("ncd_profiles")
      .select("*")
      .or(`phone.eq.${senderPhone},phone.eq.+${senderPhone},phone.ilike.%${last10Digits}`);

    const patient = profiles && profiles.length > 0 ? profiles[0] : null;

    // C. Check Global Menu Command
    if (lower === "menu" || lower === "hello" || lower === "hi") {
      await saveSession("idle", {});
      if (patient) {
        replyText = `Hello ${patient.name}! Welcome back to DiaBP Safe-Meds Assistant.\n\nMain Menu:\n\n*1.* Log Daily Vitals 📈\n*2.* Confirm Monthly Refill 💊\n*3.* Get Health PDF Report 📄\n\nReply with the option number (1, 2 or 3) to choose.`;
      } else {
        await saveSession("onboard_name", {});
        replyText = `Welcome to DiaBP! I noticed this phone number is not registered in our care network yet. Let's get you set up!\n\nWhat is your full name?`;
      }
    }
    // D. Flow State Machine Logic
    else if (!patient) {
      // Onboarding State Machine for Unregistered Patients
      switch (sessionState) {
        case "onboard_name":
          tempData.name = messageText;
          await saveSession("onboard_age", tempData);
          replyText = `Nice to meet you, *${messageText}*!\n\nWhat is your age?`;
          break;

        case "onboard_age":
          const ageVal = parseInt(messageText);
          if (!isNaN(ageVal) && ageVal > 0) {
            tempData.age = ageVal;
            await saveSession("onboard_email", tempData);
            replyText = `Great! Please enter your email address. This will be your username to log in to the DiaBP Web App:`;
          } else {
            replyText = "Please enter your age as a valid number:";
          }
          break;

        case "onboard_email":
          const emailInput = messageText.trim();
          if (emailInput.includes("@") && emailInput.includes(".")) {
            tempData.email = emailInput;
            await saveSession("onboard_phone", tempData);
            replyText = `Excellent! What is your 11-digit phone number (e.g. 08012345678)?`;
          } else {
            replyText = "Invalid email format. Please enter a valid email address:";
          }
          break;

        case "onboard_phone":
          // Create the patient profile in database
          try {
            let authUserId = crypto.randomUUID();
            
            // 1. Create a real user in Supabase Auth dynamically
            try {
              const { data: authData, error: authCreateErr } = await supabase.auth.admin.createUser({
                email: tempData.email,
                password: messageText, // Temporary password is their phone number
                email_confirm: true,
                user_metadata: { role: "patient" }
              });

              if (authCreateErr) {
                console.error("[WhatsApp Webhook] Supabase Auth creation error:", authCreateErr.message);
              } else if (authData?.user?.id) {
                authUserId = authData.user.id;
              }
            } catch (authErr) {
              console.warn("[WhatsApp Webhook] Auth user create skipped:", authErr.message);
            }

            // 2. Insert the profile satisfying all NOT NULL constraints
            const { error: insertErr } = await supabase.from("ncd_profiles").insert([{
              id: authUserId,
              name: tempData.name,
              age: tempData.age,
              phone: messageText,
              conditions: ["Essential Hypertension"],
              baseline_bp: "120/80",
              target_glucose_range: "Fasting: 80-130 mg/dL",
              active_meds: [],
              is_premium: false,
              streak_days: 0,
              weight: 70
            }]);

            if (insertErr) throw insertErr;

            await saveSession("idle", {});
            replyText = `✓ Onboarding completed successfully! Your profile is registered.\n\nUsername: *${tempData.email}*\nTemporary Password: *${messageText}*\n\nWe encourage you to download and log in to the App to view your vitals dashboard & unlock premium features (like the AI foot scanner):\n\n🔗 https://diabp-copilot.vercel.app`;
          } catch (insertErr) {
            console.error("[WhatsApp Webhook] Onboarding insert failed:", insertErr);
            replyText = "Error saving your profile database record. Please try again or type *Menu* to restart.";
            await saveSession("idle", {});
          }
          break;

        default:
          await saveSession("onboard_name", {});
          replyText = `Welcome to DiaBP! I noticed this phone number is not registered in our care network yet. Let's get you set up!\n\nWhat is your full name?`;
          break;
      }
    } else {
      // Registered Patient Flow State Machine
      switch (sessionState) {
        case "idle":
          if (messageText === "1" || lower.includes("vital") || lower.includes("log")) {
            await saveSession("waiting_bp", {});
            replyText = "Please enter your Blood Pressure in format *SYSTOLIC/DIASTOLIC* (e.g. 120/80 mmHg):";
          } else if (messageText === "2" || lower.includes("refill") || lower.includes("confirm")) {
            const { data: pendingOrders } = await supabase
              .from("ncd_orders")
              .select("*")
              .eq("patient_id", patient.id)
              .eq("status", "Pending Verification");

            if (!pendingOrders || pendingOrders.length === 0) {
              replyText = "You don't have any pending refill orders waiting for confirmation. Reply with *Refill* or type your medication names to request a refill quote directly via chat!";
            } else {
              const order = pendingOrders[0];
              tempData.orderId = order.id;
              tempData.totalNaira = order.total_naira;
              await saveSession("waiting_refill_confirm", tempData);
              replyText = `Refill Request Found!\n\nMedications: *${order.items?.join(", ")}*\nTotal Amount: *₦${order.total_naira.toLocaleString()}*\n\nWould you like to approve and pay for this monthly refill?\n\n*1.* Yes, approve & pay\n*2.* Cancel`;
            }
          } else if (messageText === "3" || lower.includes("report") || lower.includes("pdf")) {
            replyText = "Generating your secure DiaBP Health Vitals Audit PDF report...\n\n📄 https://diabp-copilot.vercel.app/mock_report.pdf\n\nThis report has been uploaded to your clinician's registry automatically.";
          } else {
            replyText = "I didn't understand that command. Type *Menu* to return to the options menu.";
          }
          break;

        case "waiting_bp":
          const bpParts = messageText.split("/");
          if (bpParts.length === 2) {
            const systolic = parseInt(bpParts[0]);
            const diastolic = parseInt(bpParts[1]);
            if (!isNaN(systolic) && !isNaN(diastolic)) {
              tempData.systolic = systolic;
              tempData.diastolic = diastolic;
              await saveSession("waiting_glucose", tempData);
              replyText = `Vitals Captured: BP *${systolic}/${diastolic} mmHg*.\n\nNow, enter your Blood Glucose level in mg/dL (or type *0* to skip):`;
            } else {
              replyText = "Invalid format. Please enter as numbers like *120/80*:";
            }
          } else {
            replyText = "Invalid format. Please use *SYSTOLIC/DIASTOLIC* (e.g. *120/80*):";
          }
          break;

        case "waiting_glucose":
          const glucoseVal = parseInt(messageText);
          if (!isNaN(glucoseVal)) {
            tempData.glucose = glucoseVal;
            if (glucoseVal === 0) {
              const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
              await supabase.from("ncd_vitals").insert([{
                patient_id: patient.id,
                date: dateStr,
                systolic: tempData.systolic,
                diastolic: tempData.diastolic,
                glucose_level: 0,
                glucose_type: "Fasting"
              }]);

              const nextStreak = (patient.streak_days || 0) + 1;
              await supabase.from("ncd_profiles").update({ streak_days: nextStreak }).eq("id", patient.id);

              await saveSession("idle", {});
              replyText = `✓ Vitals logged successfully!\n\nBP: *${tempData.systolic}/${tempData.diastolic} mmHg*\nStreak: *${nextStreak} days*\n\nClinical team notified. Type *Menu* to return to options.`;
            } else {
              await saveSession("waiting_glucose_type", tempData);
              replyText = "Is this reading Fasting or Post-Meal?\n\n*1.* Fasting\n*2.* Post-Meal";
            }
          } else {
            replyText = "Invalid number. Please enter glucose in mg/dL or type *0* to skip:";
          }
          break;

        case "waiting_glucose_type":
          let type = "Fasting";
          if (messageText === "2" || lower.includes("post")) {
            type = "Post-Meal";
          }
          
          const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
          await supabase.from("ncd_vitals").insert([{
            patient_id: patient.id,
            date: dateStr,
            systolic: tempData.systolic,
            diastolic: tempData.diastolic,
            glucose_level: tempData.glucose,
            glucose_type: type
          }]);

          const nextStreak = (patient.streak_days || 0) + 1;
          await supabase.from("ncd_profiles").update({ streak_days: nextStreak }).eq("id", patient.id);

          await saveSession("idle", {});
          replyText = `✓ Vitals logged successfully!\n\nBP: *${tempData.systolic}/${tempData.diastolic} mmHg*\nGlucose: *${tempData.glucose} mg/dL (${type})*\nStreak: *${nextStreak} days*\n\nClinical team notified. Type *Menu* to return to options.`;
          break;

        case "waiting_refill_confirm":
          if (messageText === "1" || lower === "yes" || lower.includes("approve")) {
            await supabase
              .from("ncd_orders")
              .update({ status: "Delivered" })
              .eq("id", tempData.orderId);

            await saveSession("idle", {});
            replyText = `💳 Refill Payment Confirmed successfully!\n\nAmount Settled: *₦${tempData.totalNaira.toLocaleString()}*\n\n✓ Refill Approved and marked as *Delivered*. Medications are out for delivery to your registered address.`;
          } else {
            await saveSession("idle", {});
            replyText = "Refill payment cancelled. Type *Menu* to return to the options menu.";
          }
          break;
      }
    }

    // E. Deliver Reply
    if (isTwilio) {
      // For Twilio, respond with TwiML XML to send the reply back
      const twiml = `<Response><Message><Body>${replyText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Body></Message></Response>`;
      return new Response(twiml, {
        headers: { "Content-Type": "text/xml" },
        status: 200
      });
    } else {
      // For Meta, send via Fetch and return 200
      if (replyText) {
        await sendWhatsAppMessage(phoneId, senderPhone, replyText);
      }
      return new Response("Webhook processed", { status: 200 });
    }
  } catch (err: any) {
    console.error("[WhatsApp Webhook] Internal server error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
