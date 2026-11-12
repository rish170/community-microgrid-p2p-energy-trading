import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const ADMIN_SECRET = process.env.ADMIN_SESSION_SECRET || "microgrid-super-secret-salt-2026-auth";

function getExpectedToken(): string {
  return crypto.createHmac("sha256", ADMIN_SECRET).update("admin-authenticated-session").digest("hex");
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("admin_session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const expected = getExpectedToken();
    const isMatch =
      sessionCookie.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sessionCookie), Buffer.from(expected));

    if (!isMatch) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({ authenticated: true });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

