import { NextRequest, NextResponse } from "next/server";
import { embed } from "@/lib/embeddings";
import { getArchetypesNs, getTrackFeelingsNs } from "@/lib/turbopuffer";
import { computeQueueOrderForNewClip } from "@/lib/track-queue";
import { supabaseAdmin } from "@/lib/supabase";
import { ElevenLabsClient } from "elevenlabs";
import { serializeError } from "@/lib/errors";
import type { Database } from "@/types/supabase";

type TracksInsert = Database["public"]["Tables"]["tracks"]["Insert"];

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { feeling, userId } = await req.json();

    if (!feeling || typeof feeling !== "string" || feeling.trim().length < 5) {
      return NextResponse.json({ error: "Feeling too short" }, { status: 400 });
    }

    const trimmed = feeling.trim().slice(0, 500);

    // 1. Embed the feeling
    const feelingVector = await embed(trimmed);

    // 2. Search turbopuffer archetypes for top 3 closest emotional matches
    const archetypeResults = await getArchetypesNs().query({
      rank_by: ["vector", "ANN", feelingVector],
      top_k: 3,
      include_attributes: ["musicPrompt", "mood", "tempo", "instrumentation", "dynamics"],
      distance_metric: "cosine_distance",
    });

    // 3. Build ElevenLabs music prompt from top archetype matches
    const rows = archetypeResults.rows ?? [];
    const primaryPrompt = (rows[0]?.musicPrompt as string) ?? "ambient, emotional, cinematic";
    const secondaryMoods = rows
      .slice(1)
      .map((r) => r.mood)
      .filter(Boolean)
      .join(", ");

    const musicPrompt = secondaryMoods
      ? `${primaryPrompt}, with hints of ${secondaryMoods}`
      : primaryPrompt;

    // 4. Generate music with ElevenLabs Sound Effects API
    const audioStream = await elevenlabs.textToSoundEffects.convert({
      text: musicPrompt,
      duration_seconds: 22,
    });

    // Collect stream into buffer
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    // 5. Upload to Supabase Storage
    const fileName = `tracks/${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("audio")
      .upload(fileName, audioBuffer, { contentType: "audio/mpeg" });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseAdmin.storage.from("audio").getPublicUrl(fileName);
    const musicUrl = urlData.publicUrl;

    // 6. Queue position from Turbopuffer: nearest emotional neighbor among existing clips
    const queueOrder = await computeQueueOrderForNewClip(feelingVector, getTrackFeelingsNs());

    // 7. Insert track into Supabase
    const trackId = crypto.randomUUID();
    const row: TracksInsert = {
      id: trackId,
      music_url: musicUrl,
      anon_user_id: userId,
      feeling_text: trimmed,
      revealed: false,
      tpuf_vector_id: trackId,
      grid_position: null,
      queue_order: queueOrder,
    };
    const { error: dbError } = await supabaseAdmin.from("tracks").insert(row);
    if (dbError) {
      const msg = dbError.message ?? "";
      if (
        msg.includes("feeling_text") ||
        (msg.includes("schema cache") && msg.includes("tracks"))
      ) {
        return NextResponse.json(
          {
            error:
              "Database is missing the feeling_text column. In Supabase: SQL Editor → run: alter table public.tracks add column if not exists feeling_text text; (see supabase/migrations/20260414120000_tracks_feeling_text.sql)",
          },
          { status: 503 }
        );
      }
      if (msg.includes("queue_order") && msg.includes("schema")) {
        return NextResponse.json(
          {
            error:
              "Database is missing the queue_order column. Run supabase/migrations/20260414130000_tracks_queue_order.sql in the SQL Editor.",
          },
          { status: 503 }
        );
      }
      throw dbError;
    }

    // 8. Index this clip in Turbopuffer for future similarity search
    try {
      await getTrackFeelingsNs().write({
        upsert_rows: [
          {
            id: trackId,
            vector: feelingVector,
          },
        ],
        distance_metric: "cosine_distance",
      });
    } catch (tpErr) {
      console.error("Track feelings upsert (non-fatal):", tpErr);
    }

    return NextResponse.json({ trackId, musicUrl });
  } catch (err) {
    console.error("Submit error:", err);
    return NextResponse.json({ error: serializeError(err) }, { status: 500 });
  }
}
