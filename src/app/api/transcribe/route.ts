import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;

    if (!audio || audio.size === 0) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    const result = await elevenlabs.speechToText.convert({
      file: audio,
      model_id: "scribe_v1",
    });

    return NextResponse.json({ text: result.text });
  } catch (err) {
    console.error("Transcription error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
