"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { Scorecard } from "@/types/supabase";

function ScoreRow({ label, value, max = 100, suffix = "%", description, color, bgColor, delay = 0 }: {
  label: string; value: number; max?: number; suffix?: string;
  description: string; color: string; bgColor: string; delay?: number;
}) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDisplayed(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  const pct = suffix === "%" ? displayed : Math.max(5, 100 - ((displayed - 1) / Math.max(max - 1, 1)) * 100);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{label}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{description}</p>
        </div>
        <span className="text-xl font-black tabular-nums shrink-0" style={{ color }}>
          {suffix === "rank" ? `#${displayed}` : `${displayed}${suffix}`}
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: bgColor }}>
        <div className="h-full rounded-full score-bar" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function getGrade(score: number) {
  if (score >= 85) return { grade: "S", label: "Empathic genius", emoji: "🌟", color: "#7C5BF5", bg: "#EDE9FF" };
  if (score >= 70) return { grade: "A", label: "Deeply resonant", emoji: "🎯", color: "#0284C7", bg: "#E0F2FE" };
  if (score >= 55) return { grade: "B", label: "Close connection", emoji: "🌿", color: "#15803D", bg: "#DCFCE7" };
  if (score >= 40) return { grade: "C", label: "Partial resonance", emoji: "🌤️", color: "#B45309", bg: "#FEF3C7" };
  return { grade: "D", label: "Keep listening", emoji: "👂", color: "#6B7280", bg: "#F3F4F6" };
}

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [copied, setCopied] = useState(false);
  const [challengeCopied, setChallengeCopied] = useState(false);
  const [revealShown, setRevealShown] = useState(false);

  useEffect(() => {
    const raw = searchParams.get("score");
    if (raw) { try { setScorecard(JSON.parse(decodeURIComponent(raw))); } catch {} }
  }, [searchParams]);

  // Auto-show reveal after a short delay for the emotional payoff
  useEffect(() => {
    if (!scorecard) return;
    const t = setTimeout(() => setRevealShown(true), 1200);
    return () => clearTimeout(t);
  }, [scorecard]);

  if (!scorecard) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <div className="text-4xl mb-3">🎵</div>
          <p className="text-sm font-medium" style={{ color: "var(--text-2)" }}>Loading…</p>
        </div>
      </main>
    );
  }

  const grade = getGrade(scorecard.overallScore);
  const challengeUrl = `https://anymusic.vercel.app/guess/${id}`;

  async function copyShareText() {
    const revealLine = scorecard!.feelingText ? `\nThe feeling was: "${scorecard!.feelingText}"` : "";
    const text = `🎵 anymusic — I guessed the vibe from music!\n\nGrade: ${grade.grade} (${grade.label})\nOverall: ${scorecard!.overallScore}%\nEmotional accuracy: ${scorecard!.emotionalAccuracy}%\n\nMy guess: "${scorecard!.guessText}"${revealLine}\n\nCan you do better? ${challengeUrl}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function copyChallenge() {
    await navigator.clipboard.writeText(challengeUrl);
    setChallengeCopied(true);
    setTimeout(() => setChallengeCopied(false), 2500);
  }

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
        <p className="text-sm font-bold" style={{ color: "var(--text)" }}>Your Scorecard</p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-md fade-up flex flex-col gap-4">

          {/* Grade hero card */}
          <div
            className="card p-6 text-center"
            style={{ background: grade.bg, boxShadow: `0 4px 24px ${grade.color}22` }}
          >
            <div className="text-5xl mb-3 float">{grade.emoji}</div>
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-black mb-3"
              style={{ background: grade.color, color: "white" }}
            >
              Grade {grade.grade} · {grade.label}
            </div>
            <div className="text-4xl font-black mb-1" style={{ color: grade.color }}>
              {scorecard.overallScore}%
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--text-2)" }}>overall score</p>

            <div
              className="px-4 py-3 rounded-2xl text-sm text-left"
              style={{ background: "rgba(255,255,255,0.7)" }}
            >
              <p className="text-xs font-bold mb-1 tracking-widest" style={{ color: "var(--muted)" }}>YOUR GUESS</p>
              <p className="italic leading-relaxed" style={{ color: "var(--text)" }}>
                &ldquo;{scorecard.guessText}&rdquo;
              </p>
            </div>
          </div>

          {/* The Reveal — the emotional payoff */}
          {scorecard.feelingText && (
            <div
              className="card p-5 text-center transition-all duration-700"
              style={{
                opacity: revealShown ? 1 : 0,
                transform: revealShown ? "translateY(0)" : "translateY(12px)",
                background: "var(--surface)",
              }}
            >
              <p className="text-xs font-bold tracking-widest mb-3" style={{ color: "var(--muted)" }}>
                THE ORIGINAL FEELING
              </p>
              <p
                className="text-base italic leading-relaxed mb-1"
                style={{ fontFamily: "var(--font-display, serif)", color: "var(--text)" }}
              >
                &ldquo;{scorecard.feelingText}&rdquo;
              </p>
              <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
                {scorecard.emotionalAccuracy >= 70
                  ? "You really felt it. 💜"
                  : scorecard.emotionalAccuracy >= 50
                  ? "You were close."
                  : "Music speaks differently to everyone."}
              </p>
            </div>
          )}

          {/* Breakdown card */}
          <div className="card p-5 flex flex-col gap-5">
            <p className="text-xs font-bold tracking-widest" style={{ color: "var(--muted)" }}>
              BREAKDOWN
            </p>

            <ScoreRow
              label="Emotional Accuracy"
              value={scorecard.emotionalAccuracy}
              description="Semantic closeness to the original feeling"
              color="#7C5BF5" bgColor="#EDE9FF" delay={100}
            />
            <div style={{ height: 1, background: "var(--border)" }} />
            <ScoreRow
              label="Specificity"
              value={scorecard.specificity}
              description="How nuanced and detailed your description was"
              color="#0284C7" bgColor="#E0F2FE" delay={300}
            />
            <div style={{ height: 1, background: "var(--border)" }} />
            <ScoreRow
              label="Consensus"
              value={scorecard.consensus}
              description="Alignment with what others guessed"
              color="#15803D" bgColor="#DCFCE7" delay={500}
            />
            <div style={{ height: 1, background: "var(--border)" }} />
            <ScoreRow
              label="Discovery Rank"
              value={scorecard.discoveryRank}
              max={scorecard.totalGuesses}
              suffix="rank"
              description={`#${scorecard.discoveryRank} of ${scorecard.totalGuesses} guessers by accuracy`}
              color="#B45309" bgColor="#FEF3C7" delay={700}
            />
          </div>

          {/* Challenge a friend */}
          <div
            className="card p-4 flex flex-col gap-3"
            style={{ background: "var(--surface-2)" }}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 18 }}>🎯</span>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text)" }}>Challenge a friend</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  Send them this track — can they score higher?
                </p>
              </div>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono truncate"
              style={{ background: "var(--border)", color: "var(--text-2)" }}
            >
              <span className="truncate flex-1">{challengeUrl}</span>
            </div>
            <button
              onClick={copyChallenge}
              className="btn-dark py-2.5 text-sm w-full transition-all duration-200"
              style={{ background: challengeCopied ? "#15803D" : "var(--pill-dark)" }}
            >
              {challengeCopied ? "✓ Link copied!" : "🔗 Copy challenge link"}
            </button>
          </div>

          {/* Share score */}
          <button
            onClick={copyShareText}
            className="btn-dark py-3.5 text-sm w-full transition-all duration-200"
            style={{ background: copied ? "#15803D" : "var(--pill-dark)" }}
          >
            {copied ? "✓ Copied!" : "📱 Share your score"}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/guess/${id}`}
              className="card py-3 text-sm font-bold text-center transition-all hover:opacity-80"
              style={{ color: "var(--text)" }}
            >
              Try again
            </Link>
            <Link
              href="/"
              className="card py-3 text-sm font-bold text-center transition-all hover:opacity-80"
              style={{ color: "var(--text)" }}
            >
              More feelings →
            </Link>
          </div>

          <p className="text-xs text-center" style={{ color: "rgba(28,27,24,0.35)" }}>
            turbopuffer vector search × ElevenLabs AI music
          </p>
        </div>
      </div>
    </main>
  );
}
