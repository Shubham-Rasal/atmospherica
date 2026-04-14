import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

type TrackUpdate = Database["public"]["Tables"]["tracks"]["Update"];

// PATCH /api/tracks/positions — bulk-assign grid_position to tracks that don't have one
export async function PATCH(req: NextRequest) {
  try {
    const { positions }: { positions: { id: string; grid_position: number }[] } = await req.json();
    if (!positions?.length) return NextResponse.json({ ok: true });

    // Update each track individually (Supabase doesn't support bulk upsert by id easily)
    await Promise.all(
      positions.map(({ id, grid_position }) =>
        supabaseAdmin
          .from("tracks")
          .update({ grid_position } satisfies TrackUpdate)
          .eq("id", id)
          .is("grid_position", null)
      )
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
