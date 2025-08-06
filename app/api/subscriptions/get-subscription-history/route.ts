import { getUserIdFromRequest } from "@/lib/extractUserFromRequest";
import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized request or Token Expired" },
      { status: 401 }
    );
  }

  try {
    const supabase = createClient();

    const { data: subscriptions, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .neq("tier", "free")
      .order("subscription_start_date", { ascending: false });

    if (error || !subscriptions) {
      return NextResponse.json(
        { error: "Subscription History was not found" },
        { status: 401 }
      );
    }

    const enriched = await Promise.all(
      subscriptions.map(async (sub) => {
        if (!sub.stripe_subscription_id || sub.tier === "free") {
          return {
            ...sub,
            price: 0,
            currency: "USD",
          };
        }

        try {
          if (sub.tier === "add_on" && sub.stripe_payment_id) {
            const paymentIntent = await stripe.paymentIntents.retrieve(sub.stripe_payment_id);
            console.log("🚀 ~ GET ~ paymentIntent:", paymentIntent)
            return {
              ...sub,
              price: (paymentIntent.amount_received ?? 0) / 100,
              currency: paymentIntent.currency?.toUpperCase() ?? "USD",
            };
          }
          
          const stripeSub = await stripe.subscriptions.retrieve(
            sub.stripe_subscription_id
          );

          const price = stripeSub.items?.data[0]?.price;
          const amount = price?.unit_amount ?? 0;
          const currency = price?.currency?.toUpperCase() ?? "USD";

          return {
            ...sub,
            price: amount / 100,
            currency,
          };
        } catch (err) {
          console.error("Stripe subscription fetch failed:", err);
          return {
            ...sub,
            price: null,
            currency: null,
          };
        }
      })
    );

    return NextResponse.json({data: enriched}, { status: 200 });
  } catch (error) {
    console.error("Error while getting subscription history:", error?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
