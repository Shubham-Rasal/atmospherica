import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { serializeError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 500);
    const offset = parseInt(searchParams.get("offset") ?? "0");

    const { data, error } = await supabaseAdmin
      .from("tracks")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ tracks: data ?? [] });
  } catch (err) {
    console.error("GET /api/tracks:", err);
    return NextResponse.json({ error: serializeError(err) }, { status: 500 });
  }
}
