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
