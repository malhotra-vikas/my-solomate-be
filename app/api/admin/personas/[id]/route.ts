import { createClient } from "@/lib/supabase";
import { parseBoolean, queuePersonaNotification } from "../notifications";
import { NextRequest, NextResponse } from "next/server";

// DELETE - remove persona by id
export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params; // ✅ await before accessing
    const personaId = id;

    if (!personaId) {
        return NextResponse.json(
            { error: "Persona ID is required" },
            { status: 400 }
        );
    }

    const supabase = createClient();

    try {
        // Fetch the persona first so we know what files to delete
        const { data: persona, error: fetchError } = await supabase
            .from("personas")
            .select("*")
            .eq("id", personaId)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!persona) {
            return NextResponse.json(
                { error: "Persona not found" },
                { status: 404 }
            );
        }

        // Delete the persona from DB
        const { error: deleteError } = await supabase
            .from("personas")
            .delete()
            .eq("id", personaId);

        if (deleteError) throw deleteError;

        return NextResponse.json(
            { message: "Persona deleted successfully" },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("Error deleting persona:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT - update persona by id
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const personaId = params.id;
    if (!personaId) {
        return NextResponse.json(
            { error: "Persona ID is required" },
            { status: 400 }
        );
    }

    const supabase = createClient();

    try {
        const formData = await req.formData();

        const sendNotification = parseBoolean(formData.get("send_notification"));

        const updates: Record<string, any> = {};
        formData.forEach((value, key) => {
            if (
                typeof value === "string" &&
                !key.startsWith("avatar_url_") &&
                key !== "avatar_video_url" &&
                key !== "send_notification"
            ) {
                try {
                    // Try parsing JSON-like fields
                    updates[key] = JSON.parse(value);
                } catch {
                    updates[key] = value;
                }
            }
        });

        // Upload image files (avatar_url_1 to avatar_url_5)
        for (let i = 1; i <= 5; i++) {
            const file = formData.get(`avatar_url_${i}`) as File | null;
            if (file) {
                const fileName = `avatar_${i}_${Date.now()}.${file.name.split(".").pop()}`;
                const { data, error } = await supabase.storage
                    .from("personas-photo-video")
                    .upload(fileName, file, {
                        cacheControl: "3600",
                        upsert: true,
                    });

                if (error) throw error;

                const { data: publicUrlData } = supabase.storage
                    .from("personas-photo-video")
                    .getPublicUrl(fileName);

                updates[`avatar_url_${i}`] = publicUrlData.publicUrl;
            }
        }

        // Upload video file (avatar_video_url)
        const videoFile = formData.get("avatar_video_url") as File | null;
        if (videoFile) {
            const videoName = `video_${Date.now()}.${videoFile.name.split(".").pop()}`;

            // Upload with correct Content-Type
            const { error: uploadError } = await supabase.storage
                .from("personas-photo-video")
                .upload(videoName, videoFile, {
                    cacheControl: "3600",
                    upsert: true,
                    contentType: videoFile.type || "video/mp4",
                });

            if (uploadError) throw uploadError;

            // Create signed URL valid for 7 days
            const { data: signedData, error: signedError } =
                await supabase.storage
                    .from("personas-photo-video")
                    .createSignedUrl(videoName, 60 * 60 * 24 * 7);

            if (signedError) throw signedError;

            // Store signed URL in DB
            updates.avatar_video_url = signedData.signedUrl;
        }

        // Update database
        const { data, error: updateError } = await supabase
            .from("personas")
            .update(updates)
            .eq("id", personaId)
            .select();

        if (updateError) throw updateError;

        if (sendNotification && data?.[0]?.is_active) {
            await queuePersonaNotification(supabase, data[0]);
        }

        return NextResponse.json(
            { message: "Persona updated successfully", data },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("Error updating persona:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
