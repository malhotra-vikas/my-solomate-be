import { queueNotificationToSQS } from "@/lib/notifications";
import type { SupabaseClient } from "@supabase/supabase-js";

type PersonaSummary = {
  id: string
  name: string
}

export function parseBoolean(value: FormDataEntryValue | null) {
  if (typeof value === "string") {
    try {
      return Boolean(JSON.parse(value))
    } catch {
      return value.toLowerCase() === "true"
    }
  }

  if (typeof value === "boolean") return value

  return false
}

export async function queuePersonaNotification(
  supabase: SupabaseClient,
  persona: PersonaSummary
) {
  try {
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
        userId: id,
        title: "New Persona Added to SoloMate!",
        body: `We have just added ${persona.name} to SoloMate.`,
        type: "NEW_FEATURE_EVENT",
        data: {
          screen: "PersonaDetails",
          persona_id: persona.id
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
  } catch (err) {
    console.error("Failed to queue notification:", err)
  }
}
