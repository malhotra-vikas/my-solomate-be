import { createClient } from "@/lib/supabase";
import { UserProfile } from "@/types";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, name, id, photoUrl } = await req.json();

    const supabase = createClient();

    const { data: existData, error: existDataError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single(); // because email should be unique

    if (existData) {
      return NextResponse.json(
        {
          message: "User already exists",
          user: existData as UserProfile,
        },
        { status: 200 }
      );
    }

    // 2. Store user profile in Supabase
    const { data, error } = await supabase
      .from("users")
      .insert({
        id,
        email: email,
        name: name,
        photo_url: photoUrl,
        current_tier: "free",
        talk_time_minutes: 15, // Free tier daily minutes
        talk_time_expires_at: new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ).toISOString(), // Expires in 24 hours
      })
      .select()
      .single();

    console.log("🔁 Inserted into Supabase:", data, "Error:", error);

    if (error) {
      // If Supabase insertion fails, delete Firebase user to prevent orphaned accounts
      //   await auth.deleteUser(userRecord.uid);
      console.error("Supabase user creation error:", error);
      return NextResponse.json(
        { error: "Failed to create user profile" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "User signed up successfully",
        user: data as UserProfile,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Signup error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
