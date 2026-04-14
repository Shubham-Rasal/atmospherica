"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import type { Track } from "@/types/supabase";
import { serializeError } from "@/lib/errors";

const WAVEFORM = [35, 58, 44, 84, 30, 74, 54, 90, 40, 70, 48, 80, 64, 36, 76];

const EXAMPLES = [
  "a rainy sunday morning with nowhere to be",
  "the silence after a crowd leaves",
  "driving through a city you don't know at night",
  "the last day of summer before everything changes",
];

const SUBMIT_LOADING_STEPS = [
  "Finding a matching emotional palette…",
  "Shaping the sound from your words…",
  "Synthesizing audio…",
  "Uploading your clip to the stream…",
] as const;

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

type SubmitPhase = "form" | "working" | "success";

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.2v13.6l10.5-6.8L8 5.2z" />
    </svg>
  );
}

function IconPause({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="4.5" width="4.5" height="15" rx="1.5" />
      <rect x="13.5" y="4.5" width="4.5" height="15" rx="1.5" />
    </svg>
  );
}

function IconSkip({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6l8.5 6L6 18V6z M17 4h3v16h-3z" />
    </svg>
  );
}

function IconPrev({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M5 4h3v16H5z M9.5 6L18 12 9.5 18z" />
    </svg>
  );
}

