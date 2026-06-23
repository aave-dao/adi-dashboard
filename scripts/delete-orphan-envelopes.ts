/**
 * One-off cleanup: delete "orphan" envelopes — rows with registered_at IS NULL.
 *
 * These are envelopes we only ever saw delivered/received on a destination
 * chain (e.g. Scroll) but never registered on their origin chain, so they have
 * no EnvelopeRegistered event and a null registered_at. They sort to the top of
 * the list (Postgres NULLS FIRST on DESC) and render as "Unknown type".
 *
 * NOTE: not durable on its own — if collection re-walks the destination chain's
 * delivery/received events (e.g. via self-heal), the row is re-inserted. This is
 * a manual tidy-up, not a permanent fix.
 *
 *   pnpm exec tsx --env-file=.env scripts/delete-orphan-envelopes.ts --dry-run
 *   pnpm exec tsx --env-file=.env scripts/delete-orphan-envelopes.ts
 */

import { isNull } from "drizzle-orm";

import { db } from "@/server/db";
import { envelopes } from "@/server/db/schema";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const orphans = await db
    .select({
      id: envelopes.id,
      origin_chain_id: envelopes.origin_chain_id,
      destination_chain_id: envelopes.destination_chain_id,
    })
    .from(envelopes)
    .where(isNull(envelopes.registered_at));

  console.log(`Found ${orphans.length} orphan envelope(s) (registered_at IS NULL):`);
  for (const o of orphans) {
    console.log(
      `  ${o.id}  origin=${o.origin_chain_id ?? "?"} -> dest=${o.destination_chain_id ?? "?"}`,
    );
  }

  if (orphans.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  if (dryRun) {
    console.log("Dry-run: no rows deleted.");
    return;
  }

  const deleted = await db
    .delete(envelopes)
    .where(isNull(envelopes.registered_at))
    .returning({ id: envelopes.id });

  console.log(`Deleted ${deleted.length} orphan envelope(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
