import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/extractUserFromRequest';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
});
  

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized request or Token Expired" },
      { status: 401 }
    );
  }

  const { priceId, tier } = await req.json()

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: ['card'],
      success_url: `mysolomate://success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: 'mysolomate://cancel',
      metadata: { userId, tier },
    });
    
    console.log("🚀 ~ POST ~ session:", session)

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (error: any) {
    // res.status(500).json({ error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
