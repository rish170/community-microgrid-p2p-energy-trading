import { NextResponse } from "next/server";
import crypto from "crypto";

const ADMIN_SECRET = process.env.ADMIN_SESSION_SECRET || "microgrid-super-secret-salt-2026-auth";

function getExpectedToken(): string {
  return crypto.createHmac("sha256", ADMIN_SECRET).update("admin-authenticated-session").digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { password } = body;

    const expectedPassword = process.env.ADMIN_PASSWORD || "microgrid2026!";

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "Password is required" },
        { status: 400 }
      );
    }

    // Constant-time buffer comparison to prevent timing attacks
    const passwordBuffer = Buffer.from(password);
    const expectedBuffer = Buffer.from(expectedPassword);

    const isMatch =
      passwordBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(passwordBuffer, expectedBuffer);

    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: "Invalid operator authorization password" },
        { status: 401 }
      );
    }

    const token = getExpectedToken();

    const response = NextResponse.json({
      success: true,
      message: "Operator authorization confirmed",
    });

    // Set secure HTTP-only session cookie
    response.cookies.set({
      name: "admin_session",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal authentication error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

