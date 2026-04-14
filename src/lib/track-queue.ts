import { supabaseAdmin } from "@/lib/supabase";
import { getTrackFeelingsNs } from "@/lib/turbopuffer";

export type TrackFeelingsNs = ReturnType<typeof getTrackFeelingsNs>;

/**
 * Decide where a new clip sits in the play queue: after the closest emotional
 * match among existing clips (Turbopuffer ANN), using fractional queue_order
 * between that clip and the next in line.
 */
export async function computeQueueOrderForNewClip(
  feelingVector: number[],
  trackFeelingsNs: TrackFeelingsNs
): Promise<number> {
  const { data: rows, error } = await supabaseAdmin
    .from("tracks")
    .select("id, queue_order")
    .order("queue_order", { ascending: true, nullsFirst: false });

  if (error) throw error;

  const ordered = (rows ?? []).map((r) => ({
    id: r.id,
    q: r.queue_order ?? 0,
  }));

  if (ordered.length === 0) {
    return 1_000_000_000;
  }

  let neighborIndex = -1;
  try {
    const q = await trackFeelingsNs.query({
      rank_by: ["vector", "ANN", feelingVector],
      top_k: Math.min(48, Math.max(24, ordered.length * 2)),
      distance_metric: "cosine_distance",
    });
    const tpIds = (q.rows ?? []).map((row) => String(row.id));
    for (const tid of tpIds) {
      const idx = ordered.findIndex((r) => r.id === tid);
      if (idx >= 0) {
        neighborIndex = idx;
        break;
      }
    }
  } catch {
    /* namespace empty or TP error — fall through to append */
  }

  if (neighborIndex < 0) {
    const last = ordered[ordered.length - 1];
    return last.q + 2_000_000;
  }

  const a = ordered[neighborIndex].q;
  const b =
    neighborIndex + 1 < ordered.length ? ordered[neighborIndex + 1].q : a + 4_000_000_000;
  let mid = (a + b) / 2;
  if (!(mid > a && mid < b)) {
    mid = a + Math.max(Number.EPSILON * 1e12, (b - a) * 0.5);
  }
  if (!(mid > a && mid < b)) {
    mid = a + 1;
  }
  return mid;
}
