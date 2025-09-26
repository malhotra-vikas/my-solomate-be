import { createClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

// ✅ DELETE: Mark user for deletion at 11:00PM EST
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('id');

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        const supabase = createClient();

        const { data: currentUser, error: currentUserError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (currentUserError) {
            console.error("Supabase error:", currentUserError);
            return NextResponse.json(
                { error: "Failed to fetch user data" },
                { status: 500 }
            );
        }

        if (!currentUser) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // const { data: subscription, error: subscriptionError } = await supabase
        //     .from('subscriptions')
        //     .select('tier, subscription_end_date, stripe_subscription_id')
        //     .eq('user_id', userId)
        //     .eq('status', 'active');

        // if (subscriptionError) {
        //     console.error("Subscription fetch error:", subscriptionError);
        //     return NextResponse.json(
        //         { error: "Failed to fetch subscription info" },
        //         { status: 500 }
        //     );
        // }

        let deletionDate: Date = new Date();
        deletionDate.setHours(23, 0, 0, 0);

        const { error } = await supabase
            .from('users')
            .update({
                status: "To Be Deleted",
                marked_delete_date: deletionDate.toISOString(),
            })
            .eq('id', userId);

        if (error) {
            console.error("Supabase delete mark error:", error);
            return NextResponse.json(
                { error: "Failed to mark user for deletion" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: "User scheduled for deletion and subscriptions cancelled",
            deletion_date: deletionDate.toISOString()
        });

    } catch (error) {
        console.error("Error marking user for deletion:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('id');

        if (!userId) {
            return NextResponse.json(
                { error: "User ID is required" },
                { status: 400 }
            );
        }

        const supabase = createClient();
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.error("Supabase error:", error);
            return NextResponse.json(
                { error: "Failed to fetch user data" },
                { status: 500 }
            );
        }

        if (!data) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching user:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function PUT(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('id');

        if (!userId) {
            return NextResponse.json(
                { error: "User ID is required" },
                { status: 400 }
            );
        }

        const formData = await req.formData();
        const photoUrlInput = formData.get('file') as string | File | null;

        console.log("FormData entries:");
        for (const [key, value] of formData.entries()) {
            console.log(key, value instanceof File ? `File: ${value.name}` : value);
        }

        const updates: Record<string, any> = {};
        formData.forEach((value, key) => {
            if (key !== 'file') {
                if (key === "interests") {
                    updates[key] = (value as string)
                        .split(",")
                        .map((item) => item.trim());
                } else {
                    updates[key] = value;
                }
            }
        });

        const supabase = createClient();

        const { data: currentUser, error: currentUserError } = await supabase
            .from('users')
            .select('photo_url')
            .eq('id', userId)
            .maybeSingle();

        if (currentUserError) {
            console.error("Supabase fetch photo_url error:", currentUserError);
            return NextResponse.json(
                { error: "Failed to update user data" },
                { status: 500 }
            );
        }

        if (!currentUser) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        let photoUrl = currentUser?.photo_url || null;
        let shouldDeleteOldImage = false;

        if (photoUrlInput !== null) {
            if (photoUrlInput instanceof File) {
                shouldDeleteOldImage = true;

                // Upload new image
                const file = photoUrlInput;
                const fileExt = file.name.split('.').pop();
                const fileName = `${userId}-${Date.now()}.${fileExt}`;
                const filePath = fileName;

                const { error: uploadError } = await supabase.storage
                    .from(process.env.SUPABASE_USER_BUCKET_NAME || 'user-avatar')
                    .upload(filePath, file);

                if (uploadError) {
                    console.error("File upload error:", uploadError);
                    return NextResponse.json(
                        { error: "Failed to upload profile image" },
                        { status: 500 }
                    );
                }

                const { data: urlData } = supabase.storage
                    .from(process.env.SUPABASE_USER_BUCKET_NAME || 'user-avatar')
                    .getPublicUrl(filePath);

                photoUrl = urlData.publicUrl;
            } else if (typeof photoUrlInput === 'string') {
                if (photoUrlInput === 'delete') {
                    shouldDeleteOldImage = true;
                    photoUrl = null;
                } else if (photoUrlInput !== currentUser?.photo_url) {
                    shouldDeleteOldImage = true;
                    photoUrl = photoUrlInput;
                }
            }
        }

        if (shouldDeleteOldImage && currentUser?.photo_url) {
            try {
                const oldUrl = new URL(currentUser.photo_url);
                console.log("Old URL:", oldUrl);
                const pathParts = oldUrl.pathname.split(`/storage/v1/object/public/${process.env.SUPABASE_USER_BUCKET_NAME!}/`);
                const oldFilePath = pathParts.length > 1 ? pathParts[1] : null;

                if (oldFilePath) {
                    const { error: deleteError } = await supabase.storage
                        .from(process.env.SUPABASE_USER_BUCKET_NAME! || 'user-avatar')
                        .remove([oldFilePath]);

                    if (deleteError) {
                        console.warn("Failed to delete old image:", deleteError);
                    }
                }
            } catch (e) {
                console.warn("Error parsing old image URL:", e);
            }
        }

        const updateData = {
            ...updates,
            ...(photoUrl !== null && { photo_url: photoUrl }),
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId)
            .select()
            .maybeSingle();

        if (error) {
            console.error("Supabase update error:", error);
            return NextResponse.json(
                { error: "Failed to update user data" },
                { status: 500 }
            );
        }

        if (!data) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error updating user:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
