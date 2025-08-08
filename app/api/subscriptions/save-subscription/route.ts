import { getUserIdFromRequest } from "@/lib/extractUserFromRequest";
import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function formatToSupabaseTimestamp(date: Date): string {
  const iso = date.toISOString(); // Example: "2025-07-25T07:22:51.468Z"
  const [full, millis] = iso.split(".");
  const [seconds, _] = millis.split("Z");

  // Pad to microseconds if needed
  const paddedMillis = seconds.padEnd(6, "0");

  return `${full.replace("T", " ")}.${paddedMillis}+00`;
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized request or Token Expired" },
      { status: 401 }
    );
  }

  try {
    const { stripeSubscriptionId } = await req.json();
    if (!stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Strip subscription id required" },
        { status: 400 }
      );
    }
    const session =
      await stripe.checkout.sessions.retrieve(stripeSubscriptionId);
    console.log("🚀 ~ POST ~ session:", session);

    const tier = session?.metadata?.tier;
    const addonMinute = session?.metadata?.totalMinute ? +session?.metadata?.totalMinute : 1
    const supabase = createClient();

    let insertData: any = {
      user_id: userId,
      tier,
      status: "active",
      stripe_subscription_id: null,
      talk_seconds_remaining:
        tier === "premium" ? (60 * 60) : tier === "silver" ? (30 * 60) : (addonMinute * 60),
      addon_seconds_remaining: tier === "add_on" ? (addonMinute * 60) : null
    };

    if (tier === "add_on") {
      // For one-time purchase, store payment_intent instead of subscription
      insertData.stripe_subscription_id = session.payment_intent;
    } else if (session.subscription) {
      const subscriptionId = session.subscription as string;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
      const endData = subscription.items.data.find(
        (item) => item.subscription === subscriptionId
      );
    
      const formattedStartDate = formatToSupabaseTimestamp(
        new Date(endData?.current_period_end! * 1000)
      );
    
      insertData.stripe_subscription_id = subscriptionId;
      insertData.subscription_end_date = formattedStartDate;
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Error Save subscription:", error);
      return NextResponse.json(
        { error: "Failed to save subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Subscription data saved successfully!" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Register device error:", error.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
