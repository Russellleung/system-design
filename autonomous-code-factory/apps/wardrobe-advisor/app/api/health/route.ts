import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "closet-compass",
    release: process.env.RENDER_GIT_COMMIT ?? "local",
  });
}
