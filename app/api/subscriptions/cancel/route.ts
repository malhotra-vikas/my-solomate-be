import { getUserIdFromRequest } from "@/lib/extractUserFromRequest";
import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

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

  const { stripeSubscriptionId } = await req.json();
  const supabase = createClient();

  try {
    if (stripeSubscriptionId && userId) {
      const canceledSub = await stripe.subscriptions.cancel(stripeSubscriptionId);
      console.log("Stripe subscription cancelled:", canceledSub);

      const { error: dbError, data: dbUpdateData } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled", subscription_end_date: new Date().toISOString() })
        .eq("id", userId);

      if (dbError) {
        console.error("Supabase update error:", dbError);
        return NextResponse.json({ error: "DB update failed" }, { status: 500 });
      }

      return NextResponse.json({
        message: "Subscription cancelled successfully",
        dbUpdateData,
      });
    }

    // Case 2: If stripeSubscriptionId and id are NOT provided, cancel all active subscriptions for this user
    const { data: activeSubs, error: fetchError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active");

    if (fetchError) {
      console.error("Failed to fetch active subscriptions:", fetchError);
      return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
    }

    if (!activeSubs || activeSubs.length === 0) {
      return NextResponse.json({
        message: "No active subscriptions found for this user.",
      });
    }

    const cancelledResults = [];

    for (const sub of activeSubs) {
      try {
        if (sub.tier !== "add_on") {
          await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        }

        const { error: deleteError } = await supabase
          .from("subscriptions")
          .delete()
          .eq("id", sub.id);

        if (deleteError) {
          console.error(`Failed to delete sub ID ${sub.id}:`, deleteError);
        } else {
          cancelledResults.push({ id: sub.id, deleted: true });
        }
      } catch (stripeError: any) {
        console.error(`Stripe cancel error for ${sub.stripe_subscription_id}:`, stripeError.message);
      }
    }

    return NextResponse.json({
      message: "Active subscriptions cancelled and deleted",
      cancelled: cancelledResults,
    });
  } catch (error: any) {
    console.error("Stripe Cancel Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
