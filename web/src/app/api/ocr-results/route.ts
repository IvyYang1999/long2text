import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ocrResults, purchases } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

// Save a completed OCR result
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { fullText, preview, totalChars, segmentsProcessed, imageHash } =
    await request.json();

  const [result] = await db
    .insert(ocrResults)
    .values({
      userId: session.user.id,
      fullText,
      preview,
      totalChars,
      segmentsProcessed,
      imageHash: imageHash || null,
    })
    .returning({ id: ocrResults.id });

  return NextResponse.json({ id: result.id });
}

// Get user's OCR results history
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const results = await db
    .select({
      id: ocrResults.id,
      preview: ocrResults.preview,
      fullText: ocrResults.fullText,
      totalChars: ocrResults.totalChars,
      segmentsProcessed: ocrResults.segmentsProcessed,
      createdAt: ocrResults.createdAt,
    })
    .from(ocrResults)
    .where(eq(ocrResults.userId, session.user.id))
    .orderBy(desc(ocrResults.createdAt))
    .limit(50);

  // Check which results are paid
  const paidPurchases = await db
    .select({ ocrResultId: purchases.ocrResultId })
    .from(purchases)
    .where(
      and(
        eq(purchases.userId, session.user.id),
        eq(purchases.status, "paid"),
      ),
    );

  const paidIds = new Set(paidPurchases.map((p) => p.ocrResultId));

  const resultsWithPayment = results.map((r) => ({
    ...r,
    // Only include full text if paid or short enough
    fullText: paidIds.has(r.id) || r.totalChars <= 500 ? r.fullText : null,
    isPaid: paidIds.has(r.id),
  }));

  return NextResponse.json(resultsWithPayment);
}
