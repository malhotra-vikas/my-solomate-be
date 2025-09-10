import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest";
import { createClient } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});


const getPriceId = async (productId: string, unitAmountDollars: number) => {
  console.log("🚀 ~ getPriceId ~ unitAmountDollars:", unitAmountDollars)
  const unitAmount = Math.round(unitAmountDollars * 100); // convert to cents
  console.log("🚀 ~ getPriceId ~ unitAmount:", unitAmount)

  const prices = await stripe.prices.list({
    product: productId,
    limit: 100,
  });

  console.log("🚀 ~ getPriceId ~ prices:", prices)

  // 2. Look for a matching price
  const existingPrice = prices.data.find((price) =>
    price.unit_amount === unitAmount &&
    price.currency === "usd"
  );

  if (existingPrice) {
    return {
      price: existingPrice,
      created: false,
    };
  }

  // 3. Create new price
  const newPrice = await stripe.prices.create({
    product: productId,
    unit_amount: unitAmount,
    currency: "usd",
  });

  return {
    price: newPrice,
    created: true,
  };

}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized request or Token Expired" },
      { status: 401 }
    );
  }

  const { priceId, tier, email, totalAmount } = await req.json();
    const supabase = createClient();

  try {
    if (tier === "add_on") {
      // Independent one-time purchase (e.g., talk time)
      const priceResponse = await getPriceId("prod_SljXriJ5NWz3oo", totalAmount)
      console.log("🚀 ~ POST ~ priceResponse:", priceResponse);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: priceResponse?.price.id, quantity: 1 }],
        payment_method_types: ["card"],
        success_url: `mysolomate://success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: "mysolomate://cancel",
        metadata: { userId, tier, totalMinute: (+totalAmount / 0.99) },
        customer_email: email,
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
        .update({ tier, talk_seconds_remaining: tier === "silver" ? (30 * 60) : (60 * 60)  })
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
      customer_email: email,
    });

    return NextResponse.json({ url: checkoutSession.url }, { status: 200 });

  } catch (error: any) {
    console.error("Stripe Subscription Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
