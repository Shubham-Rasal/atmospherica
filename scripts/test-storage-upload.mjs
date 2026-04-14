/**
 * Smoke-test Supabase Storage uploads for the same paths as the app:
 * audio/tracks/… and audio/master/…
 *
 * Usage: node --env-file=.env.local scripts/test-storage-upload.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(url, key);
const buf = Buffer.from([0xff, 0xfb, 0x90, 0x00]); // tiny dummy payload (not a real MP3 frame, enough for storage test)
const ts = Date.now();

const paths = [
  [`tracks/smoke-test-${ts}.mp3`, "per-tile track path"],
  [`master/smoke-test-${ts}.mp3`, "master track path"],
];

for (const [path, label] of paths) {
  const { error } = await supabase.storage.from("audio").upload(path, buf, {
    contentType: "audio/mpeg",
    upsert: true,
  });
  if (error) {
    console.error(`FAIL [${label}] ${path}:`, error.message);
    process.exit(1);
  }
  const { data } = supabase.storage.from("audio").getPublicUrl(path);
  console.log(`OK  [${label}]`, data.publicUrl);
}

console.log("\nStorage upload test passed for both prefixes.");
