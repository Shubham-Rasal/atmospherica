"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const EXAMPLES = [
  "a rainy sunday morning with nowhere to be",
  "the silence after a crowd leaves",
  "driving through a city you don't know at night",
  "the last day of summer before everything changes",
  "standing on a rooftop watching the sun go down",
];

const LOADING_STEPS = [
  "Finding the right mood…",
  "Turning your words into sound…",
  "Rendering audio — this can take a minute…",
  "Saving your track…",
];

type MicState = "idle" | "recording" | "transcribing";

function MicButton({
  micState,
  onToggle,
}: {
  micState: MicState;
  onToggle: () => void;
}) {
  const cls = [
    "mic-btn",
    micState === "recording" ? "is-recording" : "",
    micState === "transcribing" ? "is-transcribing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cls}
      disabled={micState === "transcribing"}
      aria-label={
        micState === "recording"
          ? "Stop recording"
          : micState === "transcribing"
            ? "Transcribing…"
            : "Speak your feeling"
      }
    >
      {micState === "recording" ? (
        <>
          <span className="mic-dot" />
          Stop
        </>
      ) : micState === "transcribing" ? (
        <>
          <span
            className="btn-spinner"
            style={{
              borderColor: "rgba(28,27,24,0.15)",
              borderTopColor: "var(--muted)",
              width: 10,
              height: 10,
            }}
          />
          Transcribing…
        </>
      ) : (
        <>
          <span className="mic-icon">🎙</span>
          Speak
        </>
      )}
    </button>
  );
}

export default function SubmitPage() {
  const [feeling, setFeeling] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const [micState, setMicState] = useState<MicState>("idle");
  const [micError, setMicError] = useState("");
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      setLoadingStepIndex(0);
      return;
    }
    const id = window.setInterval(() => {
      setLoadingStepIndex((i) => (i + 1) % LOADING_STEPS.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = feeling.trim();
    if (trimmed.length < 5) return;
    setLoading(true);
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

      let data: { error?: string; trackId?: string };
      const raw = await res.text();
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error("Server returned an invalid response. Try again.");
      }

      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      if (!data.trackId) throw new Error("No track returned. Try again.");

      router.push(`/guess/${data.trackId}?submitted=true`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  async function startRecording() {
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await transcribe(blob, mimeType);
      };

      recorder.start();
      setMicState("recording");
    } catch {
      setMicError(
        "Microphone access denied. Please allow access and try again.",
      );
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setMicState("transcribing");
  }

  async function transcribe(blob: Blob, mimeType: string) {
    try {
      const ext = mimeType.includes("mp4") ? "m4a" : "webm";
      const file = new File([blob], `recording.${ext}`, { type: mimeType });
      const fd = new FormData();
      fd.append("audio", file);

      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transcription failed");

      setFeeling((prev) => {
        const base = prev.trim();
        return base ? `${base} ${data.text}` : data.text;
      });
    } catch (err) {
      setMicError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setMicState("idle");
    }
  }

  function toggleMic() {
    if (micState === "recording") {
      stopRecording();
    } else {
      startRecording();
    }
  }

  const trimmed = feeling.trim();
  const canSubmit = trimmed.length >= 5;
  const remaining = Math.max(0, 5 - trimmed.length);

  const shellClass = [
    "textarea-shell",
    focused ? "is-focused" : "",
    canSubmit ? "has-content" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const submitLabel = loading
    ? "Working…"
    : canSubmit
      ? "Generate music →"
      : remaining === 5
        ? "Type at least 5 characters to continue"
        : `Need ${remaining} more character${remaining === 1 ? "" : "s"}`;

  return (
    <main className="submit-page" aria-busy={loading}>
      {loading && (
        <div
          className="submit-loading-overlay"
          role="status"
          aria-live="polite"
          aria-label="Generating music"
        >
          <div className="submit-loading-card">
            <div className="submit-loading-spinner" aria-hidden />
            <p className="submit-loading-title">Making your track</p>
            <p className="submit-loading-step" key={loadingStepIndex}>
              {LOADING_STEPS[loadingStepIndex]}
            </p>
            <p className="submit-hint">Don&apos;t close this tab — audio generation can take up to a couple of minutes.</p>
          </div>
        </div>
      )}

      <div className="submit-ambient" aria-hidden="true">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
      </div>

      <header className="submit-header">
        <Link href="/" className="back-btn" aria-label="Back">
          ←
        </Link>
        <span className="submit-nav-label">anymusic</span>
      </header>

      <div className="submit-content">
        <p className="submit-caption">describe anything — a place, a moment, a feeling</p>

        <div className="submit-form-area">
          <form onSubmit={handleSubmit} className="submit-form">
            <div className={shellClass}>
              <textarea
                value={feeling}
                onChange={(e) => setFeeling(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="e.g. a rainy night drive through a city you don't know…"
                rows={6}
                maxLength={500}
                className="feeling-textarea"
                disabled={loading}
                autoFocus
              />
              <div className="textarea-meta">
                <MicButton micState={micState} onToggle={toggleMic} />
                <span className="char-count">{feeling.length} / 500</span>
                {canSubmit && !loading && (
                  <span className="ready-badge">ready ✓</span>
                )}
              </div>
            </div>

            {(error || micError) && (
              <div className="submit-error" role="alert">
                {error || micError}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || loading}
              className={
                canSubmit || loading ? "submit-btn" : "submit-btn submit-btn--waiting"
              }
            >
              {loading ? (
                <span className="btn-loading-inner">
                  <span className="btn-spinner" />
                  {submitLabel}
                </span>
              ) : (
                submitLabel
              )}
            </button>

            {!canSubmit && !loading && (
              <p className="submit-hint">
                Tip: paint a scene in words — others will hear music, not your text.
              </p>
            )}
          </form>
        </div>

        <div className="examples-section">
          <p className="examples-label">try an example</p>
          <div className="examples-list">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={loading}
                onClick={() => setFeeling(ex)}
                className={`example-pill ${feeling === ex ? "is-selected" : ""}`}
              >
                <span className="example-arrow">→</span>
                <span>{ex}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
