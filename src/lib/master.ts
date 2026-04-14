import { ElevenLabsClient } from "elevenlabs";
import { supabaseAdmin } from "@/lib/supabase";

const PREFIX = "A collective soundscape of many emotions: ";

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY!,
});

/** Max length for the full text sent to ElevenLabs textToSoundEffects. */
const PROMPT_MAX = 450;

export async function generateMasterTrack(): Promise<void> {
  const { data: rows, error: fetchError } = await supabaseAdmin
    .from("tracks")
    .select("feeling_text")
    .not("feeling_text", "is", null);

  if (fetchError) throw fetchError;

  const texts = (rows ?? [])
    .map((r) => (typeof r.feeling_text === "string" ? r.feeling_text.trim() : ""))
    .filter(Boolean);

  const tileCount = texts.length;
  if (tileCount === 0) return;

  let joined = texts.join(" · ");
  let prompt = PREFIX + joined;
  if (prompt.length > PROMPT_MAX) {
    joined = joined.slice(0, Math.max(0, PROMPT_MAX - PREFIX.length));
    prompt = (PREFIX + joined).slice(0, PROMPT_MAX);
  }

  const audioStream = await elevenlabs.textToSoundEffects.convert({
    text: prompt,
    duration_seconds: 22,
  });

  const chunks: Buffer[] = [];
  for await (const chunk of audioStream) {
    chunks.push(Buffer.from(chunk));
  }
  const audioBuffer = Buffer.concat(chunks);

  const fileName = `master/${Date.now()}.mp3`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("audio")
    .upload(fileName, audioBuffer, { contentType: "audio/mpeg" });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabaseAdmin.storage.from("audio").getPublicUrl(fileName);
  const musicUrl = urlData.publicUrl;

  const { data: last } = await supabaseAdmin
    .from("master_tracks")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (typeof last?.version === "number" ? last.version : 0) + 1;

  const { error: insertError } = await supabaseAdmin.from("master_tracks").insert({
    music_url: musicUrl,
    prompt,
    tile_count: tileCount,
    version: nextVersion,
  });

  if (insertError) throw insertError;
}
