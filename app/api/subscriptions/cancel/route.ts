import { getUserIdFromRequest } from "@/lib/extractUserFromRequest";
import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

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

  const { stripeSubscriptionId, id } = await req.json();
  const supabase = createClient();

  try {
    const session =
      await stripe.checkout.sessions.retrieve(stripeSubscriptionId);
    console.log("Retrieved session:", session);

    const subscriptionId = session.subscription;

    if (!subscriptionId || typeof subscriptionId !== "string") {
      throw new Error("No subscription found in session");
    }

    const canceledSub = await stripe.subscriptions.cancel(subscriptionId);
    console.log("Stripe subscription updated:", canceledSub);

    const { error: dbError, data: dbUpdateData } = await supabase
      .from("subscriptions")
      .update({ status: "cancelled", subscription_end_date: new Date().toISOString() })
      .eq("id", id);

    if (dbError) {
      console.error("Supabase update error:", dbError);
      return NextResponse.json({ error: "DB update failed" }, { status: 500 });
    }

    return NextResponse.json({
      message: "Subscription cancelled successfully",
      dbUpdateData,
    });
  } catch (error: any) {
    console.error("Stripe Cancel Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
