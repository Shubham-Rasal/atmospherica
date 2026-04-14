"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Track } from "@/types/supabase";

function TrackCard({ track, index }: { track: Track; index: number }) {
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  function togglePlay(e: React.MouseEvent) {
    e.preventDefault();
    if (!audio) {
      const a = new Audio(track.music_url);
      a.onended = () => setPlaying(false);
      a.play();
      setAudio(a);
      setPlaying(true);
    } else if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }

  useEffect(() => { return () => { audio?.pause(); }; }, [audio]);

  const timeAgo = (date: string) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const bars = [42, 68, 52, 88, 36, 74, 58, 44, 72, 50, 84, 40, 64, 92, 32, 76, 56, 82, 46, 62];

  // Warm emoji set per card index
  const emojis = ["🌊", "🌙", "☁️", "🍂", "🌿", "✨", "🌅", "🫧", "🌸", "🎭"];
  const emoji = emojis[index % emojis.length];

  return (
    <div
      className="card card-hover fade-up flex flex-col overflow-hidden"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Top — waveform section */}
      <div
        className="px-5 pt-5 pb-4 transition-colors duration-500"
        style={{ background: playing ? "#F0ECFF" : "#FAFAF8" }}
      >
        {/* Emoji + playing badge */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl">{emoji}</span>
          {playing && (
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "var(--accent)", color: "white" }}
            >
              Playing
            </span>
          )}
        </div>

        {/* Waveform */}
        <div className="flex items-end gap-[3px] h-10 mb-3">
          {bars.map((h, i) => (
            <div
              key={i}
              className={`rounded-full flex-1 ${playing ? "waveform-bar" : ""}`}
              style={{
                background: playing ? "var(--accent)" : "#DEDAD2",
                height: `${h}%`,
                animationDelay: `${i * 0.06}s`,
                transition: "background 0.4s",
              }}
            />
          ))}
        </div>

        {/* Play button */}
        <button
          onClick={togglePlay}
          className="w-full py-2 rounded-2xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2"
          style={{
            background: playing ? "var(--accent)" : "var(--pill-dark)",
            color: "white",
          }}
        >
          <span style={{ fontSize: "11px" }}>{playing ? "⏸" : "▶"}</span>
          {playing ? "Pause" : "Play track"}
        </button>
      </div>

      {/* Bottom */}
      <div className="px-5 py-4 flex flex-col gap-3" style={{ background: "var(--surface)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ background: "var(--tag-green-bg)", color: "var(--tag-green-text)" }}
          >
            {track.guess_count} {track.guess_count === 1 ? "guess" : "guesses"}
          </span>
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ background: "var(--tag-yellow-bg)", color: "var(--tag-yellow-text)" }}
          >
            {timeAgo(track.created_at)}
          </span>
        </div>

        <Link
          href={`/guess/${track.id}`}
          className="btn-dark text-center py-2.5 text-sm block"
        >
          Guess the feeling →
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tracks")
      .then((r) => r.json())
      .then((d) => setTracks(d.tracks ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="px-6 pt-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold"
            style={{ background: "var(--pill-dark)", color: "white" }}
          >
            ♪
          </div>
          <div>
            <p className="text-[13px] font-bold leading-tight" style={{ color: "var(--text)" }}>
              Atmospherica
            </p>
            <p className="text-[11px] leading-tight" style={{ color: "var(--text-2)" }}>
              Feel the music
            </p>
          </div>
        </div>
        <Link
          href="/submit"
          className="btn-dark px-4 py-2 text-sm"
        >
          + Share feeling
        </Link>
      </header>

      {/* Hero card */}
      <section className="px-6 pb-6 fade-up">
        <div
          className="rounded-3xl px-6 pt-8 pb-6 relative overflow-hidden"
          style={{ background: "var(--pill-dark)", minHeight: "220px" }}
        >
          {/* Decorative circles */}
          <div
            className="absolute -top-8 -right-8 w-36 h-36 rounded-full opacity-10"
            style={{ background: "white" }}
          />
          <div
            className="absolute -bottom-6 -right-2 w-24 h-24 rounded-full opacity-10"
            style={{ background: "var(--bg)" }}
          />

          <div className="relative">
            <div className="text-4xl mb-4 float select-none">🎵</div>
            <h1
              className="text-3xl font-black leading-[1.1] mb-3"
              style={{ color: "white", letterSpacing: "-0.025em" }}
            >
              Someone felt something.{" "}
              <span style={{ color: "var(--bg)" }}>Can you hear it?</span>
            </h1>
            <p className="text-sm mb-5 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              They described a moment. AI turned it into music. Listen and guess the emotion.
            </p>
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-150"
              style={{ background: "var(--bg)", color: "var(--pill-dark)" }}
            >
              Share a feeling →
            </Link>
          </div>
        </div>
      </section>

      {/* Section label */}
      <div className="px-6 mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>
          Latest Feelings
        </h2>
        <span className="text-xs font-medium" style={{ color: "var(--text-2)" }}>
          {tracks.length} tracks
        </span>
      </div>

      {/* Feed */}
      <section className="px-6 pb-16 stagger">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl h-56 animate-pulse"
                style={{ background: "rgba(255,255,255,0.5)" }}
              />
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div
            className="card text-center py-16 px-8"
          >
            <div className="text-5xl mb-4">🌫️</div>
            <p className="text-base font-semibold mb-1" style={{ color: "var(--text)" }}>
              No feelings yet
            </p>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
              Be the first to share one
            </p>
            <Link href="/submit" className="btn-dark px-6 py-2.5 text-sm inline-block">
              Share a feeling →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tracks.map((track, i) => (
              <TrackCard key={track.id} track={track} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="px-6 pb-8 text-center">
      </footer>
    </main>
  );
}
