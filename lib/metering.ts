import { createClient } from "@/lib/supabase"

export async function getActiveTalkTimeForUser(userId: string) {
    const supabase = createClient()

    const { data: subs, error } = await supabase
        .from("subscriptions")
        .select("id, tier, talk_seconds_remaining")
        .eq("user_id", userId)
        .eq("status", "active")

    if (error) throw new Error("Failed to fetch subscriptions")

    const hasPremium = subs.some(s =>
        ["silver", "premium", "gold", "platinum"].includes(s.tier)
    )

    const filteredSubs = subs.filter(sub => {
        if ((sub.talk_seconds_remaining ?? 0) <= 0) return false
        if (hasPremium && sub.tier === "free") return false
        return true
    })

    // breakdown: { uniqueKey: { subscription_id, tier, seconds } }
    const breakdown: Record<string, { subscription_id: string; tier: string; seconds: number }> = {}

    for (const sub of filteredSubs) {
        const key = sub.tier === "add_on" ? `${sub.tier}_${sub.id}` : sub.tier

        breakdown[key] = {
            subscription_id: sub.id,
            tier: sub.tier,
            seconds: sub.talk_seconds_remaining ?? 0
        }
    }

    const total = Object.values(breakdown).reduce((sum, b) => sum + b.seconds, 0)

    return {
        totalTalkSeconds: total,
        breakdown
    }
}
