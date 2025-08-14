import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

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

        const updates: Record<string, any> = {};
        formData.forEach((value, key) => {
            if (
                typeof value === "string" &&
                !key.startsWith("avatar_url_") &&
                key !== "avatar_video_url"
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
            const fileName = `video_${Date.now()}.${videoFile.name.split(".").pop()}`;
            const { data, error } = await supabase.storage
                .from("personas-photo-video")
                .upload(fileName, videoFile, {
                    cacheControl: "3600",
                    upsert: true,
                });

            if (error) throw error;

            const { data: publicUrlData } = supabase.storage
                .from("personas-photo-video")
                .getPublicUrl(fileName);

            updates.avatar_video_url = publicUrlData.publicUrl;
        }

        // Update database
        const { data, error: updateError } = await supabase
            .from("personas")
            .update(updates)
            .eq("id", personaId)
            .select();

        if (updateError) throw updateError;

        return NextResponse.json(
            { message: "Persona updated successfully", data },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("Error updating persona:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
