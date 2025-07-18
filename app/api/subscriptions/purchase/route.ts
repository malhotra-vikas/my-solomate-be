import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { auth } from "@/lib/firebaseAdmin"
// import Stripe from 'stripe' // Uncomment if you install stripe

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: '2024-04-10', // Use your desired API version
// });

// Helper to get user ID from Authorization header
async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }
  const idToken = authHeader.split(" ")[1]
  try {
    const decodedToken = await auth.verifyIdToken(idToken)
    return decodedToken.uid
  } catch (error) {
    console.error("Error verifying ID token:", error)
    return null
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { tier, minutes, priceId } = await req.json() // priceId for Stripe

    // This is a simplified example. In a real app, you'd create a Stripe Checkout Session.
    // const session = await stripe.checkout.sessions.create({
    //   payment_method_types: ['card'],
    //   line_items: [{
    //     price: priceId, // Stripe Price ID for the product/tier
    //     quantity: 1,
    //   }],
    //   mode: tier === 'add_on' ? 'payment' : 'subscription',
    //   success_url: `${req.nextUrl.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    //   cancel_url: `${req.nextUrl.origin}/cancel`,
    //   client_reference_id: userId, // Link to your user
    //   metadata: {
    //     tier: tier,
    //     minutes: minutes,
    //   },
    // });

    // For now, simulate direct update (REMOVE IN PRODUCTION)
    const updateData: any = { current_tier: tier }
    const subscriptionData: any = { user_id: userId, tier: tier, status: "active" }
    const supabase = createClient()

    if (tier === "add_on") {
      updateData.talk_time_minutes =
        (await supabase.from("users").select("talk_time_minutes").eq("id", userId).single()).data?.talk_time_minutes +
        minutes
      updateData.talk_time_expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Expires in 30 days
      subscriptionData.minutes_purchased = minutes
      subscriptionData.minutes_remaining = minutes
      subscriptionData.end_date = updateData.talk_time_expires_at
    } else {
      // For premium/silver, set minutes based on tier and reset expiry
      const tierMinutes = tier === "premium" ? 60 : 120
      updateData.talk_time_minutes = tierMinutes
      updateData.talk_time_expires_at = null // Recurring subscription, no fixed expiry for minutes
      subscriptionData.start_date = new Date().toISOString()
      // subscriptionData.stripe_subscription_id = session.id; // Link to Stripe subscription
    }

    const { error: userUpdateError } = await supabase.from("users").update(updateData).eq("id", userId)

    if (userUpdateError) {
      console.error("Error updating user tier:", userUpdateError)
      return NextResponse.json({ error: "Failed to update user tier" }, { status: 500 })
    }

    const { error: subInsertError } = await supabase.from("subscriptions").insert(subscriptionData)

    if (subInsertError) {
      console.error("Error inserting subscription record:", subInsertError)
      return NextResponse.json({ error: "Failed to record subscription" }, { status: 500 })
    }

    return NextResponse.json(
      {
        message: "Purchase simulated successfully. In production, redirect to Stripe Checkout.",
        // checkoutUrl: session.url, // Uncomment in production
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("Purchase error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
