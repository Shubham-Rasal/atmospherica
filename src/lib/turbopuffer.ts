import Turbopuffer from "@turbopuffer/turbopuffer";

function getClient() {
  return new Turbopuffer({
    apiKey: process.env.TURBOPUFFER_API_KEY!,
    region: process.env.TURBOPUFFER_REGION ?? "gcp-us-central1",
  });
}

export function getArchetypesNs() {
  return getClient().namespace("atmospherica-archetypes");
}

/** One row per track feeling embedding — used for emotional queue placement (ANN). */
export function getTrackFeelingsNs() {
  return getClient().namespace("atmospherica-track-feelings");
}
