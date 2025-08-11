import { createClient } from "@supabase/supabase-js"

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Talk time limits for each tier
const RESET_LIMITS = {
    free: 900,
    silver: 1800,
    premium: 3600
}

export async function handler(event, context) {
    console.log("🚀 Midnight Reset Lambda Invoked")

    const { data: subscriptions, error } = await supabase
        .from("subscriptions")
        .select("id, tier")
        .eq("status", "active")
        .in("tier", Object.keys(RESET_LIMITS))

    if (error) {
        console.error("❌ Failed to fetch subscriptions:", error.message)
        return {
            statusCode: 500,
            body: "Failed to fetch subscriptions"
        }
    }

    const updates = subscriptions.map(sub => {
        const newSeconds = RESET_LIMITS[sub.tier]
        return supabase
            .from("subscriptions")
            .update({ talk_seconds_remaining: newSeconds })
            .eq("id", sub.id)
    })

    await Promise.all(updates)

    console.log(`✅ Reset ${subscriptions.length} subscriptions`)
    return {
        statusCode: 200,
        body: `Reset ${subscriptions.length} subscriptions`
    }
}
