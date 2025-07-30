import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest";
import { createClient } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
});

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized request or Token Expired" },
      { status: 401 }
    );
  }

  const { priceId, tier } = await req.json();
    const supabase = createClient();

  // try {

  //   const { data, error } = await supabase
  //     .from("subscriptions")
  //     .select("*")
  //     .eq("user_id", userId)
  //     .eq("tier", "premium")
  //     .eq("status", "active")
  //     .maybeSingle(); // safer than `.single()` when multiple rows are possible

  //   let hasActiveSubscription = false;

  //   if (data?.stripe_subscription_id) {
  //     const session = await stripe.checkout.sessions.retrieve(
  //       data.stripe_subscription_id
  //     );

  //     if (session.customer) {
  //       const subscriptions = await stripe.subscriptions.list({
  //         customer: session.customer.toString(),
  //         status: "all",
  //       });

  //       hasActiveSubscription = subscriptions.data.some((sub) =>
  //         ["active", "trialing"].includes(sub.status)
  //       );
  //     }
  //   }

  //   if (hasActiveSubscription) {
  //     return NextResponse.json(
  //       { message: "Subscription already active" },
  //       { status: 200 }
  //     );
  //   }

  //   // If not already subscribed — create new checkout session
  //   const checkoutSession = await stripe.checkout.sessions.create({
  //     mode: "subscription",
  //     line_items: [{ price: priceId, quantity: 1 }],
  //     payment_method_types: ["card"],
  //     success_url: `mysolomate://success?session_id={CHECKOUT_SESSION_ID}`,
  //     cancel_url: "mysolomate://cancel",
  //     metadata: { userId, tier },
  //   });

  //   return NextResponse.json({ url: checkoutSession.url }, { status: 200 });

  // } catch (error: any) {
  //   console.error("Stripe Checkout Error:", error);
  //   return NextResponse.json({ error: error.message }, { status: 500 });
  // }

  try {
    if (tier === "add_on") {
      // Independent one-time purchase (e.g., talk time)
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        payment_method_types: ["card"],
        success_url: `mysolomate://success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: "mysolomate://cancel",
        metadata: { userId, tier },
      });

      return NextResponse.json({ url: session.url }, { status: 200 });
    }

    // Handle Silver/Gold subscriptions
    const { data: existingSub, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .in("tier", ["silver", "premium"])
      .eq("status", "active")
      .maybeSingle();

    if (existingSub?.stripe_subscription_id) {
      const stripeSub = await stripe.subscriptions.retrieve(
        existingSub.stripe_subscription_id
      );

      const currentItemId = stripeSub.items.data[0]?.id;

      if (!currentItemId) {
        throw new Error("No subscription item found.");
      }

      // Update the subscription (upgrade/downgrade)
      const updatedSub = await stripe.subscriptions.update(stripeSub.id, {
        items: [
          {
            id: currentItemId,
            price: priceId,
          },
        ],
        metadata: {
          userId,
          tier,
        },
        proration_behavior: "create_prorations",
      });

      // Update Supabase record
      await supabase
        .from("subscriptions")
        .update({ tier, talk_seconds_remaining: tier === "silver" ? 30 : 60  })
        .eq("id", existingSub.id);

      return NextResponse.json(
        { message: "Subscription plan update successfully", subscriptionId: updatedSub.id },
        { status: 200 }
      );
    }

    // No existing subscription — create new one
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: ["card"],
      success_url: `mysolomate://success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: "mysolomate://cancel",
      metadata: { userId, tier },
    });

    return NextResponse.json({ url: checkoutSession.url }, { status: 200 });

  } catch (error: any) {
    console.error("Stripe Subscription Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
