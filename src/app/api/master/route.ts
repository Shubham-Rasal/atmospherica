import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("master_tracks")
      .select("music_url, version, tile_count, created_at")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data?.music_url) {
      return NextResponse.json({
        url: null,
        version: null,
        tileCount: null,
        createdAt: null,
      });
    }

    return NextResponse.json({
      url: data.music_url,
      version: data.version,
      tileCount: data.tile_count,
      createdAt: data.created_at,
    });
  } catch (err) {
    console.error("Master GET error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
