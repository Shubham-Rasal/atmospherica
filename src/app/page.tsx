"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Track } from "@/types/supabase";

const PALETTE = [
  "#C084FC", "#818CF8", "#60A5FA", "#34D399",
  "#FBBF24", "#F87171", "#FB923C", "#A78BFA",
  "#38BDF8", "#4ADE80", "#F472B6", "#E879F9",
  "#FCD34D", "#6EE7B7", "#93C5FD", "#FCA5A5",
  "#86EFAC", "#BAE6FD", "#DDD6FE", "#FDE68A",
];

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function darken(hex: string, amount = 0.45): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.floor(((n >> 16) & 0xff) * (1 - amount));
  const g = Math.floor(((n >> 8) & 0xff) * (1 - amount));
  const b = Math.floor((n & 0xff) * (1 - amount));
  return `rgb(${r},${g},${b})`;
}

const WAVEFORM = [35, 58, 44, 84, 30, 74, 54, 90, 40, 70, 48, 80, 64, 36, 76];
const TILE_SIZE = 160;

const EXAMPLES = [
  "a rainy sunday morning with nowhere to be",
  "the silence after a crowd leaves",
  "driving through a city you don't know at night",
  "the last day of summer before everything changes",
  "standing on a rooftop watching the sun go down",
];

