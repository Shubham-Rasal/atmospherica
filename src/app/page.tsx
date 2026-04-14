"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import type { Track } from "@/types/supabase";
import { serializeError } from "@/lib/errors";

const WAVEFORM = [35, 58, 44, 84, 30, 74, 54, 90, 40, 70, 48, 80, 64, 36, 76];
const GAP = 4;
// Responsive tile size: smaller on mobile
function getTileSize() {
  if (typeof window === "undefined") return 120;
  if (window.innerWidth < 480) return 80;
  if (window.innerWidth < 768) return 100;
  return 140;
}
const TILE_SIZE = 140; // SSR default, overridden after mount
const PUZZLE_IMG = "/puzzle.png";

const EXAMPLES = [
  "a rainy sunday morning with nowhere to be",
  "the silence after a crowd leaves",
  "driving through a city you don't know at night",
  "the last day of summer before everything changes",
  "standing on a rooftop watching the sun go down",
];

const FAKE_NAMES = ["someone", "a stranger", "someone nearby", "an anonymous soul"];

const SUBMIT_LOADING_STEPS = [
  "Finding a matching emotional palette…",
  "Shaping the sound from your words…",
  "Synthesizing audio (this is the slow part)…",
  "Uploading audio & saving to the canvas…",
] as const;

/** Clock for relative times — only runs after mount so SSR and first paint match (no hydration mismatch). */
function useClientNowMs() {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setMs(Date.now()), 0);
    const id = window.setInterval(() => setMs(Date.now()), 60_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(id);
    };
  }, []);
  return ms;
}

// ── Helpers ───────────────────────────────────────────────────
type RevealLevel = "none" | "partial" | "full";

