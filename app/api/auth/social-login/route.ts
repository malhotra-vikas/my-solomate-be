import { createClient } from "@/lib/supabase";
import { UserProfile } from "@/types";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, name, id, photoUrl } = await req.json();

    console.log("🚀 ~ POST ~ email, name, id, photoUrl:", email, name, id, photoUrl)
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

    // 3. Store user subscription in Supabase
    const { data: subData, error: subError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: id,
      })
      .select()
      .single()

    console.log("🔁 Inserted into Supabase Subscriptions:", subData, "Error:", subError)


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
