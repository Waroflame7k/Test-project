import { NextResponse } from "next/server";
import { readSharedAppData, upsertSharedAppData } from "@/services/shared-store";
import type { AppData } from "@/types/domain";

export const runtime = "nodejs";

export async function GET() {
  const data = await readSharedAppData();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function PUT(request: Request) {
  const incoming = (await request.json()) as AppData;
  const merged = await upsertSharedAppData(incoming);
  return NextResponse.json(merged, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