// ── Submit popup ─────────────────────────────────────────────
function SubmitPopup({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (track: Track) => void;
}) {
  const [feeling, setFeeling] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const trimmed = feeling.trim();
  const canSubmit = trimmed.length >= 5;

  const STEPS = [
    "Finding the right mood…",
    "Turning your words into sound…",
    "Rendering audio…",
    "Saving your track…",
  ];

  useEffect(() => {
    if (!loading) { setStep(0); return; }
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 3000);
    return () => clearInterval(id);
  }, [loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      let userId = localStorage.getItem("anymusic_uid");
      if (!userId) { userId = crypto.randomUUID(); localStorage.setItem("anymusic_uid", userId); }
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeling: trimmed, userId }),
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      // Build a local track object and pass it back — no redirect
      const newTrack: Track = {
        id: data.trackId,
        music_url: data.musicUrl,
        created_at: new Date().toISOString(),
        anon_user_id: userId,
        play_count: 0,
        guess_count: 0,
        revealed: false,
        tpuf_vector_id: data.trackId,
        feeling_text: trimmed,
      };
      onDone(newTrack);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(28,27,24,0.6)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (!loading && e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-3xl flex flex-col gap-4 p-6"
        style={{ background: "var(--surface)", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          /* Generating state */
          <div className="flex flex-col items-center py-6 gap-4 text-center">
            <div className="w-10 h-10 rounded-full border-[3px] border-[var(--border)] border-t-[var(--pill-dark)] animate-spin" />
            <p className="text-base font-bold" style={{ color: "var(--text)" }}>Making your track</p>
            <p className="text-sm" style={{ color: "var(--muted)" }}>{STEPS[step]}</p>
            <p className="text-xs" style={{ color: "var(--muted)", opacity: 0.6 }}>
              Don't close this — audio can take up to a minute
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold" style={{ color: "var(--text)" }}>Turn anything into music</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>a place, a moment, a feeling — anything goes</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-sm hover:opacity-60 transition-opacity"
                style={{ background: "var(--border)", color: "var(--text-2)" }}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="rounded-2xl overflow-hidden transition-all duration-150"
                style={{ border: `2px solid ${canSubmit ? "var(--pill-dark)" : "var(--border)"}`, background: "var(--surface-2)" }}>
                <textarea
                  value={feeling}
                  onChange={(e) => setFeeling(e.target.value)}
                  placeholder="e.g. a rainy night drive through a city you don't know…"
                  rows={4}
                  maxLength={500}
                  autoFocus
                  className="w-full bg-transparent border-none outline-none resize-none p-4 text-sm leading-relaxed"
                  style={{ color: "var(--text)", fontFamily: "var(--font-body, inherit)" }}
                />
                <div className="px-4 py-2 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>{feeling.length} / 500</span>
                  {canSubmit && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: "var(--tag-green-text)", background: "var(--tag-green-bg)" }}>ready ✓</span>}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" onClick={() => setFeeling(ex)}
                    className="text-xs px-2.5 py-1 rounded-full border transition-all"
                    style={{
                      borderColor: feeling === ex ? "var(--pill-dark)" : "var(--border)",
                      background: feeling === ex ? "var(--pill-dark)" : "transparent",
                      color: feeling === ex ? "white" : "var(--text-2)",
                    }}>
                    {ex.length > 36 ? ex.slice(0, 35) + "…" : ex}
                  </button>
                ))}
              </div>

              {error && <div className="text-xs px-3 py-2 rounded-xl" style={{ background: "var(--error-bg)", color: "var(--error)" }}>{error}</div>}

              <button type="submit" disabled={!canSubmit}
                className="w-full py-3.5 rounded-full text-sm font-bold transition-all"
                style={{
                  background: canSubmit ? "var(--pill-dark)" : "rgba(28,27,24,0.08)",
                  color: canSubmit ? "white" : "var(--text-2)",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                }}>
                {canSubmit ? "Generate music →" : "Type at least 5 characters"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Generating tile (in-place spinner) ───────────────────────
function GeneratingTile() {
  return (
    <div className="relative rounded-xl flex flex-col items-center justify-center gap-2"
      style={{ background: "rgba(28,27,24,0.06)", border: "1.5px dashed rgba(28,27,24,0.15)" }}>
      <div className="w-6 h-6 rounded-full border-2 border-transparent border-t-[var(--pill-dark)] animate-spin" style={{ borderTopColor: "var(--pill-dark)" }} />
      <span className="text-[9px] font-semibold tracking-wide" style={{ color: "var(--muted)" }}>GENERATING</span>
    </div>
  );
}

// ── Filled tile ───────────────────────────────────────────────
function FeelTile({ track, isActive, isPlaying, isNew, onClick }: {
  track: Track; isActive: boolean; isPlaying: boolean; isNew: boolean; onClick: () => void;
}) {
  const color = colorFromId(track.id);
  const textColor = darken(color);
  return (
    <button onClick={onClick} className="relative group focus:outline-none"
      style={{
        background: color,
        borderRadius: isActive ? "14px" : "6px",
        transform: isActive ? "scale(1.08)" : isNew ? "scale(1.04)" : "scale(1)",
        zIndex: isActive || isNew ? 10 : 1,
        transition: "border-radius 0.2s ease, transform 0.3s ease, box-shadow 0.2s ease",
        boxShadow: isActive
          ? `0 6px 28px ${color}99`
          : isNew
          ? `0 4px 20px ${color}77`
          : "none",
      }}>
      {!isActive && <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        style={{ borderRadius: "inherit", background: "rgba(255,255,255,0.3)" }} />}

      {isActive && (
        <div className="absolute inset-0 flex items-end justify-center gap-[1.5px] p-2" style={{ borderRadius: "inherit" }}>
          {WAVEFORM.map((h, i) => (
            <div key={i} className={isPlaying ? "waveform-bar" : ""}
              style={{ flex: 1, height: `${h}%`, background: textColor, opacity: 0.55, borderRadius: "2px", transformOrigin: "bottom", animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      )}

      {track.guess_count > 0 && !isActive && (
        <div className="absolute top-1 right-1 text-[8px] font-bold px-1 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.25)", color: "white" }}>
          {track.guess_count}
        </div>
      )}

      {/* "NEW" badge fades after appearing */}
      {isNew && !isActive && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ borderRadius: "inherit" }}>
          <span className="text-[10px] font-black tracking-widest" style={{ color: textColor, opacity: 0.6 }}>NEW</span>
        </div>
      )}
    </button>
  );
}

// ── Empty tile ────────────────────────────────────────────────
function EmptyTile({ onAdd }: { onAdd: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onAdd} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className="relative focus:outline-none"
      style={{
        background: hovered ? "rgba(28,27,24,0.07)" : "rgba(28,27,24,0.03)",
        borderRadius: "6px",
        border: `1.5px dashed ${hovered ? "rgba(28,27,24,0.2)" : "rgba(28,27,24,0.08)"}`,
        transition: "background 0.15s, border-color 0.15s",
      }}>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-light transition-opacity"
        style={{ color: "rgba(28,27,24,0.2)", opacity: hovered ? 1 : 0 }}>
        +
      </span>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────
type Slot = Track | "generating" | null;

export default function HomePage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [rawTracks, setRawTracks] = useState<Track[]>([]);
  const [scattered, setScattered] = useState(false);
  const [tileCount, setTileCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [totalGuesses, setTotalGuesses] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [submitSlot, setSubmitSlot] = useState<number | null>(null);
  const [newId, setNewId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const measureGrid = useCallback(() => {
    if (!gridRef.current) return;
    const { width, height } = gridRef.current.getBoundingClientRect();
    const cols = Math.floor(width / (TILE_SIZE + 6));
    const rows = Math.floor(height / (TILE_SIZE + 6));
    setTileCount(cols * rows);
  }, []);

  useEffect(() => {
    measureGrid();
    window.addEventListener("resize", measureGrid);
    return () => window.removeEventListener("resize", measureGrid);
  }, [measureGrid]);

  useEffect(() => {
    fetch("/api/tracks?limit=500")
      .then((r) => r.json())
      .then((d) => {
        const tracks: Track[] = d.tracks ?? [];
        const guesses = tracks.reduce((sum, t) => sum + (t.guess_count ?? 0), 0);
        setTotalGuesses(guesses);
        setRawTracks(tracks);
      })
      .finally(() => setLoading(false));
  }, []);

  // Scatter tracks randomly across the exact visible grid once both are known
  useEffect(() => {
    if (tileCount === 0 || rawTracks.length === 0 || scattered) return;
    const positions = Array.from({ length: tileCount }, (_, i) => i);
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    const sparse: Slot[] = Array(tileCount).fill(null);
    rawTracks.forEach((track, i) => {
      if (i < tileCount) sparse[positions[i]] = track;
    });
    setSlots(sparse);
    setScattered(true);
  }, [tileCount, rawTracks, scattered]);

  function handleTileClick(track: Track) {
    if (activeId === track.id) {
      if (playing) { audioRef.current?.pause(); setPlaying(false); }
      else { audioRef.current?.play(); setPlaying(true); }
      return;
    }
    audioRef.current?.pause();
    setActiveId(track.id);
    setPlaying(false);
    const a = new Audio(track.music_url);
    a.onended = () => setPlaying(false);
    a.oncanplaythrough = () => { a.play().then(() => setPlaying(true)).catch(() => {}); };
    a.load();
    audioRef.current = a;
  }

  function handleClose() {
    audioRef.current?.pause();
    setActiveId(null);
    setPlaying(false);
  }

  function openSubmit(slotIndex: number) {
    // Find first empty slot at or after slotIndex
    const target = slots.findIndex((s, i) => i >= slotIndex && s === null);
    setSubmitSlot(target === -1 ? slots.length : target);
  }

  function handleSubmitDone(track: Track) {
    setSlots((prev) => {
      const next = [...prev];
      const idx = submitSlot ?? 0;
      if (idx < next.length) {
        next[idx] = track;
      } else {
        next.push(track);
      }
      return next;
    });
    setTotalGuesses((g) => g);
    setSubmitSlot(null);
    setNewId(track.id);
    // Auto-play the new track
    setTimeout(() => {
      handleTileClick(track);
      setTimeout(() => setNewId(null), 4000);
    }, 200);
  }

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const tracks = slots.filter((s): s is Track => s !== null && s !== "generating");
  const activeTrack = tracks.find((t) => t.id === activeId) ?? null;
  const activeColor = activeTrack ? colorFromId(activeTrack.id) : "#7C5BF5";

  const timeAgo = (date: string) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const displaySlots = tileCount > 0
    ? slots.length >= tileCount
      ? slots.slice(0, tileCount)
      : [...slots, ...Array(tileCount - slots.length).fill(null)]
    : slots;

  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="px-5 pt-4 pb-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
            style={{ background: "var(--pill-dark)", color: "white" }}>♪</div>
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: "var(--text)" }}>anymusic</p>
            <p className="text-[10px] leading-tight" style={{ color: "var(--muted)" }}>
              {loading ? "loading…" : `${tracks.length} tracks · ${totalGuesses} guesses`}
            </p>
          </div>
        </div>
        <button onClick={() => openSubmit(slots.findIndex((s) => s === null))}
          className="btn-dark px-4 py-2 text-sm">
          + Add yours
        </button>
      </header>

      {/* Grid */}
      <div ref={gridRef} className="flex-1 px-3 pb-3"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, minmax(${TILE_SIZE}px, 1fr))`,
          gridAutoRows: `${TILE_SIZE}px`,
          gap: "6px",
          alignContent: "start",
          overflow: "hidden",
        }}>
        {loading
          ? Array.from({ length: 80 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-md"
                style={{ background: "rgba(28,27,24,0.07)", animationDelay: `${i * 15}ms` }} />
            ))
          : displaySlots.map((slot, i) => {
              if (slot === "generating") return <GeneratingTile key={`gen-${i}`} />;
              if (slot === null) return <EmptyTile key={`empty-${i}`} onAdd={() => openSubmit(i)} />;
              return (
                <FeelTile
                  key={slot.id}
                  track={slot}
                  isActive={activeId === slot.id}
                  isPlaying={activeId === slot.id && playing}
                  isNew={newId === slot.id}
                  onClick={() => handleTileClick(slot)}
                />
              );
            })
        }
      </div>

      {/* Bottom sheet */}
      <div className="fixed left-0 right-0 bottom-0 z-40 px-4 pb-5 transition-all duration-300 ease-out"
        style={{ transform: activeTrack ? "translateY(0)" : "translateY(110%)", pointerEvents: activeTrack ? "auto" : "none" }}>
        <div className="card p-4 flex flex-col gap-3 max-w-md mx-auto"
          style={{ borderTop: `3px solid ${activeColor}`, boxShadow: `0 -4px 40px ${activeColor}44, 0 4px 24px rgba(0,0,0,0.1)` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ background: activeColor }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{playing ? "Now playing" : "Paused"}</p>
              {activeTrack && (
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {activeTrack.guess_count} {activeTrack.guess_count === 1 ? "guess" : "guesses"} · {timeAgo(activeTrack.created_at)}
                </p>
              )}
            </div>
            <button onClick={() => activeTrack && handleTileClick(activeTrack)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 active:scale-95 transition-transform"
              style={{ background: activeColor, color: darken(activeColor) }}>
              {playing ? "⏸" : "▶"}
            </button>
            <button onClick={handleClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0 hover:opacity-60 transition-opacity"
              style={{ background: "var(--border)", color: "var(--text-2)" }}>✕</button>
          </div>

          <div className="flex items-end gap-[2px] h-7 px-1">
            {WAVEFORM.map((h, i) => (
              <div key={i} className={playing ? "waveform-bar" : ""}
                style={{ flex: 1, height: `${h}%`, background: activeColor, opacity: 0.5, borderRadius: "2px", transformOrigin: "bottom", animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>

          {activeTrack && (
            <a href={`/guess/${activeTrack.id}`} className="btn-dark py-3 text-sm text-center block">
              Guess what this is →
            </a>
          )}
        </div>
      </div>

      {/* Submit popup */}
      {submitSlot !== null && (
        <SubmitPopup
          onClose={() => setSubmitSlot(null)}
          onDone={handleSubmitDone}
        />
      )}
    </main>
  );
}
