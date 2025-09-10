// app/api/health/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "API is healthy 🚀",
    timestamp: new Date().toISOString(),
  });
}
