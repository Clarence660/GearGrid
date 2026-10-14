import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 3-month plan. Amount is in centavos: PHP 299.00 = 29900
const PLAN_AMOUNT_CENTAVOS = 29900;
const PLAN_MONTHS = 3;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Who is calling? (verify_jwt is false, so we check ourselves.)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    // 2. Create the PayMongo Checkout Session.
    const secretKey = Deno.env.get("PAYMONGO_SECRET_KEY");
    if (!secretKey) return json({ error: "Payment service is not configured" }, 500);

    const origin = req.headers.get("origin") || "https://geargrid.vercel.app";

    const pmRes = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${secretKey}:`)}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                currency: "PHP",
                amount: PLAN_AMOUNT_CENTAVOS,
                name: `GearGrid owner subscription (${PLAN_MONTHS} months)`,
                quantity: 1,
              },
            ],
            payment_method_types: ["gcash", "paymaya", "card"],
            description: `GearGrid owner subscription, ${PLAN_MONTHS} months`,
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            reference_number: user.id,
            success_url: `${origin}/profile?subscription=success`,
            cancel_url: `${origin}/profile?subscription=cancelled`,
            metadata: { user_id: user.id },
          },
        },
      }),
    });

    const pmJson = await pmRes.json();
    if (!pmRes.ok) {
      console.error("PayMongo error:", JSON.stringify(pmJson));
      return json({ error: "Couldn't start checkout. Please try again." }, 502);
    }

    const sessionId: string = pmJson.data.id;
    const checkoutUrl: string = pmJson.data.attributes.checkout_url;

    // 3. Record the pending payment (the webhook looks it up by session id).
    const { error: insertError } = await supabaseAdmin.from("subscription_payments").insert({
      user_id: user.id,
      paymongo_checkout_session_id: sessionId,
      amount_centavos: PLAN_AMOUNT_CENTAVOS,
      months: PLAN_MONTHS,
      status: "pending",
    });
    if (insertError) {
      console.error("Failed to record pending payment:", insertError.message);
      return json({ error: "Couldn't start checkout. Please try again." }, 500);
    }

    return json({ checkout_url: checkoutUrl });
  } catch (err) {
    console.error(err);
    return json({ error: "Unexpected error starting checkout." }, 500);
  }
});