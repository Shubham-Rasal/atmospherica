"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Track } from "@/types/supabase";

// Curated atmospheric color palette
const PALETTE = [
  "#C084FC", "#818CF8", "#60A5FA", "#34D399",
  "#FBBF24", "#F87171", "#FB923C", "#A78BFA",
  "#38BDF8", "#4ADE80", "#F472B6", "#E879F9",
  "#FCD34D", "#6EE7B7", "#93C5FD", "#FCA5A5",
  "#86EFAC", "#BAE6FD", "#DDD6FE", "#FDE68A",
];

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

// Darken a hex color for text contrast
function darken(hex: string, amount = 0.45): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.floor(((n >> 16) & 0xff) * (1 - amount));
  const g = Math.floor(((n >> 8) & 0xff) * (1 - amount));
  const b = Math.floor((n & 0xff) * (1 - amount));
  return `rgb(${r},${g},${b})`;
}

const WAVEFORM = [35, 58, 44, 84, 30, 74, 54, 90, 40, 70, 48, 80, 64, 36, 76];

function FeelTile({
  track,
  index,
  isActive,
  isPlaying,
  onClick,
}: {
  track: Track;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onClick: () => void;
}) {
  const color = colorFromId(track.id);
  const textColor = darken(color);

  return (
    <button
      onClick={onClick}
      className="relative group focus:outline-none"
      style={{
        aspectRatio: "1",
        background: color,
        borderRadius: isActive ? "16px" : "8px",
        transform: isActive ? "scale(1.06)" : "scale(1)",
        zIndex: isActive ? 10 : 1,
        transition: "border-radius 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease",
        boxShadow: isActive
          ? `0 8px 32px ${color}88, 0 2px 8px rgba(0,0,0,0.12)`
          : "none",
        animationDelay: `${index * 30}ms`,
      }}
      aria-label={`Track ${index + 1}`}
    >
      {/* Idle hover shimmer */}
      {!isActive && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{
            borderRadius: "inherit",
            background: "rgba(255,255,255,0.25)",
          }}
        />
      )}

      {/* Playing waveform */}
      {isActive && (
        <div className="absolute inset-0 flex items-end justify-center gap-[2px] p-2" style={{ borderRadius: "inherit" }}>
          {WAVEFORM.map((h, i) => (
            <div
              key={i}
              className={isPlaying ? "waveform-bar" : ""}
              style={{
                flex: 1,
                height: `${h}%`,
                background: textColor,
                opacity: 0.6,
                borderRadius: "2px",
                transformOrigin: "bottom",
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Guess count badge */}
      {track.guess_count > 0 && !isActive && (
        <div
          className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.2)", color: "white" }}
        >
          {track.guess_count}
        </div>
      )}
    </button>
  );
}

export default function HomePage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/tracks?limit=200")
      .then((r) => r.json())
      .then((d) => setTracks(d.tracks ?? []))
      .finally(() => setLoading(false));
  }, []);

  function handleTileClick(track: Track) {
    if (activeId === track.id) {
      // Toggle play/pause on same tile
      if (playing) {
        audioRef.current?.pause();
        setPlaying(false);
      } else {
        audioRef.current?.play();
        setPlaying(true);
      }
      return;
    }

    // Switch to new tile
    audioRef.current?.pause();
    setActiveId(track.id);
    setPlaying(false);

    const a = new Audio(track.music_url);
    a.onended = () => setPlaying(false);
    a.oncanplaythrough = () => {
      a.play().then(() => setPlaying(true)).catch(() => {});
    };
    a.load();
    audioRef.current = a;
  }

  function handleClose() {
    audioRef.current?.pause();
    setActiveId(null);
    setPlaying(false);
  }

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  const activeTrack = tracks.find((t) => t.id === activeId) ?? null;
  const activeColor = activeTrack ? colorFromId(activeTrack.id) : "#7C5BF5";

  const timeAgo = (date: string) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="px-5 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
            style={{ background: "var(--pill-dark)", color: "white" }}
          >
            ♪
          </div>
          <span className="text-sm font-bold" style={{ color: "var(--text)" }}>
            Atmospherica
          </span>
        </div>
        <Link href="/submit" className="btn-dark px-4 py-2 text-sm">
          + Share feeling
        </Link>
      </header>

      {/* Intro line */}
      <div className="px-5 pb-3 flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--text-2)" }}>
          {loading ? "Loading feelings…" : `${tracks.length} feelings, each turned into music`}
        </p>
        {!loading && tracks.length > 0 && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>tap a square to listen</p>
        )}
      </div>

      {/* Canvas grid */}
      <div className="flex-1 px-3 pb-4">
        {loading ? (
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))" }}
          >
            {Array.from({ length: 48 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg"
                style={{ aspectRatio: "1", background: "rgba(28,27,24,0.08)", animationDelay: `${i * 20}ms` }}
              />
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="card text-center py-16 px-8 mx-auto max-w-sm mt-8">
            <div className="text-5xl mb-4">🌫️</div>
            <p className="text-base font-semibold mb-1" style={{ color: "var(--text)" }}>
              No feelings yet
            </p>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Be the first to share one</p>
            <Link href="/submit" className="btn-dark px-6 py-2.5 text-sm inline-block">
              Share a feeling →
            </Link>
          </div>
        ) : (
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))" }}
          >
            {tracks.map((track, i) => (
              <FeelTile
                key={track.id}
                track={track}
                index={i}
                isActive={activeId === track.id}
                isPlaying={activeId === track.id && playing}
                onClick={() => handleTileClick(track)}
              />
            ))}
            {/* Phantom tiles to fill the row */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={`ph-${i}`} style={{ aspectRatio: "1" }} />
            ))}
          </div>
        )}
      </div>

      {/* Active track panel — slides up from bottom */}
      <div
        className="fixed left-0 right-0 bottom-0 z-50 transition-all duration-300 ease-out px-4 pb-5"
        style={{
          transform: activeTrack ? "translateY(0)" : "translateY(110%)",
          pointerEvents: activeTrack ? "auto" : "none",
        }}
      >
        <div
          className="card p-4 flex flex-col gap-3 max-w-md mx-auto"
          style={{
            borderTop: `3px solid ${activeColor}`,
            boxShadow: `0 -4px 40px ${activeColor}40, 0 4px 24px rgba(0,0,0,0.1)`,
          }}
        >
          {/* Top row */}
          <div className="flex items-center gap-3">
            {/* Color swatch */}
            <div
              className="w-10 h-10 rounded-xl flex-shrink-0"
              style={{ background: activeColor }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: "var(--text)" }}>
                {playing ? "Now playing" : "Paused"}
              </p>
              {activeTrack && (
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {activeTrack.guess_count} {activeTrack.guess_count === 1 ? "guess" : "guesses"} · {timeAgo(activeTrack.created_at)}
                </p>
              )}
            </div>

            {/* Play/pause */}
            <button
              onClick={() => activeTrack && handleTileClick(activeTrack)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-transform active:scale-95"
              style={{ background: activeColor, color: darken(activeColor) }}
            >
              {playing ? "⏸" : "▶"}
            </button>

            {/* Close */}
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0 transition-opacity hover:opacity-60"
              style={{ background: "var(--border)", color: "var(--text-2)" }}
            >
              ✕
            </button>
          </div>

          {/* Waveform strip */}
          <div className="flex items-end gap-[2px] h-8 px-1">
            {WAVEFORM.map((h, i) => (
              <div
                key={i}
                className={playing ? "waveform-bar" : ""}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  background: activeColor,
                  opacity: 0.5,
                  borderRadius: "2px",
                  transformOrigin: "bottom",
                  animationDelay: `${i * 0.08}s`,
                  transition: "opacity 0.3s",
                }}
              />
            ))}
          </div>

          {/* CTA */}
          {activeTrack && (
            <Link
              href={`/guess/${activeTrack.id}`}
              className="btn-dark py-3 text-sm text-center block"
            >
              Guess the feeling →
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
