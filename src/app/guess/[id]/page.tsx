"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function GuessPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const justSubmitted = searchParams.get("submitted") === "true";

  const [trackUrl, setTrackUrl] = useState<string | null>(null);
  const [guessCount, setGuessCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [guess, setGuess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`/api/tracks?limit=50`)
      .then((r) => r.json())
      .then((d) => {
        const track = (d.tracks ?? []).find(
          (t: { id: string; music_url: string; guess_count: number }) => t.id === id
        );
        if (track) { setTrackUrl(track.music_url); setGuessCount(track.guess_count); }
      })
      .finally(() => setLoading(false));
  }, [id]);

  function togglePlay() {
    if (!trackUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(trackUrl);
      audioRef.current.onended = () => {
        setPlaying(false); setProgress(0);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    if (playing) {
      audioRef.current.pause(); setPlaying(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      audioRef.current.play(); setPlaying(true);
      intervalRef.current = setInterval(() => {
        if (audioRef.current) {
          const pct = (audioRef.current.currentTime / (audioRef.current.duration || 22)) * 100;
          setProgress(pct);
        }
      }, 100);
    }
  }

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function handleGuess(e: React.FormEvent) {
    e.preventDefault();
    if (!guess.trim()) return;
    setSubmitting(true); setError("");
    try {
      let guesserId = localStorage.getItem("atmospherica_uid");
      if (!guesserId) { guesserId = crypto.randomUUID(); localStorage.setItem("atmospherica_uid", guesserId); }
      const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guessText: guess.trim(), trackId: id, guesserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.push(`/results/${id}?score=${encodeURIComponent(JSON.stringify(data.scorecard))}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  const bars = [35, 58, 44, 84, 30, 74, 54, 90, 40, 70, 48, 80, 64, 36, 76, 54, 46, 82, 58, 42,
                68, 50, 86, 32, 64, 90, 44, 56, 74, 36];

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="px-6 pt-5 pb-4 flex items-center gap-3">
        <Link
          href="/"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-opacity hover:opacity-70"
          style={{ background: "rgba(28,27,24,0.1)", color: "var(--text)" }}
        >
          ←
        </Link>
        <p className="text-sm font-bold" style={{ color: "var(--text)" }}>Guess the feeling</p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-6">
        <div className="w-full max-w-md fade-up flex flex-col gap-4">

          {/* Success banner */}
          {justSubmitted && (
            <div
              className="px-4 py-3 rounded-2xl text-sm text-center font-medium"
              style={{ background: "var(--pill-dark)", color: "white" }}
            >
              ✓ Your feeling was turned into music. Listen below!
            </div>
          )}

          {/* Step label */}
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "var(--pill-dark)", color: "white" }}
            >
              1
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Listen to the track</p>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--tag-green-bg)", color: "var(--tag-green-text)" }}>
              {guessCount} guesses
            </span>
          </div>

          {/* Player card */}
          {loading ? (
            <div className="card h-48 animate-pulse" />
          ) : (
            <div className="card overflow-hidden">
              {/* Waveform area */}
              <div
                className="px-6 pt-6 pb-5 transition-colors duration-500"
                style={{ background: playing ? "#F0ECFF" : "#FAFAF8" }}
              >
                <div className="flex items-end gap-[2px] h-16 mb-4">
                  {bars.map((h, i) => (
                    <div
                      key={i}
                      className={`rounded-full flex-1 ${playing ? "waveform-bar" : ""}`}
                      style={{
                        background:
                          i / bars.length < progress / 100
                            ? "var(--pill-dark)"
                            : playing
                            ? "rgba(124,91,245,0.35)"
                            : "#DEDAD2",
                        height: `${h}%`,
                        animationDelay: `${i * 0.04}s`,
                        transition: "background 0.15s",
                      }}
                    />
                  ))}
                </div>

                {/* Progress bar */}
                <div className="h-1 rounded-full overflow-hidden mb-4" style={{ background: "#DEDAD2" }}>
                  <div
                    className="h-full rounded-full score-bar"
                    style={{ width: `${progress}%`, background: "var(--pill-dark)" }}
                  />
                </div>

                {/* Play */}
                <button
                  onClick={togglePlay}
                  className="w-full py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-150"
                  style={{
                    background: playing ? "var(--pill-dark)" : "var(--pill-dark)",
                    color: "white",
                  }}
                >
                  <span style={{ fontSize: "11px" }}>{playing ? "⏸" : "▶"}</span>
                  {playing ? "Pause" : "Play track"}
                </button>
              </div>

              <div className="px-6 py-3" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
                  {playing ? "What emotion do you feel?" : "Press play before guessing"}
                </p>
              </div>
            </div>
          )}

          {/* Step 2 */}
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "var(--pill-dark)", color: "white" }}
            >
              2
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Describe what you feel</p>
          </div>

          {/* Guess card */}
          <div className="card p-5">
            <form onSubmit={handleGuess} className="flex flex-col gap-3">
              <textarea
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="Describe the emotion, feeling, or moment you hear in this music…"
                rows={3}
                maxLength={300}
                className="w-full rounded-2xl p-4 text-sm resize-none outline-none border-2 transition-all duration-150 leading-relaxed"
                style={{
                  background: "var(--surface-2)",
                  borderColor: guess.length > 0 ? "var(--pill-dark)" : "transparent",
                  color: "var(--text)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--pill-dark)"; }}
                onBlur={(e) => { if (!guess.length) e.currentTarget.style.borderColor = "transparent"; }}
              />

              <p className="text-xs" style={{ color: "var(--muted)" }}>
                💡 Nuanced descriptions score higher — &ldquo;heartbreak&rdquo; and &ldquo;the ache of losing someone&rdquo; score almost the same.
              </p>

              {error && (
                <div className="text-sm px-4 py-3 rounded-2xl" style={{ background: "var(--error-bg)", color: "var(--error)" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={guess.trim().length < 2 || submitting}
                className="btn-dark py-3.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Scoring your guess…
                  </span>
                ) : "Submit guess →"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
