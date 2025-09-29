import { createClient } from "@/lib/supabase";
import { UserProfile } from "@/types";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, name, id, photoUrl } = await req.json();
    const supabase = createClient();

    // 1. Check if user already exists
    const { data: existData, error: existError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle(); // safer than .single()

    if (existError) {
      console.error("Error checking existing user:", existError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (existData) {
      if (existData?.status === "Deleted") {
        return NextResponse.json(
          { error: { message: "This account has been deactivated" } },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          message: "User already exists",
          user: existData as UserProfile,
        },
        { status: 200 }
      );
    }

    // 2. Store new user profile
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        id,
        email,
        name,
        photo_url: photoUrl,
      })
      .select()
      .maybeSingle();

    if (insertError || !newUser) {
      console.error("Supabase user creation error:", insertError);
      return NextResponse.json(
        { error: "Failed to create user profile" },
        { status: 500 }
      );
    }

    console.log("🔁 Inserted into Supabase:", newUser);

    // 3. Store user subscription
    const { data: subData, error: subError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: id,
      })
      .select()
      .maybeSingle();

    if (subError || !subData) {
      console.error("Supabase subscription creation error:", subError);
      // optional rollback of user insert could go here
      return NextResponse.json(
        { error: "Failed to create subscription" },
        { status: 500 }
      );
    }

    console.log("🔁 Inserted into Supabase Subscriptions:", subData);

    return NextResponse.json(
      {
        message: "User signed up successfully",
        user: newUser as UserProfile,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Signup error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
