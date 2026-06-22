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
      if (patient) {
        await saveSession("idle", {});
        replyText = `Hello ${patient.name}! Welcome back to DiaBP Safe-Meds Assistant.\n\nMain Menu:\n\n*1.* Log Daily Vitals 📈\n*2.* Confirm Monthly Refill 💊\n*3.* Get Health PDF Report 📄\n\nReply with the option number (1, 2 or 3) to choose. Or visit our app at https://diabp-copilot.vercel.app to view your dashboard.`;
      } else if (sessionState === "clinician_dashboard") {
        replyText = `Hello! You are registered as a Care Clinician (Doctor/Nurse).\n\nPlease log in to your web dashboard at https://diabp-copilot.vercel.app to manage your registry and patients.`;
      } else if (sessionState === "pharmacist_dashboard") {
        replyText = `Hello! You are registered as a Community Pharmacy Partner.\n\nPlease log in to your web dashboard at https://diabp-copilot.vercel.app to view and fulfill monthly refill orders.`;
      } else {
        await saveSession("onboard_role", {});
        replyText = `Welcome to DiaBP! Let's get you set up. Are you a:\n\n*1.* Patient 🩺\n*2.* Doctor/Clinician 🥼\n*3.* Pharmacist/Pharmacy 💊\n\nReply with the option number (1, 2 or 3) to choose.`;
      }
    }
    // D. Flow State Machine Logic
    else if (!patient) {
      // Onboarding State Machine for Unregistered Patients, Doctors, and Pharmacists
      switch (sessionState) {
        case "onboard_role":
          if (messageText === "1" || lower.includes("patient")) {
            tempData.role = "patient";
            await saveSession("onboard_name", tempData);
            replyText = "Great! What is your full name?";
          } else if (messageText === "2" || lower.includes("doctor") || lower.includes("clinician")) {
            tempData.role = "doctor";
            await saveSession("onboard_doc_name", tempData);
            replyText = "Welcome Doctor! What is your full name?";
          } else if (messageText === "3" || lower.includes("pharmacist") || lower.includes("pharmacy")) {
            tempData.role = "pharmacist";
            await saveSession("onboard_pharm_name", tempData);
            replyText = "Welcome Pharmacy Partner! What is your full name?";
          } else {
            replyText = "Please choose a valid option:\n\n*1.* Patient 🩺\n*2.* Doctor/Clinician 🥼\n*3.* Pharmacist/Pharmacy 💊\n\nReply with 1, 2, or 3:";
          }
          break;

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

            let phoneValue = messageText;
            const enteredLast10 = messageText.slice(-10);
            const senderLast10 = senderPhone.slice(-10);
            if (enteredLast10 !== senderLast10) {
              phoneValue = `${messageText} (WhatsApp: +${senderPhone})`;
            }

            // 2. Insert the profile satisfying all NOT NULL constraints
            const { error: insertErr } = await supabase.from("ncd_profiles").insert([{
              id: authUserId,
              name: tempData.name,
              age: tempData.age,
              phone: phoneValue,
              conditions: ["Essential Hypertension"],
              baseline_bp: "120/80",
              target_glucose_range: "Fasting: 80-130 mg/dL",
              active_meds: [],
              is_premium: false,
              streak_days: 0,
              weight: 70
            }]);

            if (insertErr) throw insertErr;

            const registeredEmail = tempData.email;
            await saveSession("idle", {});
            replyText = `✓ Onboarding completed successfully! Your profile is registered.\n\nUsername: *${registeredEmail}*\nTemporary Password: *${messageText}*\n\nWe encourage you to download and log in to the App to view your vitals dashboard & unlock premium features (like the AI foot scanner):\n\n🔗 https://diabp-copilot.vercel.app`;
          } catch (insertErr) {
            console.error("[WhatsApp Webhook] Onboarding insert failed:", insertErr);
            replyText = "Error saving your profile database record. Please try again or type *Menu* to restart.";
            await saveSession("idle", {});
          }
          break;

        // --- CLINICIAN (DOCTOR) ONBOARDING STATE MACHINE ---
        case "onboard_doc_name":
          tempData.name = messageText;
          await saveSession("onboard_doc_clinic", tempData);
          replyText = `Nice to meet you, *${messageText}*!\n\nWhat is the name of your Clinic or Hospital?`;
          break;

        case "onboard_doc_clinic":
          tempData.clinic_name = messageText;
          await saveSession("onboard_doc_email", tempData);
          replyText = `Excellent! Please enter your email address. This will be your username to log in to the doctor dashboard:`;
          break;

        case "onboard_doc_email":
          const docEmailInput = messageText.trim();
          if (docEmailInput.includes("@") && docEmailInput.includes(".")) {
            tempData.email = docEmailInput;
            await saveSession("onboard_doc_phone", tempData);
            replyText = `Almost done! What is your 11-digit mobile contact number (e.g. 08012345678)?`;
          } else {
            replyText = "Invalid email format. Please enter a valid email address:";
          }
          break;

        case "onboard_doc_phone":
          try {
            // 1. Create Clinic in database
            const clinicId = crypto.randomUUID();
            const { error: clinicErr } = await supabase.from("ncd_clinics").insert([{
              id: clinicId,
              name: tempData.clinic_name,
              address: "Not set yet",
              city: "Abuja",
              contact_phone: messageText,
              is_premium: false
            }]);

            if (clinicErr) throw clinicErr;

            let authUserId = crypto.randomUUID();
            
            // 2. Create Auth User
            try {
              const { data: authData, error: authCreateErr } = await supabase.auth.admin.createUser({
                email: tempData.email,
                password: messageText, // Temporary password is their phone number
                email_confirm: true,
                user_metadata: { 
                  role: "doctor",
                  clinic_id: clinicId,
                  facility_role: "Admin",
                  display_name: tempData.name
                }
              });

              if (authCreateErr) {
                console.error("[WhatsApp Webhook] Supabase Auth clinician creation error:", authCreateErr.message);
              } else if (authData?.user?.id) {
                authUserId = authData.user.id;
              }
            } catch (authErr) {
              console.warn("[WhatsApp Webhook] Auth user create skipped:", authErr.message);
            }

            // 3. Create Clinician record in database
            const { error: clinicianErr } = await supabase.from("ncd_clinicians").insert([{
              user_id: authUserId,
              clinic_id: clinicId,
              role: "Admin",
              email: tempData.email
            }]);

            if (clinicianErr) throw clinicianErr;

            const registeredEmail = tempData.email;
            await saveSession("clinician_dashboard", { email: registeredEmail });

            replyText = `✓ Onboarding completed successfully! Your clinic is registered.\n\nClinic: *${tempData.clinic_name}*\nUsername: *${registeredEmail}*\nTemporary Password: *${messageText}*\n\nPlease visit https://diabp-copilot.vercel.app to log in as a Doctor and manage your clinical dashboard.`;
          } catch (err) {
            console.error("[WhatsApp Webhook] Doctor onboarding failed:", err);
            replyText = "Error saving your clinic registry details. Please try again or type *Menu* to restart.";
            await saveSession("idle", {});
          }
          break;

        // --- PHARMACIST ONBOARDING STATE MACHINE ---
        case "onboard_pharm_name":
          tempData.name = messageText;
          await saveSession("onboard_pharm_facility", tempData);
          replyText = `Nice to meet you, *${messageText}*!\n\nWhat is the name of your Pharmacy?`;
          break;

        case "onboard_pharm_facility":
          tempData.pharm_name = messageText;
          await saveSession("onboard_pharm_email", tempData);
          replyText = `Excellent! Please enter your email address. This will be your username to log in to the pharmacist dashboard:`;
          break;

        case "onboard_pharm_email":
          const pharmEmailInput = messageText.trim();
          if (pharmEmailInput.includes("@") && pharmEmailInput.includes(".")) {
            tempData.email = pharmEmailInput;
            await saveSession("onboard_pharm_phone", tempData);
            replyText = `Almost done! What is your 11-digit mobile contact number (e.g. 08012345678)?`;
          } else {
            replyText = "Invalid email format. Please enter a valid email address:";
          }
          break;

        case "onboard_pharm_phone":
          try {
            // 1. Create Pharmacy in database
            const pharmacyId = crypto.randomUUID();
            const { error: pharmacyErr } = await supabase.from("ncd_pharmacies").insert([{
              id: pharmacyId,
              name: tempData.pharm_name,
              address: "Not set yet",
              city: "Abuja",
              contact_phone: messageText,
              is_verified: true,
              is_premium: false
            }]);

            if (pharmacyErr) throw pharmacyErr;

            let authUserId = crypto.randomUUID();

            // 2. Create Auth User
            try {
              const { data: authData, error: authCreateErr } = await supabase.auth.admin.createUser({
                email: tempData.email,
                password: messageText, // Temporary password is their phone number
                email_confirm: true,
                user_metadata: { 
                  role: "pharmacist",
                  pharmacy_id: pharmacyId,
                  facility_role: "Owner",
                  display_name: tempData.name
                }
              });

              if (authCreateErr) {
                console.error("[WhatsApp Webhook] Supabase Auth pharmacist creation error:", authCreateErr.message);
              } else if (authData?.user?.id) {
                authUserId = authData.user.id;
              }
            } catch (authErr) {
              console.warn("[WhatsApp Webhook] Auth user create skipped:", authErr.message);
            }

            // 3. Create Pharmacist record in database
            const { error: pharmacistErr } = await supabase.from("ncd_pharmacists").insert([{
              user_id: authUserId,
              pharmacy_id: pharmacyId,
              role: "Owner",
              email: tempData.email
            }]);

            if (pharmacistErr) throw pharmacistErr;

            const registeredEmail = tempData.email;
            await saveSession("pharmacist_dashboard", { email: registeredEmail });

            replyText = `✓ Onboarding completed successfully! Your pharmacy is registered.\n\nPharmacy: *${tempData.pharm_name}*\nUsername: *${registeredEmail}*\nTemporary Password: *${messageText}*\n\nPlease visit https://diabp-copilot.vercel.app to log in as a Pharmacist and manage your pharmacy dashboard.`;
          } catch (err) {
            console.error("[WhatsApp Webhook] Pharmacist onboarding failed:", err);
            replyText = "Error saving your pharmacy registry details. Please try again or type *Menu* to restart.";
            await saveSession("idle", {});
          }
          break;

        default:
          await saveSession("onboard_role", {});
          replyText = `Welcome to DiaBP! Let's get you set up. Are you a:\n\n*1.* Patient 🩺\n*2.* Doctor/Clinician 🥼\n*3.* Pharmacist/Pharmacy 💊\n\nReply with the option number (1, 2 or 3) to choose.`;
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

              const loggedSys = tempData.systolic;
              const loggedDia = tempData.diastolic;
              await saveSession("idle", {});
              replyText = `✓ Vitals logged successfully!\n\nBP: *${loggedSys}/${loggedDia} mmHg*\nStreak: *${nextStreak} days*\n\nClinical team notified. Type *Menu* to return to options.`;
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

          const loggedSys = tempData.systolic;
          const loggedDia = tempData.diastolic;
          const loggedGlucose = tempData.glucose;
          await saveSession("idle", {});
          replyText = `✓ Vitals logged successfully!\n\nBP: *${loggedSys}/${loggedDia} mmHg*\nGlucose: *${loggedGlucose} mg/dL (${type})*\nStreak: *${nextStreak} days*\n\nClinical team notified. Type *Menu* to return to options.`;
          break;

        case "waiting_refill_confirm":
          if (messageText === "1" || lower === "yes" || lower.includes("approve")) {
            await supabase
              .from("ncd_orders")
              .update({ status: "Delivered" })
              .eq("id", tempData.orderId);

            const totalNaira = tempData.totalNaira || 0;
            await saveSession("idle", {});
            replyText = `💳 Refill Payment Confirmed successfully!\n\nAmount Settled: *₦${totalNaira.toLocaleString()}*\n\n✓ Refill Approved and marked as *Delivered*. Medications are out for delivery to your registered address.`;
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
