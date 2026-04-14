import { NextRequest, NextResponse } from "next/server";
import { embed } from "@/lib/embeddings";
import { getArchetypesNs, getFeelingsNs } from "@/lib/turbopuffer";
import { supabaseAdmin } from "@/lib/supabase";
import { ElevenLabsClient } from "elevenlabs";

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

    // 6. Insert track into Supabase
    const trackId = crypto.randomUUID();
    // Try inserting with feeling_text; fall back without it if column not yet migrated
    let dbError;
    ({ error: dbError } = await supabaseAdmin.from("tracks").insert({
      id: trackId,
      music_url: musicUrl,
      anon_user_id: userId,
      feeling_text: trimmed,
      revealed: false,
      tpuf_vector_id: trackId,
    } as any));

    if (dbError) {
      // Retry without feeling_text in case column doesn't exist yet
      ({ error: dbError } = await supabaseAdmin.from("tracks").insert({
        id: trackId,
        music_url: musicUrl,
        anon_user_id: userId,
        revealed: false,
        tpuf_vector_id: trackId,
      }));
    }

    if (dbError) throw dbError;

    // 7. Index feeling in turbopuffer feelings namespace
    // The feeling text is NOT stored in attributes — only track_id for filter-based lookup
    await getFeelingsNs().write({
      upsert_rows: [
        {
          id: trackId,
          vector: feelingVector,
          track_id: trackId,
        },
      ],
      distance_metric: "cosine_distance",
    });

    return NextResponse.json({ trackId, musicUrl });
  } catch (err) {
    console.error("Submit error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
