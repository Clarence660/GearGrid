import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET")!;

const enc = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Header looks like: t=1496734173,te=<test sig>,li=<live sig>
async function verifySignature(header: string | null, rawBody: string, livemode: boolean) {
  if (!header) return false;
  const parts: Record<string, string> = {};
  for (const piece of header.split(",")) {
    const [k, v] = piece.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const expected = await hmacHex(webhookSecret, `${parts.t}.${rawBody}`);
  const provided = livemode ? parts.li : parts.te;
  return Boolean(provided) && safeEqual(expected, provided);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const attrs = event?.data?.attributes;
  const livemode = Boolean(attrs?.livemode);

  const ok = await verifySignature(req.headers.get("Paymongo-Signature"), rawBody, livemode);
  if (!ok) return new Response("Invalid signature", { status: 400 });

  if (attrs?.type === "checkout_session.payment.paid") {
    const session = attrs.data;
    const sessionId: string | undefined = session?.id;
    const paymentId: string | undefined = session?.attributes?.payments?.[0]?.id;

    if (sessionId) {
      const { error } = await supabaseAdmin.rpc("apply_subscription_payment", {
        p_checkout_session_id: sessionId,
        p_payment_id: paymentId ?? null,
      });

      if (error) {
        console.error("apply_subscription_payment failed:", sessionId, error.message);
        // Non-2xx makes PayMongo retry; the function is idempotent so that's safe.
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});