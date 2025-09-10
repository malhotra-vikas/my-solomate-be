import { getUserIdFromRequest } from "@/lib/extractUserFromRequest";
import { queueNotificationToSQS } from "@/lib/notifications";
import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

const allowedOrigin = "*";

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized request or Token Expired" },
        { status: 401 }
      );
    }
    queueNotificationToSQS({
        userId: userId,
        title: "SoloMate Talk Time running out",
        body: "recharge or purchase a subscription",
        type: "NEW_FEATURE_EVENT",
        data: {
          screen: "SubscriptionPlan",
        },
        sendAt: new Date().toISOString() // Send immediately
      })

      return NextResponse.json(
        { message: "send successfully" },
        { status: 200 }
      );

  } catch (error: any) {
    console.log("🚀 ~ POST ~ error:", error);
    return corsResponse(
      NextResponse.json({ error: error.message }, { status: 500 })
    );
  }
}

export async function OPTIONS() {
  return corsResponse(new Response(null, { status: 204 }));
}

// Utility to add CORS headers
function corsResponse(res: Response) {
  res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  return res;
}
