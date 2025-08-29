import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { createClient } from "@/lib/supabase";
import { queueNotificationToSQS } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const notification = await req.json();
    const signedPayload = notification.signedPayload;
    
    const decoded = jwt.decode(signedPayload, { complete: true });
    const originalTransitionId = jwt.decode(decoded?.payload?.data?.signedTransactionInfo, { complete: true });

    const supabase = createClient();

    if (!!decoded?.payload) {
      if (decoded?.payload?.notificationType === "DID_RENEW") {
        const { data, error: deleteError } = await supabase
          .from("subscriptions")
          .select("*")
          .eq(
            "original_transaction_id",
            originalTransitionId?.payload?.originalTransactionId
          )
          .eq("iap_product_id", originalTransitionId?.payload?.productId)
          .eq("status", "active");

        console.log("🚀 ~ POST ~ data:", data);

        const notifications = data?.map(({ user_id, tier }) =>
          queueNotificationToSQS({
            userId: user_id,
            title: `Subscription Renewed`,
            body: `Your ${tier} subscription plan has been successfully renewed.`,
            type: "SUBSCRIPTION_RENEW_EVENT",
            data: {
              screen: "BillingScreen", // or "BillingHistory" depending on UX
            },
            sendAt: new Date().toISOString(), // Send immediately
          })
        );
        console.log("🚀 ~ POST ~ notifications:", notifications)
      } else if (decoded?.payload?.notificationType === "EXPIRED") {
        const { error: deleteError } = await supabase
          .from("subscriptions")
          .update({ status: "cancelled", talk_seconds_remaining: 0 })
          .eq(
            "original_transaction_id",
            originalTransitionId?.payload?.originalTransactionId
          )
          .eq("iap_product_id", originalTransitionId?.payload?.productId);

        if (deleteError) {
          console.error(`Failed to cancel subscription ID`, deleteError);
        }
      } else if (
        decoded?.payload?.notificationType === "DID_CHANGE_RENEWAL_STATUS"
      ) {
        const { error: deleteError } = await supabase
          .from("subscriptions")
          .update({ is_canceled: true })
          .eq(
            "original_transaction_id",
            originalTransitionId?.payload?.originalTransactionId
          )
          .eq("iap_product_id", originalTransitionId?.payload?.productId);

        if (deleteError) {
          console.error(`Failed to cancel subscription ID `, deleteError);
        }
      }
    }


    return NextResponse.json(
      { message: "fetch successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Apple webhook error", error.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
