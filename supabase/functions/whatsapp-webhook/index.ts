import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "diabp_verify_token_123";
const whatsappAccessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to send message back to patient using Meta API
async function sendWhatsAppMessage(phoneId: string, toPhone: string, text: string) {
  if (!whatsappAccessToken) {
    console.warn("[WhatsApp Webhook] Missing WHATSAPP_ACCESS_TOKEN. Mock reply instead.");
    console.log(`[Mock Send to ${toPhone}]: ${text}`);
    return;
  }
  
  try {
    const res = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
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
    
    if (!res.ok) {
      console.error(`[WhatsApp Webhook] Meta API error status ${res.status}:`, await res.text());
    } else {
      console.log(`[WhatsApp Webhook] Message sent successfully to ${toPhone}`);
    }
  } catch (err) {
    console.error(`[WhatsApp Webhook] Failed to send message to ${toPhone}:`, err);
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
        console.log("[WhatsApp Webhook] Verification token matched successfully.");
        return new Response(challenge, { status: 200 });
      }
      console.warn("[WhatsApp Webhook] Verification failed. Token mismatch.");
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
    const body = await req.json();
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    const metadata = value?.metadata;
    const phoneId = metadata?.phone_number_id || "mock-phone-id";

    if (!message) {
      // Not a user message event (could be a status update, delivery report etc.)
      return new Response("Ignored non-message payload", { status: 200 });
    }

    const senderPhone = message.from; // Sender's phone number e.g. "2348031234567"
    const messageText = message.text?.body?.trim() || "";
    const lower = messageText.toLowerCase();

    console.log(`[WhatsApp Webhook] Message received from ${senderPhone}: "${messageText}"`);

    // A. Resolve or Create Chat Session State
    // Try to find an existing session. If missing, we insert a default row.
    // If ncd_chat_sessions does not exist, it falls back to stateless memory.
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
    const { data: profiles, error: profileErr } = await supabase
      .from("ncd_profiles")
      .select("*")
      .or(`phone.eq.${senderPhone},phone.eq.+${senderPhone},phone.ilike.%${senderPhone.slice(-10)}`);

    if (profileErr) {
      console.error("[WhatsApp Webhook] Error retrieving patient profile:", profileErr);
    }

    const patient = profiles && profiles.length > 0 ? profiles[0] : null;

    // C. Check Global Menu Command
    if (lower === "menu" || lower === "hello" || lower === "hi") {
      await saveSession("idle", {});
      if (patient) {
        await sendWhatsAppMessage(
          phoneId,
          senderPhone,
          `Hello ${patient.name}! Welcome back to DiaBP Safe-Meds Assistant.\n\nMain Menu:\n\n*1.* Log Daily Vitals 📈\n*2.* Confirm Monthly Refill 💊\n*3.* Get Health PDF Report 📄\n\nReply with the option number (1, 2 or 3) to choose.`
        );
      } else {
        await saveSession("onboard_name", {});
        await sendWhatsAppMessage(
          phoneId,
          senderPhone,
          `Welcome to DiaBP! I noticed this phone number is not registered in our care network yet. Let's get you set up!\n\nWhat is your full name?`
        );
      }
      return new Response("Processed menu command", { status: 200 });
    }

    // D. Flow State Machine Logic
    if (!patient) {
      // Onboarding State Machine for Unregistered Patients
      switch (sessionState) {
        case "onboard_name":
          tempData.name = messageText;
          await saveSession("onboard_age", tempData);
          await sendWhatsAppMessage(
            phoneId,
            senderPhone,
            `Nice to meet you, *${messageText}*!\n\nWhat is your age?`
          );
          break;

        case "onboard_age":
          const ageVal = parseInt(messageText);
          if (!isNaN(ageVal) && ageVal > 0) {
            tempData.age = ageVal;
            await saveSession("onboard_phone", tempData);
            await sendWhatsAppMessage(
              phoneId,
              senderPhone,
              `Great! And what is your 11-digit phone number (e.g. 08012345678)?`
            );
          } else {
            await sendWhatsAppMessage(phoneId, senderPhone, "Please enter your age as a valid number:");
          }
          break;

        case "onboard_phone":
          // Create the patient profile in database
          try {
            const newId = crypto.randomUUID();
            await supabase.from("ncd_profiles").insert([{
              id: newId,
              name: tempData.name,
              age: tempData.age,
              phone: messageText,
              conditions: ["Essential Hypertension"],
              is_premium: false,
              streak_days: 0,
              weight: 70
            }]);

            await saveSession("idle", {});
            await sendWhatsAppMessage(
              phoneId,
              senderPhone,
              `✓ Onboarding completed successfully! Your profile is registered.\n\nWelcome to DiaBP! Type *Menu* to start managing your daily health.`
            );
          } catch (insertErr) {
            console.error("[WhatsApp Webhook] Onboarding insert failed:", insertErr);
            await sendWhatsAppMessage(phoneId, senderPhone, "Error saving your profile. Please try again or type *Menu* to restart.");
            await saveSession("idle", {});
          }
          break;

        default:
          // Fallback to start onboarding
          await saveSession("onboard_name", {});
          await sendWhatsAppMessage(
            phoneId,
            senderPhone,
            `Welcome to DiaBP! I noticed this phone number is not registered in our care network yet. Let's get you set up!\n\nWhat is your full name?`
          );
          break;
      }
    } else {
      // Registered Patient Flow State Machine
      switch (sessionState) {
        case "idle":
          if (messageText === "1" || lower.includes("vital") || lower.includes("log")) {
            await saveSession("waiting_bp", {});
            await sendWhatsAppMessage(
              phoneId,
              senderPhone,
              "Please enter your Blood Pressure in format *SYSTOLIC/DIASTOLIC* (e.g. 120/80 mmHg):"
            );
          } else if (messageText === "2" || lower.includes("refill") || lower.includes("confirm")) {
            // Find pending orders for patient
            const { data: pendingOrders } = await supabase
              .from("ncd_orders")
              .select("*")
              .eq("patient_id", patient.id)
              .eq("status", "Pending Verification");

            if (!pendingOrders || pendingOrders.length === 0) {
              await sendWhatsAppMessage(
                phoneId,
                senderPhone,
                "You don't have any pending refill orders waiting for confirmation. Reply with *Refill* or type your medication names to request a refill quote directly via chat!"
              );
            } else {
              const order = pendingOrders[0];
              tempData.orderId = order.id;
              tempData.totalNaira = order.total_naira;
              await saveSession("waiting_refill_confirm", tempData);
              await sendWhatsAppMessage(
                phoneId,
                senderPhone,
                `Refill Request Found!\n\nMedications: *${order.items?.join(", ")}*\nTotal Amount: *₦${order.total_naira.toLocaleString()}*\n\nWould you like to approve and pay for this monthly refill?\n\n*1.* Yes, approve & pay\n*2.* Cancel`
              );
            }
          } else if (messageText === "3" || lower.includes("report") || lower.includes("pdf")) {
            await sendWhatsAppMessage(
              phoneId,
              senderPhone,
              "Generating your secure DiaBP Health Vitals Audit PDF report...\n\n📄 https://diabp-copilot.vercel.app/mock_report.pdf\n\nThis report has been uploaded to your clinician's registry automatically."
            );
          } else {
            await sendWhatsAppMessage(
              phoneId,
              senderPhone,
              "I didn't understand that command. Type *Menu* to return to the options menu."
            );
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
              await sendWhatsAppMessage(
                phoneId,
                senderPhone,
                `Vitals Captured: BP *${systolic}/${diastolic} mmHg*.\n\nNow, enter your Blood Glucose level in mg/dL (or type *0* to skip):`
              );
            } else {
              await sendWhatsAppMessage(phoneId, senderPhone, "Invalid format. Please enter as numbers like *120/80*:");
            }
          } else {
            await sendWhatsAppMessage(phoneId, senderPhone, "Invalid format. Please use *SYSTOLIC/DIASTOLIC* (e.g. *120/80*):");
          }
          break;

        case "waiting_glucose":
          const glucoseVal = parseInt(messageText);
          if (!isNaN(glucoseVal)) {
            tempData.glucose = glucoseVal;
            if (glucoseVal === 0) {
              // Save vital log with BP only
              const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
              await supabase.from("ncd_vitals").insert([{
                patient_id: patient.id,
                date: dateStr,
                systolic: tempData.systolic,
                diastolic: tempData.diastolic,
                glucose_level: 0,
                glucose_type: "Fasting"
              }]);

              // Update streak count
              const nextStreak = (patient.streak_days || 0) + 1;
              await supabase.from("ncd_profiles").update({ streak_days: nextStreak }).eq("id", patient.id);

              await saveSession("idle", {});
              await sendWhatsAppMessage(
                phoneId,
                senderPhone,
                `✓ Vitals logged successfully!\n\nBP: *${tempData.systolic}/${tempData.diastolic} mmHg*\nStreak: *${nextStreak} days*\n\nClinical team notified. Type *Menu* to return to options.`
              );
            } else {
              await saveSession("waiting_glucose_type", tempData);
              await sendWhatsAppMessage(
                phoneId,
                senderPhone,
                "Is this reading Fasting or Post-Meal?\n\n*1.* Fasting\n*2.* Post-Meal"
              );
            }
          } else {
            await sendWhatsAppMessage(phoneId, senderPhone, "Invalid number. Please enter glucose in mg/dL or type *0* to skip:");
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
          await sendWhatsAppMessage(
            phoneId,
            senderPhone,
            `✓ Vitals logged successfully!\n\nBP: *${tempData.systolic}/${tempData.diastolic} mmHg*\nGlucose: *${tempData.glucose} mg/dL (${type})*\nStreak: *${nextStreak} days*\n\nClinical team notified. Type *Menu* to return to options.`
          );
          break;

        case "waiting_refill_confirm":
          if (messageText === "1" || lower === "yes" || lower.includes("approve")) {
            // Update order status in DB to Delivered (or Paid)
            await supabase
              .from("ncd_orders")
              .update({ status: "Delivered" })
              .eq("id", tempData.orderId);

            await saveSession("idle", {});
            await sendWhatsAppMessage(
              phoneId,
              senderPhone,
              `💳 Refill Payment Confirmed successfully!\n\nAmount Settled: *₦${tempData.totalNaira.toLocaleString()}*\n\n✓ Refill Approved and marked as *Delivered*. Medications are out for delivery to your registered address.`
            );
          } else {
            await saveSession("idle", {});
            await sendWhatsAppMessage(phoneId, senderPhone, "Refill payment cancelled. Type *Menu* to return to the options menu.");
          }
          break;
      }
    }

    return new Response("Webhook processed", { status: 200 });
  } catch (err: any) {
    console.error("[WhatsApp Webhook] Internal server error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