function SubmitModal({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted: (track: Track) => void;
}) {
  const [feeling, setFeeling] = useState("");
  const [phase, setPhase] = useState<SubmitPhase>("form");
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [playState, setPlayState] = useState<"idle" | "trying" | "ok" | "blocked">("idle");
  const trimmed = feeling.trim();
  const canSubmit = trimmed.length >= 5;
  const busy = phase === "working" || phase === "success";

  useEffect(() => {
    if (phase !== "working") {
      setStep(0);
      return;
    }
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
      if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem("anymusic_uid", userId);
      }
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeling: trimmed, userId }),
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
        grid_position: null,
        queue_order: null,
      };
      onSubmitted(track);
      flushSync(() => {
        setPhase("success");
        setPlayState("trying");
      });
      playback.src = data.musicUrl;
      playback.load();
      void playback
        .play()
        .then(() => setPlayState("ok"))
        .catch(() => setPlayState("blocked"));
      window.setTimeout(() => onClose(), 2800);
    } catch (err) {
      setError(serializeError(err));
      setPhase("form");
    }
  }

  return (
    <div
      className="mood-modal-backdrop"
      onClick={(e) => {
        if (!busy && e.target === e.currentTarget) onClose();
      }}>
      <div className="mood-modal-panel flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        {phase === "working" && (
          <div className="flex flex-col gap-4 py-1">
            <p className="text-base font-semibold text-center" style={{ color: "var(--mood-ink-soft)" }}>
              Making your clip…
            </p>
            <div className="reveal-progress-track w-full" aria-hidden>
              <div className="reveal-progress-bar w-[72%]" />
            </div>
            <div className="mood-modal-loading-card">
              <div className="mood-modal-spinner mt-0.5" aria-hidden />
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug" style={{ color: "var(--mood-ink-soft)" }}>
                  {SUBMIT_LOADING_STEPS[step]}
                </p>
              </div>
            </div>
          </div>
        )}

        {phase === "success" && (
          <div className="flex flex-col items-center gap-3 py-3 text-center" role="status" aria-live="polite">
            <div className="mood-modal-success w-full text-left">
              <p>On the air — your mood is weaving into the stream.</p>
            </div>
            {playState === "trying" && (
              <p className="text-sm" style={{ color: "var(--mood-ink-mute)" }}>
                Starting playback…
              </p>
            )}
            {playState === "ok" && (
              <p className="text-sm" style={{ color: "var(--mood-ink-mute)" }}>
                Listen on the main dial — it may already be live.
              </p>
            )}
            {playState === "blocked" && (
              <p className="text-sm" style={{ color: "var(--mood-ink-mute)" }}>
                Tap play on the player if you don&apos;t hear audio.
              </p>
            )}
          </div>
        )}

        {phase === "form" && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold font-[family-name:var(--font-display)]" style={{ color: "var(--mood-ink)" }}>
                  Add to the stream
                </p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--mood-ink-mute)" }}>
                  One line becomes a short clip for everyone tuning in.
                </p>
              </div>
              <button type="button" onClick={onClose} className="mood-modal-close" aria-label="Close">
                <span className="text-lg leading-none opacity-70">×</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="mood-modal-field">
                <textarea
                  value={feeling}
                  onChange={(e) => setFeeling(e.target.value)}
                  placeholder="How does it feel right now?"
                  rows={3}
                  maxLength={500}
                  autoFocus
                />
                <div className="mood-modal-field-foot">
                  <span>{feeling.length} / 500</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setFeeling(ex)}
                    className={`mood-example-chip ${feeling === ex ? "is-on" : ""}`}>
                    {ex.length > 38 ? ex.slice(0, 37) + "…" : ex}
                  </button>
                ))}
              </div>
              {error && (
                <div
                  className="rounded-xl px-3 py-3"
                  style={{
                    background: "color-mix(in oklch, oklch(0.5 0.2 25) 15%, transparent)",
                    border: "1px solid color-mix(in oklch, oklch(0.55 0.22 25) 35%, transparent)",
                  }}>
                  <p className="text-xs font-bold" style={{ color: "oklch(0.72 0.16 25)" }}>
                    Couldn&apos;t add your clip
                  </p>
                  <p className="text-xs mt-1 opacity-95" style={{ color: "oklch(0.78 0.12 25)" }}>
                    {error}
                  </p>
                </div>
              )}
              <button type="submit" disabled={!canSubmit} className="mood-modal-submit">
                {canSubmit ? "Send to the stream" : "At least 5 characters"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function timeAgoLabel(date: string, nowMs: number | null): string {
  if (nowMs === null) return "";
  const s = Math.floor((nowMs - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function moodLabel(t: Pick<Track, "feeling_text" | "created_at">, nowMs: number | null): string {
  const text = t.feeling_text?.trim();
  if (text) return text;
  const ago = nowMs !== null ? timeAgoLabel(t.created_at, nowMs) : "";
  return ago ? `A mood from ${ago}` : "A mood from the stream";
}

function buildTrackShareUrl(trackId: string): string {
  if (typeof window === "undefined") return "";
  const u = new URL(window.location.href);
  u.search = "";
  u.searchParams.set("track", trackId);
  return u.toString();
}

function trackPublicJson(t: Track) {
  return JSON.stringify(
    {
      id: t.id,
      feeling_text: t.feeling_text,
      music_url: t.music_url,
      created_at: t.created_at,
    },
    null,
    2
  );
}

export default function MoodRadioPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const nowMs = useClientNowMs();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const deepLinkTrackIdRef = useRef<string | null>(null);
  const autoplayRef = useRef(true);
  const skipUrlSyncRef = useRef(true);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    deepLinkTrackIdRef.current = new URLSearchParams(window.location.search).get("track");
    autoplayRef.current = new URLSearchParams(window.location.search).get("autoplay") !== "0";
  }, []);

  const fetchTracks = useCallback(async (): Promise<Track[]> => {
    try {
      const r = await fetch("/api/tracks?limit=100");
      const d = await r.json();
      if (!r.ok) return [];
      const list: Track[] = Array.isArray(d.tracks) ? d.tracks : [];
      setTracks(list);
      return list;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTracks();
    const id = window.setInterval(() => void fetchTracks(), 12000);
    return () => window.clearInterval(id);
  }, [fetchTracks]);

  useEffect(() => {
    if (tracks.length === 0) return;
    setCurrentIndex((i) => Math.min(i, tracks.length - 1));
  }, [tracks.length]);

  useEffect(() => {
    if (tracks.length === 0) return;
    const wanted = deepLinkTrackIdRef.current;
    if (wanted) {
      const idx = tracks.findIndex((t) => t.id === wanted);
      deepLinkTrackIdRef.current = null;
      if (idx >= 0) setCurrentIndex(idx);
    }
    skipUrlSyncRef.current = false;
  }, [tracks]);

  const current = tracks.length > 0 ? tracks[currentIndex] ?? tracks[0] : null;

  useEffect(() => {
    if (!current?.id || typeof window === "undefined") return;
    if (skipUrlSyncRef.current) return;
    const u = new URL(window.location.href);
    u.searchParams.set("track", current.id);
    window.history.replaceState({}, "", u.toString());
  }, [current?.id]);

  useEffect(() => {
    if (!current || tracks.length === 0) return;
    audioRef.current?.pause();
    setPlaying(false);
    const a = new Audio(current.music_url);
    a.playbackRate = playbackRate;
    const n = tracks.length;
    a.onended = () => {
      setPlaying(false);
      if (n <= 1) return;
      setCurrentIndex((i) => (i + 1) % n);
    };
    a.oncanplaythrough = () => {
      if (!autoplayRef.current) return;
      void a.play().then(() => setPlaying(true)).catch(() => {});
    };
    a.load();
    audioRef.current = a;
    return () => {
      a.pause();
    };
  }, [currentIndex, current?.id, current?.music_url, tracks.length]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = playbackRate;
  }, [playbackRate]);

  const goToIndex = useCallback((idx: number) => {
    if (idx < 0 || idx >= tracks.length) return;
    setCurrentIndex(idx);
  }, [tracks.length]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || !current) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [playing, current]);

  const skipNext = useCallback(() => {
    if (tracks.length <= 1) return;
    setCurrentIndex((i) => (i + 1) % tracks.length);
  }, [tracks.length]);

  const skipPrev = useCallback(() => {
    if (tracks.length <= 1) return;
    setCurrentIndex((i) => (i - 1 + tracks.length) % tracks.length);
  }, [tracks.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (e.key === "j" || e.key === "J" || e.key === "ArrowRight") {
        e.preventDefault();
        skipNext();
        return;
      }
      if (e.key === "k" || e.key === "K" || e.key === "ArrowLeft") {
        e.preventDefault();
        skipPrev();
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, skipNext, skipPrev]);

  async function copyText(text: string, okMsg: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(okMsg);
    } catch {
      showToast("Couldn’t copy — try selecting the text manually");
    }
  }

  async function shareCurrentClip() {
    if (!current) return;
    const url = buildTrackShareUrl(current.id);
    const text = moodLabel(current, nowMs);
    try {
      if (navigator.share) {
        await navigator.share({ title: "anymusic", text, url });
        return;
      }
    } catch {
      /* user cancelled or share failed */
    }
    await copyText(url, "Link copied");
  }

  function handleSubmitted(track: Track) {
    showToast("New mood added — slotted by emotional match");
    void fetchTracks().then((list) => {
      const idx = list.findIndex((t) => t.id === track.id);
      setCurrentIndex(idx >= 0 ? idx : 0);
    });
  }

  useEffect(() => () => audioRef.current?.pause(), []);

  const apiTracksUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/tracks?limit=100` : "/api/tracks?limit=100";

  return (
    <main className="mood-radio min-h-screen flex flex-col">
      {toast && <div className="mood-toast">{toast}</div>}

      <div className="mood-radio-inner flex flex-col flex-1">
        <header className="px-5 sm:px-8 pt-10 sm:pt-14 pb-8 text-center max-w-2xl mx-auto w-full">
          <div className="mood-hero-line" aria-hidden />
          <p className="mood-kicker mb-4">anymusic</p>
          <h1 className="mood-title">
            Tune into the internet&apos;s mood <em>right now</em>
          </h1>
          <p className="mood-sub mt-5">
            One-line feelings become sound. Share a clip, remix speed, wire it into your own tools — it&apos;s yours to play with.
          </p>
          <button
            type="button"
            disabled={submitOpen}
            onClick={() => setSubmitOpen(true)}
            className="mood-cta mt-8">
            <span className="opacity-90">+</span> Add your mood
          </button>
        </header>

        <section className="flex-1 px-4 sm:px-6 pb-10 max-w-lg mx-auto w-full flex flex-col gap-8">
          <div className="mood-player-shell relative">
            <div className="mood-player-glow" aria-hidden />
            <div className="relative z-[1] flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <span className="mood-live-pill">
                  <span className="mood-live-dot" />
                  On air
                </span>
              </div>

              {loading && !current ? (
                <div className="mood-skeleton" />
              ) : !current ? (
                <p className="text-center text-sm py-10 mood-sub max-w-none">
                  The dial is quiet. Be the first voice on the wire.
                </p>
              ) : (
                <>
                  <div className="min-h-[5rem]">
                    <p className="mood-now-text">{moodLabel(current, nowMs)}</p>
                    <p className="mood-meta mt-3">
                      {nowMs !== null ? timeAgoLabel(current.created_at, nowMs) : ""}
                      <span className="mx-2 opacity-40">·</span>
                      <span style={{ color: "var(--mood-accent-dim)" }}>now playing</span>
                    </p>
                  </div>

                  <div className={`mood-waveform ${playing ? "is-playing" : ""}`} aria-hidden>
                    {WAVEFORM.map((h, i) => (
                      <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.06}s` }} />
                    ))}
                  </div>

                  <div className="flex flex-col items-center gap-3 pt-1">
                    <div className="mood-transport-row">
                      {tracks.length > 1 && (
                        <button type="button" onClick={skipPrev} className="mood-skip inline-flex items-center gap-2" title="Previous (K)">
                          <IconPrev />
                          Prev
                        </button>
                      )}
                      <button type="button" onClick={togglePlay} className="mood-play-btn" aria-label={playing ? "Pause" : "Play"}>
                        {playing ? <IconPause /> : <IconPlay />}
                      </button>
                      {tracks.length > 1 && (
                        <button type="button" onClick={skipNext} className="mood-skip inline-flex items-center gap-2" title="Next (J)">
                          <IconSkip />
                          Next
                        </button>
                      )}
                    </div>
                    <div className="mood-transport-row w-full max-w-sm">
                      <button type="button" className="mood-share-pill" onClick={() => void shareCurrentClip()}>
                        Share this clip
                      </button>
                      <button
                        type="button"
                        className="mood-share-pill"
                        onClick={() => void copyText(buildTrackShareUrl(current.id), "Link copied — send it anywhere")}>
                        Copy link
                      </button>
                    </div>
                    <p className="mood-kbd-hint w-full">
                      Space play · <kbd className="opacity-80">J</kbd> next · <kbd className="opacity-80">K</kbd> prev · add{" "}
                      <code className="opacity-90">?autoplay=0</code> to load without playing
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <details className="mood-hack">
            <summary>Tinker &amp; open data</summary>
            <div className="mood-hack-body">
              <div>
                <p className="mood-hack-label">Playback speed</p>
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(Number(e.target.value))}
                  aria-valuetext={`${playbackRate.toFixed(2)}×`}
                />
                <p className="mood-meta mt-1">{playbackRate.toFixed(2)}× — affects the HTMLAudioElement in real time</p>
              </div>

              {current && (
                <>
                  <div>
                    <p className="mood-hack-label">Clipboard</p>
                    <div className="mood-hack-row">
                      <button
                        type="button"
                        className="mood-hack-btn"
                        onClick={() => void copyText(trackPublicJson(current), "JSON copied")}>
                        Copy clip JSON
                      </button>
                      <button
                        type="button"
                        className="mood-hack-btn"
                        onClick={() => void copyText(current.music_url, "Direct audio URL copied")}>
                        Copy MP3 URL
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="mood-hack-label">HTTP</p>
                    <p className="mood-hack-code mb-2">GET {apiTracksUrl}</p>
                    <button type="button" className="mood-hack-btn w-full" onClick={() => void copyText(apiTracksUrl, "API URL copied")}>
                      Copy tracks endpoint
                    </button>
                  </div>
                  <div>
                    <p className="mood-hack-label">URL params</p>
                    <p className="mood-hack-code">
                      ?track=&lt;uuid&gt; — deep-link to a clip
                      <br />
                      ?autoplay=0 — open without auto-play (good for sharing)
                    </p>
                  </div>
                </>
              )}
            </div>
          </details>

          <div>
            <h2 className="mood-section-label">The mood queue</h2>
            <p className="mood-meta mb-3 -mt-1 max-w-md">
              Clips are ordered by emotional fit: each new feeling is placed next to its closest match in Turbopuffer.
            </p>
            <ul className="mood-feed">
              {tracks.slice(0, 40).map((t, i) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => goToIndex(i)}
                    className={`mood-feed-item ${current?.id === t.id ? "is-active" : ""}`}>
                    <p className="mood-feed-text">{moodLabel(t, nowMs)}</p>
                    <p className="mood-feed-meta">
                      {nowMs !== null ? timeAgoLabel(t.created_at, nowMs) : ""}
                      {current?.id === t.id ? (
                        <>
                          <span className="mx-1.5 opacity-40">·</span>
                          <span style={{ color: "var(--mood-accent-dim)" }}>playing</span>
                        </>
                      ) : null}
                    </p>
                  </button>
                </li>
              ))}
              {!loading && tracks.length === 0 && (
                <li className="text-center text-sm py-8 mood-sub max-w-none">Nothing in the queue yet.</li>
              )}
            </ul>
          </div>
        </section>
      </div>

      {submitOpen && (
        <SubmitModal onClose={() => setSubmitOpen(false)} onSubmitted={handleSubmitted} />
      )}
    </main>
  );
}
