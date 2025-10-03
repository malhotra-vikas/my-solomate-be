import { createClient } from "@/lib/supabase";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

// ✅ Use your real frontend origin
const allowedOrigin = "https://admin.solomate.app";

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_PERSONA_BUCKET_NAME!;


// GET - get all persona list
export async function GET(req: NextRequest) {
  const supabase = createClient();

  try {
    const { data, error } = await supabase.from("personas").select("*");

    if (error || !data) {
      return corsResponse(
        NextResponse.json({ error: "persona not found" }, { status: 400 })
      );
    }

    return corsResponse(
      NextResponse.json(
        { message: "Persona Fetch Successfully", count: data.length, data },
        { status: 200 }
      )
    );
  } catch (error) {
    console.error("🚀 ~ GET ~ error:", error);
    return corsResponse(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}

// ---------------- POST - create new persona ----------------
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const formData = await req.formData();

    const insertData: Record<string, any> = {};
    formData.forEach((value, key) => {
      if (typeof value === "string" && !key.startsWith("avatar_url_") && key !== "avatar_video_url") {
        try {
          insertData[key] = JSON.parse(value);
        } catch {
          insertData[key] = value;
        }
      }
    });

    const personaName = insertData.name || "unknown_persona";

    // Handle avatar uploads
    for (let i = 1; i <= 5; i++) {
      const file = formData.get(`avatar_url_${i}`) as File | null;
      if (file) {
        const fileName = `avatar_${i}_${Date.now()}.${file.name.split(".").pop()}`;
        const { error: uploadError } = await supabase.storage
          .from("personas-photo-video")
          .upload(fileName, file, { cacheControl: "3600", upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("personas-photo-video")
          .getPublicUrl(fileName);

        insertData[`avatar_url_${i}`] = publicUrlData.publicUrl;
      }
    }

    // Handle video upload
    const videoFile = formData.get("avatar_video_url") as File | null;
    if (videoFile) {
      const videoName = `video_${Date.now()}.${videoFile.name.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("personas-photo-video")
        .upload(videoName, videoFile, {
          cacheControl: "3600",
          upsert: true,
          contentType: videoFile.type || "video/mp4",
        });

      if (uploadError) throw uploadError;

      const { data: signedData, error: signedError } = await supabase.storage
        .from("personas-photo-video")
        .createSignedUrl(videoName, 60 * 60 * 24 * 7);

      if (signedError) throw signedError;
      insertData.avatar_video_url = signedData.signedUrl;
    }

    // Insert into DB
    const { data, error: insertError } = await supabase
      .from("personas")
      .insert([insertData])
      .select();

    if (insertError) throw insertError;

    return corsResponse(
      NextResponse.json(
        { message: "Persona created successfully", data },
        { status: 201 }
      )
    );
  } catch (error: any) {
    console.error("Error creating persona:", error);
    return corsResponse(
      NextResponse.json({ error: error.message }, { status: 500 })
    );
  }
}

// ---------------- OPTIONS (CORS Preflight) ----------------
export async function OPTIONS() {
  return corsResponse(new Response(null, { status: 204 }));
}

// ---------------- Utility: Add CORS headers ----------------
function corsResponse(res: Response) {
  res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PATCH, DELETE");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  return res;
}
