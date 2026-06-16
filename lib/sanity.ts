import { createClient } from "@sanity/client";

export const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID || "74704nsd",
  dataset: process.env.SANITY_DATASET || "production",
  apiVersion: process.env.SANITY_API_VERSION || "2021-06-07",
  token: process.env.SANITY_READ_TOKEN,
  useCdn: false,
});
