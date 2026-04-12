import { NextRequest, NextResponse } from "next/server";
import { embed } from "@/lib/embeddings";
import { getFeelingsNs } from "@/lib/turbopuffer";
import { supabaseAdmin } from "@/lib/supabase";
import type { Scorecard } from "@/types/supabase";

function cosineSimilarityFromDistance(distance: number): number {
  // turbopuffer cosine_distance = 1 - cosine_similarity
  return Math.max(0, Math.min(1, 1 - distance));
}

function specificityScore(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  const lengthScore = Math.min(words.length / 15, 1); // max at 15 words
  const uniquenessScore = words.length > 0 ? uniqueWords.size / words.length : 0;
  return lengthScore * 0.6 + uniquenessScore * 0.4;
}

export async function POST(req: NextRequest) {
  try {
    const { guessText, trackId, guesserId } = await req.json();

    if (!guessText || !trackId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const trimmed = guessText.trim().slice(0, 300);

    // 1. Check track exists
    const { data: track } = await supabaseAdmin
      .from("tracks")
      .select("id, guess_count")
      .eq("id", trackId)
      .single();

    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    // 2. Embed the guess
    const guessVector = await embed(trimmed);

    // 3. Query turbopuffer feelings namespace — find the feeling vector for this track
    // Filter to this specific track_id, rank by ANN similarity to guess vector
    const results = await getFeelingsNs().query({
      rank_by: ["vector", "ANN", guessVector],
      top_k: 1,
      filters: ["track_id", "Eq", trackId],
      distance_metric: "cosine_distance",
    });

    if (!results.rows || results.rows.length === 0) {
      return NextResponse.json({ error: "Track feeling not found in index" }, { status: 404 });
    }

    const emotionalAccuracy = cosineSimilarityFromDistance(results.rows[0].$dist ?? 1);

    // 4. Compute specificity score
    const specificity = specificityScore(trimmed);

    // 5. Compute consensus score from prior guesses
    const { data: priorGuesses } = await supabaseAdmin
      .from("guesses")
      .select("similarity_score")
      .eq("track_id", trackId)
      .order("created_at", { ascending: false })
      .limit(20);

    let consensus = 0.5;
    if (priorGuesses && priorGuesses.length > 0) {
      const avgSimilarity =
        priorGuesses.reduce((sum, g) => sum + (g.similarity_score ?? 0), 0) /
        priorGuesses.length;
      const diff = Math.abs(emotionalAccuracy - avgSimilarity);
      consensus = Math.max(0, 1 - diff * 2);
    }

    // 6. Discovery rank
    const { count: betterGuessesCount } = await supabaseAdmin
      .from("guesses")
      .select("id", { count: "exact", head: true })
      .eq("track_id", trackId)
      .gt("similarity_score", emotionalAccuracy);

    const discoveryRank = (betterGuessesCount ?? 0) + 1;
    const totalGuesses = (track.guess_count ?? 0) + 1;

    // 7. Overall score
    const overallScore =
      emotionalAccuracy * 0.6 +
      specificity * 0.15 +
      consensus * 0.15 +
      Math.max(0, 1 - (discoveryRank - 1) / Math.max(totalGuesses, 10)) * 0.1;

    // 8. Store guess
    const guessId = crypto.randomUUID();
    await supabaseAdmin.from("guesses").insert({
      id: guessId,
      track_id: trackId,
      guesser_id: guesserId ?? "anonymous",
      guess_text: trimmed,
      similarity_score: emotionalAccuracy,
      specificity_score: specificity,
      consensus_score: consensus,
      discovery_rank: discoveryRank,
      overall_score: overallScore,
    });

    // 9. Increment guess count + reveal after 5 guesses
    await supabaseAdmin
      .from("tracks")
      .update({
        guess_count: totalGuesses,
        revealed: totalGuesses >= 5,
      })
      .eq("id", trackId);

    const scorecard: Scorecard = {
      emotionalAccuracy: Math.round(emotionalAccuracy * 100),
      specificity: Math.round(specificity * 100),
      consensus: Math.round(consensus * 100),
      discoveryRank,
      totalGuesses,
      overallScore: Math.round(overallScore * 100),
      guessText: trimmed,
    };

    return NextResponse.json({ scorecard, guessId });
  } catch (err) {
    console.error("Guess error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
