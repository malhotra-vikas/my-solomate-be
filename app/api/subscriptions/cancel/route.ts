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

  const { stripeSubscriptionId, id, originalTransactionId } = await req.json();
  const supabase = createClient();

  try {
    if (stripeSubscriptionId && userId) {
      const { error: deleteError } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("original_transaction_id", originalTransactionId)
        .eq("iap_product_id", stripeSubscriptionId);

      if (deleteError) {
        console.error("Supabase update error:", deleteError);
        return NextResponse.json(
          { error: "DB update failed" },
          { status: 500 }
        );
      }
      return NextResponse.json({
        message: "Subscription cancelled successfully",
      });
    }

    // Case 2: If stripeSubscriptionId and id are NOT provided, cancel all active subscriptions for this user
    const { data: activeSubs, error: fetchError } = await supabase
      .from("subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("status", "active");

    if (fetchError) {
      console.error("Failed to fetch active subscriptions:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch subscriptions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Active subscriptions cancelled and deleted",
      cancelled: { id: id, deleted: true },
    });
  } catch (error: any) {
    console.error("Stripe Cancel Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
