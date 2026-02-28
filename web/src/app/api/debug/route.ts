import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET() {
  const env = {
    hasPostgresUrl: !!process.env.POSTGRES_URL,
    hasGoogleClientId: !!(process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_CLIENT_ID),
    hasGoogleSecret: !!(process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_CLIENT_SECRET),
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasAuthUrl: !!process.env.AUTH_URL,
    nodeEnv: process.env.NODE_ENV,
  };

  let dbOk = false;
  let dbError = "";
  try {
    await sql`SELECT 1 as test`;
    dbOk = true;
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({ env, dbOk, dbError });
}
