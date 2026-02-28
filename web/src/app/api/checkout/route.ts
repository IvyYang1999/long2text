import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { purchases } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { ocrResultId } = await request.json();
  if (!ocrResultId) {
    return NextResponse.json(
      { error: "ocrResultId required" },
      { status: 400 },
    );
  }

  const origin = request.headers.get("origin") || "https://long2text.com";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Long2Text - Unlock Full OCR Result",
          },
          unit_amount: 99, // $0.99
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: session.user.id,
      ocrResultId,
    },
    success_url: `${origin}?paid=${ocrResultId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}?canceled=true`,
  });

  // Create pending purchase record
  await db.insert(purchases).values({
    userId: session.user.id,
    ocrResultId,
    stripeSessionId: checkoutSession.id,
    amount: 99,
    status: "pending",
  });

  return NextResponse.json({ url: checkoutSession.url });
}
