// /pages/api/sendPushNotification.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { messaging } from "@/lib/firebaseAdmin"
import { createClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const tokens = await getDeviceTokens(); // fetch FCM tokens from DB

    const message = {
      notification: {
        title: 'Good morning!',
        body: 'Here is your daily 9AM notification ☀️',
      },
      tokens: tokens!,
    };

    const response = await messaging.sendEachForMulticast(message);
    return NextResponse.json({ success: true, response });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to send notification' });
  }
}

async function getDeviceTokens() {

    const supabase = createClient();


    const { data: token, error } = await supabase
    .from("device_tokens")
    .select("*")
    // Replace this with your DB logic
    console.log("🚀 ~ getDeviceTokens ~ token:", token)
    return token?.map((tok) => tok.token);
}
