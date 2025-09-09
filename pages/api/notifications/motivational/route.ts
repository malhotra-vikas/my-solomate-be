export const dynamic = "force-dynamic"

import { queueNotificationToSQS } from "@/lib/notifications";
import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

const allowedOrigin = "*"; 

export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();
        const { title, body, selectedScreen } = await req.json()

        const { data: allUsers, error } = await supabase
        .from("users")
        .select("id")

      if (error || !allUsers) {
        console.error("Failed to fetch users:", error)
        return
      }

      console.log("Need to send notifications to :", allUsers.length, " users. ")

      const notifications = allUsers.map(({ id }) =>
       queueNotificationToSQS({
        userId: '106563909011843313243',
        title: title,
        body: body,
        type: "NEW_FEATURE_EVENT",
        data: {
          screen: selectedScreen,
        },
        sendAt: new Date().toISOString() // Send immediately
      })
      )

      const results = await Promise.allSettled(notifications)
      console.log("Queued notifications:", results.length, "results")

      const failures = results.filter(r => r.status === "rejected")
      if (failures.length > 0) {
        console.warn(`⚠️ ${failures.length} notifications failed`)
      }
      return corsResponse(NextResponse.json({ message: "Notification sent successfully" }, { status: 201 }));
    } catch (error: any) {
        console.log("🚀 ~ POST ~ error:", error)
        return corsResponse(NextResponse.json({ error: error.message }, { status: 500 }))
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