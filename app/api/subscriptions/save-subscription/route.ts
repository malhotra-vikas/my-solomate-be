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
    const { productId, tier, addonMinute } = await req.json();

    if (!productId || !tier) {
      return NextResponse.json(
        { error: "productId and tier are required" },
        { status: 400 }
      );
    }

    // const session =
    //   await stripe.checkout.sessions.retrieve(productId);
    // console.log("🚀 ~ POST ~ session:", session);

    // const tier = session?.metadata?.tier;
    // const addonMinute = session?.metadata?.totalMinute ? +session?.metadata?.totalMinute : 1
    const supabase = createClient();

    let insertData: any = {
      user_id: userId,
      tier,
      status: "active",
      iap_product_id: productId,
      talk_seconds_remaining:
        tier === "premium"
          ? 60 * 60
          : tier === "silver"
            ? 30 * 60
            : +(addonMinute * 60).toFixed(),
    };

    if (tier !== "add_on") {
      const now = new Date();
      const oneMonthLater = new Date(now.setMonth(now.getMonth() + 1));
      insertData.subscription_end_date =
        formatToSupabaseTimestamp(oneMonthLater);

      const { data: existingSub, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .in("tier", ["silver", "premium"])
        .eq("status", "active")
        .maybeSingle();

      if (existingSub?.iap_product_id) {
        if (!existingSub?.iap_product_id) {
          throw new Error("No subscription item found.");
        }

        // Update Supabase record
        try {
          const { data, error: newRecError } = await supabase
            .from("subscriptions")
            .update({
              tier,
              talk_seconds_remaining: tier === "silver" ? 30 * 60 : 60 * 60,
              iap_product_id: productId,
            })
            .eq("id", existingSub.id)
            .select()
            .single();

          return NextResponse.json(
            { message: "Subscription plan update successfully", data },
            { status: 200 }
          );
        } catch (error) {
          console.log("🚀 ~ POST ~ error:", error);
        }
      }
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
      {data: data.tier === 'add_on' ? {...data, addonMinute: +addonMinute.toFixed()} : data, message: "Subscription data saved successfully!" },
      { status: 200 }
    );
 
  } catch (error: any) {
    console.error("Save subscription error:", error.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
