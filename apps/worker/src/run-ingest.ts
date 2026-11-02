import { ingestAll } from "./ingest/sources";

if (import.meta.main) {
  await ingestAll();
  process.exit(0);
}
