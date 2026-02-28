import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { purchases } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ocrResultId = request.nextUrl.searchParams.get("ocrResultId");
  if (!ocrResultId) {
    return NextResponse.json(
      { error: "ocrResultId required" },
      { status: 400 },
    );
  }

  const [purchase] = await db
    .select()
    .from(purchases)
    .where(
      and(
        eq(purchases.ocrResultId, ocrResultId),
        eq(purchases.userId, session.user.id),
        eq(purchases.status, "paid"),
      ),
    )
    .limit(1);

  return NextResponse.json({ paid: !!purchase });
}
