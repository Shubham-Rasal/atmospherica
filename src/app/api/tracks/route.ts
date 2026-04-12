import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
    const offset = parseInt(searchParams.get("offset") ?? "0");

    const { data, error } = await supabaseAdmin
      .from("tracks")
      .select("id, created_at, music_url, play_count, guess_count, revealed")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ tracks: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
