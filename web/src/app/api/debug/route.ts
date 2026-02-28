import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET() {
  const env = {
    hasPostgresUrl: !!process.env.POSTGRES_URL,
    postgresUrlPrefix: process.env.POSTGRES_URL?.substring(0, 30) + "...",
    hasGoogleClientId: !!(process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_CLIENT_ID),
    googleClientIdPrefix: (process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_CLIENT_ID)?.substring(0, 20) + "...",
    hasGoogleSecret: !!(process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_CLIENT_SECRET),
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasAuthUrl: !!process.env.AUTH_URL,
    authUrl: process.env.AUTH_URL,
    nodeEnv: process.env.NODE_ENV,
  };

  let dbOk = false;
  let dbError = "";
  let tablesExist = false;
  try {
    await sql`SELECT 1 as test`;
    dbOk = true;
    const res = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    tablesExist = res.rows.length > 0;
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  let authTest = "";
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    authTest = session ? "has session" : "no session (ok)";
  } catch (e) {
    authTest = "error: " + (e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json({ env, dbOk, dbError, tablesExist, authTest });
}
