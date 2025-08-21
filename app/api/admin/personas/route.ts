import { queueNotificationToSQS } from "@/lib/notifications";
import { createClient } from "@/lib/supabase";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

const allowedOrigin = "*"; 

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
        const { data, error } = await supabase
        .from("personas")
        .select("*")
        
        console.log("🚀 ~ GET ~ error:", error);
        if (error || !data) {
            return NextResponse.json({error: "persona not found"}, { status: 400 })
        }

        return corsResponse(
            NextResponse.json({
            message: "Persona Fetch Successfully",
            count: data.length,
            data
        }, { status: 201 })
        )

    } catch (error) {
        console.log("🚀 ~ GET ~ error:", error)
        return corsResponse(NextResponse.json({ error: "Internal server error" }, { status: 500 }))
    }
}


// POST - create new persona

export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();
  
      // Parse FormData (supports files)
      const formData = await req.formData();
  
      // Collect text/JSON fields
      const insertData: Record<string, any> = { };
      formData.forEach((value, key) => {
        if (typeof value === "string" && !key.startsWith("avatar_url_") && key !== "avatar_video_url") {
          try {
            insertData[key] = JSON.parse(value); // Parse JSON if possible
          } catch {
            insertData[key] = value;
          }
        }
      });
      
      console.log("🚀 ~ POST ~ insertData:", insertData)

      const personaName = insertData.name || "unknown_persona";
      console.log("🚀 ~ POST ~ personaName:", personaName)
  
      // Handle avatar uploads (avatar_url_1 to avatar_url_5)
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
      const { data: signedData, error: signedError } = await supabase.storage
        .from("personas-photo-video")
        .createSignedUrl(videoName, 60 * 60 * 24 * 7);

      if (signedError) throw signedError;

      // Store signed URL in DB
      insertData.avatar_video_url = signedData.signedUrl;
    }

    // async function uploadToS3(file: File, keyPrefix: string) {
    //   const ext = file.name.split(".").pop();
    //   const fileName = `${personaName}/${keyPrefix}_${Date.now()}.${ext}`;
    //   const arrayBuffer = await file.arrayBuffer();
    //   const buffer = Buffer.from(arrayBuffer);

    //   await s3.send(
    //     new PutObjectCommand({
    //       Bucket: BUCKET_NAME,
    //       Key: fileName,
    //       Body: buffer,
    //       ContentType: file.type,
    //       ACL: "public-read", // public URL
    //     })
    //   );

    //   return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    // }

    // // Handle avatar photos
    // for (let i = 1; i <= 5; i++) {
    //   const file = formData.get(`avatar_url_${i}`) as File | null;
    //   if (file) {
    //     const fileUrl = await uploadToS3(file, `avatar_${i}`);
    //     insertData[`avatar_url_${i}`] = fileUrl;
    //   }
    // }

    // // Handle avatar video
    // const videoFile = formData.get("avatar_video_url") as File | null;
    // if (videoFile) {
    //   const videoUrl = await uploadToS3(videoFile, "video");
    //   insertData.avatar_video_url = videoUrl;
    // }

  
      // Insert into personas table
      const { data, error: insertError } = await supabase
      .from("personas")
      .insert([insertData])
      .select();
      
      if (insertError) throw insertError;
      console.log("🚀 ~ POST ~ data:", data)

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
            body: `We have just added ${data[0].name} to SoloMate.`,
            type: "NEW_FEATURE_EVENT",
            data: {
              screen: "PersonaDetails",
              persona_id: data[0].id
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
  
      return corsResponse(NextResponse.json({ message: "Persona created successfully", data }, { status: 201 }));
    } catch (error: any) {
      console.error("Error creating persona:", error);
      return corsResponse(NextResponse.json({ error: error.message }, { status: 500 }))
    }
  }

  export async function OPTIONS() {
    return corsResponse(new Response(null, { status: 204 }));
  }
  
  // Utility to add CORS headers
  function corsResponse(res: Response) {
    res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    return res;
  }