import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { transaction_id } = await req.json();

    if (!transaction_id) {
      return new Response(JSON.stringify({ error: "Missing transaction_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: transaction, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("id, owner_id, status, meetup_confirmed, transaction_type, equipment_id")
      .eq("id", transaction_id)
      .single();

    if (txError || !transaction) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (transaction.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Only the owner of this transaction can confirm the meetup" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pay-at-meetup model: there is no "paid" status anymore. Once the owner has
    // approved the request, the meetup (and payment, handled directly between
    // buyer and owner) can be confirmed at any time.
    if (transaction.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "This request hasn't been approved yet, so there's nothing to confirm." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (transaction.meetup_confirmed) {
      return new Response(JSON.stringify({ success: true, alreadyConfirmed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("transactions")
      .update({
        meetup_confirmed: true,
        meetup_confirmed_at: new Date().toISOString(),
      })
      .eq("id", transaction_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // A confirmed meetup for a "buy" transaction is the moment the item actually
    // changes hands — this now replaces the old webhook-driven is_sold flip.
    if (transaction.transaction_type === "buy") {
      const { error: soldError } = await supabaseAdmin
        .from("equipment")
        .update({ is_sold: true })
        .eq("id", transaction.equipment_id);

      if (soldError) {
        console.error("Meetup confirmed but failed to mark equipment sold:", transaction.equipment_id, soldError.message);
        return new Response(
          JSON.stringify({
            success: true,
            warning: "Meetup confirmed, but the item couldn't be marked as sold automatically. An admin may need to fix this manually.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});