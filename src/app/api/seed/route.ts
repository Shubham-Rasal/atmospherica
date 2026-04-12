import { NextResponse } from "next/server";
import { getArchetypesNs } from "@/lib/turbopuffer";
import { embedBatch } from "@/lib/embeddings";
import { archetypes } from "@/lib/archetypes";

export async function POST() {
  try {
    const batchSize = 25;
    let upserted = 0;

    for (let i = 0; i < archetypes.length; i += batchSize) {
      const batch = archetypes.slice(i, i + batchSize);
      const embeddings = await embedBatch(batch.map((a) => a.text));

      await getArchetypesNs().write({
        upsert_rows: batch.map((archetype, j) => ({
          id: archetype.id,
          vector: embeddings[j],
          text: archetype.text,
          mood: archetype.mood,
          tempo: archetype.tempo,
          texture: archetype.texture,
          instrumentation: archetype.instrumentation,
          key: archetype.key,
          dynamics: archetype.dynamics,
          musicPrompt: archetype.musicPrompt,
        })),
        distance_metric: "cosine_distance",
      });

      upserted += batch.length;
    }

    return NextResponse.json({ success: true, upserted });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
