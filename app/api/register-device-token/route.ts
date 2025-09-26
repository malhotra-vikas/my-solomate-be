import { getUserIdFromRequest } from "@/lib/extractUserFromRequest";
import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized request or Token Expired" },
      { status: 401 }
    );
  }

  try {
    const { deviceToken, platform } = await req.json();

    if (!deviceToken) {
      return NextResponse.json(
        { error: "Device token is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data: existingRecord, error: fetchError } = await supabase
      .from("device_tokens")
      .select("*")
      .eq("user_id", userId)
      .eq("token", deviceToken)
      .maybeSingle(); // allows for null if not found

    if (fetchError) {
      console.error("Supabase fetch error:", fetchError.message);
      return NextResponse.json(
        { error: "Failed to check existing device token" },
        { status: 500 }
      );
    }

    if (existingRecord) {
      // Token already exists, return success without inserting
      return NextResponse.json({
        message: "Device token already registered",
      });
    }

    const { data, error } = await supabase
    .from("device_tokens")
    .upsert(
      {
        user_id: userId,
        token: deviceToken,
        platform: platform,
      },
    //   { onConflict: "user_id" } // assumes user_id is unique or primary
    )
    .select()
    .maybeSingle();

    if (error) {
        console.error("Supabase error:", error.message);
        return NextResponse.json(
          { error: "Failed to register device token" },
          { status: 500 }
        );
      }

      if (!data) {
        console.error("Supabase upsert returned no row for device token registration");
        return NextResponse.json(
          { error: "Failed to register device token" },
          { status: 500 }
        );
      }

      return NextResponse.json({ message: "Device token registered", data });

  } catch (error: any) {
    console.error("Register device error:", error.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