function tileStyle(index: number, cols: number, rows: number, reveal: RevealLevel): React.CSSProperties {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const xPct = cols > 1 ? (col / (cols - 1)) * 100 : 0;
  const yPct = rows > 1 ? (row / (rows - 1)) * 100 : 0;
  const filter =
    reveal === "full"    ? "none" :
    reveal === "partial" ? "brightness(0.42) saturate(0.3)" :
                           "brightness(0) saturate(0)";
  return {
    backgroundImage: `url(${PUZZLE_IMG})`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${xPct}% ${yPct}%`,
    filter,
    transition: "filter 0.7s ease",
  };
}

type SubmitPhase = "form" | "working" | "success";

// ── Submit popup ──────────────────────────────────────────────
function SubmitPopup({ onClose, onPlaced, onDone, gridPosition }: {
  onClose: () => void;
  /** Called as soon as the API returns — add the tile before the success animation (avoids stale slot state). */
  onPlaced: (track: Track) => void;
  onDone: (track: Track, submitAudio?: HTMLAudioElement) => void;
  gridPosition: number;
}) {
  const [feeling, setFeeling] = useState("");
  const [phase, setPhase] = useState<SubmitPhase>("form");
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  /** After API: whether browser let us autoplay (pending = still trying). */
  const [playState, setPlayState] = useState<"idle" | "trying" | "ok" | "blocked">("idle");
  const trimmed = feeling.trim();
  const canSubmit = trimmed.length >= 5;
  const busy = phase === "working" || phase === "success";

  useEffect(() => {
    if (phase !== "working") { setStep(0); return; }
    const id = window.setInterval(() => setStep((s) => (s + 1) % SUBMIT_LOADING_STEPS.length), 3200);
    return () => window.clearInterval(id);
  }, [phase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const playback = new Audio();
    setPhase("working");
    setPlayState("idle");
    setError("");
    try {
      let userId = localStorage.getItem("anymusic_uid");
      if (!userId) { userId = crypto.randomUUID(); localStorage.setItem("anymusic_uid", userId); }
      const res = await fetch("/api/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeling: trimmed, userId, gridPosition }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(serializeError(data.error ?? data));
      const track: Track = {
        id: data.trackId,
        music_url: data.musicUrl,
        created_at: new Date().toISOString(),
        anon_user_id: userId,
        play_count: 0,
        guess_count: 0,
        revealed: false,
        tpuf_vector_id: data.trackId,
        feeling_text: trimmed,
        grid_position: gridPosition,
      };
      // Commit success UI before parent grid update so users never flash back to the form / loading steps.
      flushSync(() => {
        setPhase("success");
        setPlayState("trying");
      });
      onPlaced(track);
      playback.src = data.musicUrl;
      playback.load();
      void playback
        .play()
        .then(() => {
          setPlayState("ok");
        })
        .catch((playErr) => {
          console.warn("[anymusic] Autoplay after submit blocked or failed — tap the tile to play:", playErr);
          setPlayState("blocked");
        });
      window.setTimeout(() => {
        onDone(track, playback);
      }, 3500);
    } catch (err) {
      setError(serializeError(err));
      setPhase("form");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
      onClick={(e) => { if (!busy && e.target === e.currentTarget) onClose(); }}>
      <div
        className="w-full max-w-md rounded-3xl flex flex-col gap-4 p-6 transition-[transform,opacity] duration-300"
        style={{
          background: "var(--surface)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
          transform: phase === "success" ? "scale(1.02)" : "scale(1)",
        }}
        onClick={(e) => e.stopPropagation()}>
        {phase === "working" && (
          <div className="flex flex-col gap-5 py-2">
            <div className="flex flex-col gap-2 text-center">
              <p className="text-lg font-bold tracking-tight" style={{ color: "var(--text)" }}>Making your sound…</p>
              <p className="text-sm leading-snug" style={{ color: "var(--muted)" }}>
                AI is composing a short clip from your words. Most finishes in under a minute — hang tight.
              </p>
            </div>
            <div className="reveal-progress-track w-full" aria-hidden>
              <div className="reveal-progress-bar w-[72%]" />
            </div>
            <div className="flex items-start gap-3 rounded-2xl px-3 py-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div className="w-9 h-9 rounded-full border-[3px] flex-shrink-0 animate-spin mt-0.5" style={{ borderColor: "var(--border)", borderTopColor: "var(--pill-dark)" }} />
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{SUBMIT_LOADING_STEPS[step]}</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>
                  You can keep this tab open — we&apos;ll show a clear success screen when it&apos;s ready.
                </p>
              </div>
            </div>
          </div>
        )}

        {phase === "success" && (
          <div
            className="flex flex-col items-center gap-4 py-3 text-center"
            role="status"
            aria-live="polite"
            aria-atomic="true">
            <div className="w-full rounded-2xl px-4 py-3 text-left" style={{ background: "var(--tag-green-bg)", border: "1px solid rgba(61,92,26,0.2)" }}>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--tag-green-text)", opacity: 0.85 }}>All done</p>
              <p className="text-sm font-semibold mt-1" style={{ color: "var(--text)" }}>
                Audio created, uploaded, and placed on the puzzle
              </p>
              <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-2)" }}>
                Generation and storage finished — your new tile is on the grid (watch for the highlight ring).
              </p>
            </div>
            <div
              className="reveal-success-icon w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{ background: "var(--surface-2)", border: "2px solid var(--border)", color: "var(--pill-dark)" }}>
              ✓
            </div>
            <div className="space-y-2 max-w-[300px] mx-auto">
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>All set</p>
              {playState === "trying" && (
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>Starting playback…</p>
              )}
              {playState === "ok" && (
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                  Listen in the bar below — pause anytime, or tap another tile on the puzzle.
                </p>
              )}
              {playState === "blocked" && (
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                  Tap your new tile once to hear the clip — this browser asked for a tap before playing sound.
                </p>
              )}
            </div>
            <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)", opacity: 0.75 }}>
              Closing…
            </p>
          </div>
        )}

        {phase === "form" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold" style={{ color: "var(--text)" }}>Add your piece</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>A place, a moment, a feeling — anything goes</p>
              </div>
              <button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-sm hover:opacity-60 transition-opacity"
                style={{ background: "var(--border)", color: "var(--text-2)" }}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="rounded-2xl overflow-hidden transition-all duration-150"
                style={{ border: `2px solid ${canSubmit ? "var(--pill-dark)" : "var(--border)"}`, background: "var(--surface-2)" }}>
                <textarea value={feeling} onChange={(e) => setFeeling(e.target.value)}
                  placeholder="e.g. a rainy night drive through a city you don't know…"
                  rows={4} maxLength={500} autoFocus
                  className="w-full bg-transparent border-none outline-none resize-none p-4 text-sm leading-relaxed"
                  style={{ color: "var(--text)", fontFamily: "var(--font-body, inherit)" }} />
                <div className="px-4 py-2 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>{feeling.length} / 500</span>
                  {canSubmit && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: "var(--tag-green-text)", background: "var(--tag-green-bg)" }}>ready</span>}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" onClick={() => setFeeling(ex)}
                    className="text-xs px-2.5 py-1 rounded-full border transition-all"
                    style={{ borderColor: feeling === ex ? "var(--pill-dark)" : "var(--border)", background: feeling === ex ? "var(--pill-dark)" : "transparent", color: feeling === ex ? "white" : "var(--text-2)" }}>
                    {ex.length > 36 ? ex.slice(0, 35) + "…" : ex}
                  </button>
                ))}
              </div>

              {error && (
                <div className="rounded-xl px-3 py-3 flex flex-col gap-1" style={{ background: "var(--error-bg)", border: "1px solid rgba(220,38,38,0.15)" }}>
                  <p className="text-xs font-bold" style={{ color: "var(--error)" }}>Couldn&apos;t save your piece</p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--error)", opacity: 0.92 }}>{error}</p>
                </div>
              )}

              <button type="submit" disabled={!canSubmit} className="w-full py-3.5 rounded-full text-sm font-bold transition-all"
                style={{ background: canSubmit ? "var(--pill-dark)" : "rgba(28,27,24,0.08)", color: canSubmit ? "white" : "var(--text-2)", cursor: canSubmit ? "pointer" : "not-allowed" }}>
                {canSubmit ? "Create my clip" : "Type at least 5 characters"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Fake busy tile ─────────────────────────────────────────────
function FakeBusyTile({ seed, index, cols, rows }: { seed: number; index: number; cols: number; rows: number }) {
  const [active, setActive] = useState(true);
  useEffect(() => { const t = setTimeout(() => setActive(false), 10000); return () => clearTimeout(t); }, []);
  const name = FAKE_NAMES[seed % FAKE_NAMES.length];
  if (!active) return (
    <div className="relative rounded-lg overflow-hidden" style={{ ...tileStyle(index, cols, rows, "none") }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white/20 text-2xl">+</span>
      </div>
    </div>
  );
  return (
    <div className="relative rounded-lg overflow-hidden" style={{ ...tileStyle(index, cols, rows, "none") }}>
      {/* Shimmer */}
      <div className="absolute inset-0" style={{
        background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.8s ease-in-out infinite",
      }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-3 text-center">
        <div className="flex gap-[4px] items-end h-9">
          {[40, 70, 50, 85, 35, 65, 55].map((h, i) => (
            <div key={i} className="waveform-bar rounded-full"
              style={{ width: 5, height: `${h}%`, background: "rgba(255,255,255,0.35)", transformOrigin: "bottom", animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
        <p className="text-sm font-semibold leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>
          {name} is<br />adding a track…
        </p>
      </div>
    </div>
  );
}

// ── Generating tile ────────────────────────────────────────────
function GeneratingTile({ index, cols, rows }: { index: number; cols: number; rows: number }) {
  return (
    <div className="relative rounded-lg overflow-hidden" style={{ ...tileStyle(index, cols, rows, "none") }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.7)" }} />
        <span className="text-[10px] font-bold tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>GENERATING</span>
      </div>
    </div>
  );
}

// ── Filled tile ────────────────────────────────────────────────
function FeelTile({ index, cols, rows, isActive, isPlaying, isNew, onClick }: {
  index: number; cols: number; rows: number;
  isActive: boolean; isPlaying: boolean; isNew: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className={`relative focus:outline-none ${isNew ? "tile-just-landed overflow-visible" : "overflow-hidden"}`}
      style={{
        ...tileStyle(index, cols, rows, "full"),
        filter: hovered && !isActive ? "brightness(1.18) saturate(1.12)" : undefined,
        borderRadius: isActive ? "14px" : "6px",
        transform: isActive ? "scale(1.06)" : "scale(1)",
        zIndex: isActive || isNew ? 10 : 1,
        transition: "filter 0.2s ease, border-radius 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
        boxShadow: isActive
          ? "0 8px 32px rgba(0,0,0,0.5)"
          : hovered
          ? "0 0 0 2.5px rgba(255,255,255,0.9)"
          : isNew ? "0 4px 20px rgba(0,0,0,0.4)" : "none",
      }}>
      {/* Always-visible subtle play icon */}
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150"
            style={{
              background: hovered ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.18)",
              backdropFilter: "blur(4px)",
              transform: hovered ? "scale(1.1)" : "scale(1)",
            }}>
            <span style={{ fontSize: hovered ? 14 : 11, color: hovered ? "#0a0a0a" : "rgba(255,255,255,0.8)", marginLeft: 2, transition: "all 0.15s" }}>▶</span>
          </div>
        </div>
      )}

      {/* Active waveform overlay */}
      {isActive && (
        <div className="absolute inset-0 flex flex-col items-end justify-between p-2.5"
          style={{ background: "rgba(0,0,0,0.35)" }}>
          <div className="flex gap-[2px] items-end w-full h-10">
            {WAVEFORM.map((h, i) => (
              <div key={i} className={isPlaying ? "waveform-bar" : ""}
                style={{ flex: 1, height: `${h}%`, background: "rgba(255,255,255,0.8)", borderRadius: "2px", transformOrigin: "bottom", animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* NEW badge */}
      {isNew && !isActive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-black tracking-widest px-2 py-1 rounded-full"
            style={{ background: "rgba(0,0,0,0.4)", color: "rgba(255,255,255,0.9)" }}>NEW</span>
        </div>
      )}
    </button>
  );
}

// ── Empty tile ─────────────────────────────────────────────────
function EmptyTile({ index, cols, rows, onAdd }: { index: number; cols: number; rows: number; onAdd: () => void }) {
  const [hovered, setHovered] = useState(false);
  const base = tileStyle(index, cols, rows, "none");
  return (
    <button onClick={onAdd} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className="relative focus:outline-none overflow-hidden"
      style={{
        ...base,
        filter: "brightness(0) saturate(0)",
        borderRadius: "6px",
        transition: "opacity 0.25s ease",
      }}>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-light transition-opacity duration-200"
        style={{ color: "rgba(255,255,255,0.4)", opacity: hovered ? 1 : 0 }}>
        +
      </span>
    </button>
  );
}

// ── Types ──────────────────────────────────────────────────────
type Slot = Track | "generating" | { fake: number } | null;

// ── Page ───────────────────────────────────────────────────────
export default function HomePage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [rawTracks, setRawTracks] = useState<Track[]>([]);
  const [scattered, setScattered] = useState(false);
  const [tileCount, setTileCount] = useState(0);
  const [gridDims, setGridDims] = useState({ cols: 1, rows: 1 });
  const [tileSize, setTileSize] = useState(TILE_SIZE);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [submitSlot, setSubmitSlot] = useState<number | null>(null);
  /** Bumps when opening the submit modal so SubmitPopup remounts with a clean phase (no stale form/success). */
  const [submitSessionId, setSubmitSessionId] = useState(0);
  const [newId, setNewId] = useState<string | null>(null);
  const [addedToast, setAddedToast] = useState<string | null>(null);
  const [master, setMaster] = useState<{
    url: string;
    version: number;
    tileCount: number;
    createdAt: string;
  } | null>(null);
  const [masterPlaying, setMasterPlaying] = useState(false);
  const [masterPulse, setMasterPulse] = useState(false);
  const lastMasterVersion = useRef<number | null>(null);
  const nowMs = useClientNowMs();
  const gridRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const masterAudioRef = useRef<HTMLAudioElement | null>(null);

  const measureGrid = useCallback(() => {
    if (!gridRef.current) return;
    const size = getTileSize();
    setTileSize(size);
    const { width, height } = gridRef.current.getBoundingClientRect();
    const cols = Math.floor(width / (size + GAP));
    const rows = Math.floor(height / (size + GAP));
    setGridDims({ cols, rows });
    setTileCount(cols * rows);
  }, []);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      measureGrid();
    });
    window.addEventListener("resize", measureGrid);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", measureGrid);
    };
  }, [measureGrid]);

  const fetchMaster = useCallback(async () => {
    try {
      const r = await fetch("/api/master");
      const d = await r.json();
      if (!r.ok) return;
      if (!d.url || typeof d.version !== "number") {
        setMaster(null);
        return;
      }
      if (lastMasterVersion.current !== null && d.version > lastMasterVersion.current) {
        setMasterPulse(true);
        window.setTimeout(() => setMasterPulse(false), 8000);
      }
      lastMasterVersion.current = d.version;
      setMaster({
        url: d.url,
        version: d.version,
        tileCount: d.tileCount ?? 0,
        createdAt: d.createdAt ?? "",
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const runSoon = () => queueMicrotask(() => void fetchMaster());
    runSoon();
    const intervalId = window.setInterval(() => void fetchMaster(), 10000);
    const onVis = () => {
      if (document.visibilityState === "visible") runSoon();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchMaster]);

  useEffect(() => {
    fetch("/api/tracks?limit=500")
      .then((r) => r.json())
      .then((d) => {
        const tracks: Track[] = Array.isArray(d.tracks) ? d.tracks : [];
        if (!Array.isArray(d.tracks) && d.error) {
          console.warn("/api/tracks failed:", d.error);
        }
        setRawTracks(tracks);
      })
      .catch((e) => {
        console.warn("/api/tracks fetch:", e);
        setRawTracks([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Build slots from stored grid_position, fall back to random for legacy tracks
  useEffect(() => {
    if (tileCount === 0 || loading || scattered) return;
    const sparse: Slot[] = Array(tileCount).fill(null);

    // Place tracks that have a stored position first
    const unplaced: Track[] = [];
    rawTracks.forEach((track) => {
      const pos = track.grid_position;
      if (pos !== null && pos !== undefined && pos < tileCount && sparse[pos] === null) {
        sparse[pos] = track;
      } else {
        unplaced.push(track);
      }
    });

    // Randomly assign positions for legacy tracks (no grid_position) and persist them
    const empties = sparse.map((s, i) => s === null ? i : -1).filter((i) => i !== -1);
    for (let i = empties.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [empties[i], empties[j]] = [empties[j], empties[i]];
    }
    const toSave: { id: string; grid_position: number }[] = [];
    unplaced.forEach((track, i) => {
      if (i < empties.length) {
        sparse[empties[i]] = track;
        toSave.push({ id: track.id, grid_position: empties[i] });
      }
    });
    // Persist so positions are stable on reload
    if (toSave.length > 0) {
      fetch("/api/tracks/positions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions: toSave }),
      }).catch(() => {});
    }

    // Add 2 fake tiles
    const remaining = sparse.map((s, i) => s === null ? i : -1).filter((i) => i !== -1);
    for (let f = 0; f < 2 && remaining.length > 0; f++) {
      const pick = Math.floor(Math.random() * remaining.length);
      sparse[remaining[pick]] = { fake: f };
      remaining.splice(pick, 1);
    }
    // Must apply in the same synchronous turn — deferring (e.g. queueMicrotask) lets mergeTrackIntoBoard
    // run first while scattered is still false; a later setSlots(sparse) can wipe the new tile and remount logic.
    /* eslint-disable react-hooks/set-state-in-effect -- batching slots+scattered synchronously avoids grid/submit race */
    setSlots(sparse);
    setScattered(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [tileCount, rawTracks, scattered, loading]);

  function handleTileClick(track: Track) {
    masterAudioRef.current?.pause();
    setMasterPlaying(false);
    if (activeId === track.id) {
      if (playing) { audioRef.current?.pause(); setPlaying(false); }
      else { audioRef.current?.play(); setPlaying(true); }
      return;
    }
    audioRef.current?.pause();
    setActiveId(track.id); setPlaying(false);
    const a = new Audio(track.music_url);
    a.onended = () => setPlaying(false);
    a.oncanplaythrough = () => { a.play().then(() => setPlaying(true)).catch(() => {}); };
    a.load();
    audioRef.current = a;
  }

  function handleMasterClick() {
    if (!master?.url) return;
    audioRef.current?.pause();
    setPlaying(false);
    setActiveId(null);
    if (masterPlaying) {
      masterAudioRef.current?.pause();
      setMasterPlaying(false);
      return;
    }
    masterAudioRef.current?.pause();
    const a = new Audio(master.url);
    a.onended = () => setMasterPlaying(false);
    a.oncanplaythrough = () => {
      a.play().then(() => setMasterPlaying(true)).catch(() => {});
    };
    a.load();
    masterAudioRef.current = a;
  }

  function handleClose() { audioRef.current?.pause(); setActiveId(null); setPlaying(false); }

  function openSubmit(slotIndex: number) {
    if (submitSlot !== null) return;
    const target = slots.findIndex((s, i) => i >= slotIndex && s === null);
    setSubmitSessionId((s) => s + 1);
    setSubmitSlot(target === -1 ? slots.length : target);
  }

  function mergeTrackIntoBoard(track: Track) {
    window.setTimeout(() => {
      setAddedToast("Your clip is on the puzzle");
      window.setTimeout(() => setAddedToast(null), 5200);
    }, 400);
    setSlots((prev) => {
      const raw =
        typeof track.grid_position === "number" ? track.grid_position : 0;
      const idx =
        tileCount > 0 ? Math.min(Math.max(0, raw), tileCount - 1) : Math.max(0, raw);
      const len = tileCount > 0 ? tileCount : Math.max(prev.length, idx + 1);
      const next: Slot[] = Array.from({ length: len }, (_, i) =>
        i < prev.length ? (prev[i] ?? null) : null
      );
      next[idx] = track;
      return next;
    });
    setRawTracks((r) => {
      if (r.some((t) => t.id === track.id)) return r;
      return [track, ...r];
    });
  }

  function handleSubmitDone(track: Track, submitAudio?: HTMLAudioElement) {
    setSubmitSlot(null);
    setNewId(track.id);
    window.setTimeout(() => void fetchMaster(), 35000);
    window.setTimeout(() => setNewId(null), 4000);
    if (submitAudio) {
      audioRef.current = submitAudio;
      submitAudio.onended = () => setPlaying(false);
      setActiveId(track.id);
      setPlaying(true);
    }
  }

  useEffect(() => () => {
    audioRef.current?.pause();
    masterAudioRef.current?.pause();
  }, []);

  const tracks = slots.filter((s): s is Track => s !== null && s !== "generating" && !("fake" in (s as object)));
  const activeTrack = tracks.find((t) => t.id === activeId) ?? null;

  const { cols, rows } = gridDims;

  const displaySlots = tileCount > 0
    ? slots.length >= tileCount ? slots.slice(0, tileCount) : [...slots, ...Array(tileCount - slots.length).fill(null)]
    : slots;

  const revealedCount = tracks.length;
  const pct = tileCount > 0 ? Math.round((revealedCount / tileCount) * 100) : 0;

  const timeAgo = (date: string) => {
    if (nowMs === null) return "";
    const s = Math.floor((nowMs - new Date(date).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  let bottomSheetSubtitle: string | null = null;
  if (activeTrack) {
    if (nowMs === null) bottomSheetSubtitle = "—";
    else {
      const ta = timeAgo(activeTrack.created_at);
      bottomSheetSubtitle =
        ta === "just now" ? "Just added to the mosaic" : `${ta} · pick another tile for a different clip`;
    }
  }

  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#0a0a0a" }}>
      {/* Header */}
      {addedToast && (
        <div
          className="fixed left-1/2 z-[60] max-w-[min(92vw,360px)] -translate-x-1/2 px-4 py-2.5 rounded-2xl text-center text-sm font-semibold shadow-lg transition-all"
          style={{
            top: "max(12px, env(safe-area-inset-top))",
            background: "rgba(28,27,24,0.92)",
            color: "white",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
            backdropFilter: "blur(12px)",
          }}>
          {addedToast}
        </div>
      )}

      <header className="px-5 pt-4 pb-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
            style={{ background: "white", color: "#0a0a0a" }}>♪</div>
          <div>
            <p className="text-sm font-bold leading-tight text-white">anymusic</p>
            <p className="text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.4)" }}>
              {loading ? "loading…" : `${pct}% filled · ${revealedCount} ${revealedCount === 1 ? "piece" : "pieces"}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={submitSlot !== null}
          onClick={() => openSubmit(slots.findIndex((s) => s === null))}
          className="px-4 py-2 text-sm font-semibold rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "white", color: "#0a0a0a" }}>
          + Add a piece
        </button>
      </header>

      {/* Puzzle grid */}
      <div ref={gridRef} className="flex-1 px-2 pb-2"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))`,
          gridAutoRows: `${tileSize}px`,
          gap: `${GAP}px`,
          alignContent: "start",
          overflow: "hidden",
        }}>
        {loading
          ? Array.from({ length: 80 }).map((_, i) => (
              <div key={i} className="rounded-md animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
            ))
          : displaySlots.map((slot, i) => {
              if (slot === "generating") return <GeneratingTile key={`gen-${i}`} index={i} cols={cols} rows={rows} />;
              if (slot !== null && typeof slot === "object" && "fake" in slot)
                return <FakeBusyTile key={`fake-${i}`} seed={(slot as { fake: number }).fake} index={i} cols={cols} rows={rows} />;
              if (slot === null) return <EmptyTile key={`empty-${i}`} index={i} cols={cols} rows={rows} onAdd={() => openSubmit(i)} />;
              return (
                <FeelTile key={slot.id} index={i} cols={cols} rows={rows}
                  isActive={activeId === slot.id} isPlaying={activeId === slot.id && playing}
                  isNew={newId === slot.id} onClick={() => handleTileClick(slot)} />
              );
            })
        }
      </div>

      {/* Bottom sheet */}
      <div className="fixed left-0 right-0 bottom-0 z-40 px-4 pb-5 transition-all duration-300 ease-out"
        style={{ transform: activeTrack ? "translateY(0)" : "translateY(110%)", pointerEvents: activeTrack ? "auto" : "none" }}>
        <div className="p-4 flex flex-col gap-3 max-w-md mx-auto rounded-2xl"
          style={{ background: "rgba(20,20,20,0.95)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 -4px 40px rgba(0,0,0,0.6)" }}>
          <div className="flex items-center gap-3">
            {/* Tiny puzzle preview */}
            <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden"
              style={activeTrack ? tileStyle(slots.findIndex((s) => s !== null && typeof s === "object" && "id" in s && (s as Track).id === activeTrack.id), cols, rows, "full") : { background: "#333" }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{playing ? "Playing your clip" : "Paused"}</p>
              {activeTrack && bottomSheetSubtitle !== null && (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{bottomSheetSubtitle}</p>
              )}
            </div>
            <button onClick={() => activeTrack && handleTileClick(activeTrack)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 active:scale-95 transition-transform"
              style={{ background: "white", color: "#0a0a0a" }}>
              {playing ? "⏸" : "▶"}
            </button>
            <button onClick={handleClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0 hover:opacity-60 transition-opacity"
              style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>✕</button>
          </div>

          {activeTrack?.feeling_text && (
            <p className="text-sm leading-relaxed px-0.5" style={{ color: "rgba(255,255,255,0.85)" }}>
              {activeTrack.feeling_text}
            </p>
          )}

          <div className="flex items-end gap-[2px] h-7 px-1">
            {WAVEFORM.map((h, i) => (
              <div key={i} className={playing ? "waveform-bar" : ""}
                style={{ flex: 1, height: `${h}%`, background: "rgba(255,255,255,0.4)", borderRadius: "2px", transformOrigin: "bottom", animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        </div>
      </div>

      {master && (
        <div className="fixed z-[45] flex flex-col items-end gap-1.5"
          style={{ right: "max(16px, env(safe-area-inset-right))", bottom: "max(20px, env(safe-area-inset-bottom))" }}>
          <button
            type="button"
            onClick={handleMasterClick}
            className={`flex flex-col items-end gap-0.5 rounded-2xl px-4 py-3 text-left transition-transform active:scale-[0.98] ${masterPulse ? "master-track-pulse" : ""}`}
            style={{
              background: "rgba(20,20,20,0.92)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
              backdropFilter: "blur(12px)",
            }}>
            <span className="text-sm font-bold text-white">
              {masterPlaying ? "⏸ Pause collective track" : "🎵 Play collective track"}
            </span>
            <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>
              v{master.version} · {master.tileCount} {master.tileCount === 1 ? "piece" : "pieces"}
            </span>
          </button>
        </div>
      )}

      {submitSlot !== null && (
        <SubmitPopup
          key={submitSessionId}
          onClose={() => setSubmitSlot(null)}
          onPlaced={mergeTrackIntoBoard}
          onDone={handleSubmitDone}
          gridPosition={submitSlot}
        />
      )}
    </main>
  );
}
