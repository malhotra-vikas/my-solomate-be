export const dynamic = "force-dynamic"

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"
import { getActiveTalkTimeForUser } from "@/lib/metering"

const TIER_PRIORITY = {
    premiumUser: ["silver", "premium", "gold", "platinum", "add_on"],
    freeUser: ["free", "add_on"],
}

export async function POST(req: NextRequest) {
    const userId = await getUserIdFromRequest(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { secondsToDeduct } = await req.json()
    if (!secondsToDeduct || secondsToDeduct < 0) {
        return NextResponse.json({ error: "Invalid secondsToDeduct" }, { status: 400 })
    }

    const supabase = createClient()

    const { data: subscriptions, error } = await supabase
        .from("subscriptions")
        .select("id, tier, talk_seconds_remaining, subscription_end_date")
        .eq("user_id", userId)
        .eq("status", "active")

    if (error) {
        console.error("Failed to fetch subscriptions:", error)
        return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 })
    }

    const hasPremium = subscriptions.some(s =>
        ["silver", "premium", "gold", "platinum", "add_on"].includes(s.tier)
    )
    // const deductionOrder = hasPremium ? TIER_PRIORITY.premiumUser : TIER_PRIORITY.freeUser
    const deductionOrder = ["silver", "premium", "gold", "platinum", "add_on", "free"]

    let remainingToDeduct = secondsToDeduct
    const deductions: {
        subscription_id: string
        tier: string
        deducted: number
        new_balance: number
    }[] = []

    const updates: Promise<any>[] = []

    for (const tier of deductionOrder) {
        const subsForTier = subscriptions
            .filter(s => s.tier === tier && (s.talk_seconds_remaining ?? 0) > 0)
            .sort((a, b) => (a.subscription_end_date ?? "").localeCompare(b.subscription_end_date ?? ""))

        for (const sub of subsForTier) {
            if (remainingToDeduct <= 0) break

            const available = sub.talk_seconds_remaining ?? 0
            const deduct = Math.min(available, remainingToDeduct)
            const newBalance = available - deduct

            deductions.push({
                subscription_id: sub.id,
                tier: sub.tier,
                deducted: deduct,
                new_balance: newBalance,
            })

            updates.push(
                supabase
                    .from("subscriptions")
                    .update({ talk_seconds_remaining: newBalance })
                    .eq("id", sub.id)
            )

            remainingToDeduct -= deduct
        }

        if (remainingToDeduct <= 0) break
    }

    // Perform all DB updates
    await Promise.all(updates)

    if (remainingToDeduct > 0) {
        return NextResponse.json(
            {
                error: "Insufficient talk time",
                secondsRequested: secondsToDeduct,
                secondsAvailable: secondsToDeduct - remainingToDeduct,
                deductions,
            },
            { status: 400 }
        )
    }

    const { breakdown: talkTimeByTier } = await getActiveTalkTimeForUser(userId)

    return NextResponse.json({
        userId,
        secondsDeducted: secondsToDeduct,
        deductions,
        talkTimeRemaining: talkTimeByTier,
    })
}
