/** Safe string for API responses and UI — avoids `[object Object]` from String(err). */
export function serializeError(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (err !== null && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    if (typeof o.error === "string") return o.error;
    if (typeof o.details === "string") return o.details;
    if (typeof o.hint === "string" && o.hint) return o.hint;
    try {
      return JSON.stringify(err);
    } catch {
      return "Something went wrong";
    }
  }
  if (err === undefined) return "Something went wrong";
  return String(err);
}
