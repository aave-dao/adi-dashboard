/**
 * Self-heal: re-walks every CrossChainController from created_block forward,
 * re-emitting events into Postgres (idempotent via onConflictDoUpdate) so that
 * gaps fill in. After the event pass, re-runs calculateTxCosts for any
 * registered transaction whose TransactionGasCosts row is missing or has null
 * USD pricing.
 *
 * Use cases:
 *   - Missing `confirmations` on TransactionReceived (event pass picks them up)
 *   - Missing/null prices on TransactionGasCosts/TransactionCosts (cost pass)
 *
 * Resumable via scripts/.self-heal-checkpoint.json (gitignored). The checkpoint
 * tracks the last block fully scanned per chain.
 *
 * Examples:
 *   pnpm db:self-heal                       # all chains, both passes, resume
 *   pnpm db:self-heal --chain 1             # only ETH
 *   pnpm db:self-heal --from-block 19000000 # custom start (overrides checkpoint)
 *   pnpm db:self-heal --to-block 19500000   # custom end (default: latest - 8)
 *   pnpm db:self-heal --skip-events         # only re-run cost calculation
 *   pnpm db:self-heal --skip-costs          # only re-walk events
 *   pnpm db:self-heal --reset-checkpoint    # clear checkpoint and start fresh
 *   pnpm db:self-heal --dry-run             # print plan, no writes
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { and, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  envelopeRegistered,
  transactionGasCosts,
} from "@/server/db/schema";
import { calculateTxCosts } from "@/server/eventCollection/calculateTxCosts";
import { getClients } from "@/server/eventCollection/getClients";
import { getCrossChainControllers } from "@/server/eventCollection/getCrossChainControllers";
import { getEvents } from "@/server/eventCollection/getEvents";

type Args = {
  chain: number | null;
  fromBlock: number | null;
  toBlock: number | null;
  skipEvents: boolean;
  skipCosts: boolean;
  resetCheckpoint: boolean;
  dryRun: boolean;
};

const CHECKPOINT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  ".self-heal-checkpoint.json",
);

// Blocks chain tip is conservatively cropped by, matching collectEvents().
const BLOCK_TIP_OFFSET: Record<number, bigint> = {
  137: 100n, // Polygon: avoid reorgs
};
const DEFAULT_TIP_OFFSET = 8n;

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return {
    chain: flags.chain ? Number(flags.chain) : null,
    fromBlock: flags["from-block"] ? Number(flags["from-block"]) : null,
    toBlock: flags["to-block"] ? Number(flags["to-block"]) : null,
    skipEvents: Boolean(flags["skip-events"]),
    skipCosts: Boolean(flags["skip-costs"]),
    resetCheckpoint: Boolean(flags["reset-checkpoint"]),
    dryRun: Boolean(flags["dry-run"]),
  };
}

type Checkpoint = Record<string, number>;

function readCheckpoint(): Checkpoint {
  if (!fs.existsSync(CHECKPOINT_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8")) as Checkpoint;
  } catch (error) {
    console.warn(`Could not parse checkpoint, starting fresh: ${String(error)}`);
    return {};
  }
}

function writeCheckpoint(cp: Checkpoint) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

async function healEventsForChain(
  chainId: number,
  args: Args,
  checkpoint: Checkpoint,
) {
  const controllers = await getCrossChainControllers();
  const controller = controllers.find((c) => c.chain_id === chainId);
  if (!controller) {
    console.warn(`No CCC config for chain ${chainId}, skipping`);
    return;
  }

  const clients = await getClients({ crossChainControllers: controllers });
  const client = clients[chainId];
  if (!client) throw new Error(`No client for chain ${chainId}`);

  const offset = BLOCK_TIP_OFFSET[chainId] ?? DEFAULT_TIP_OFFSET;
  const tip = Number((await client.getBlockNumber()) - offset);

  const checkpointBlock = checkpoint[String(chainId)];
  const start =
    args.fromBlock ??
    (checkpointBlock !== undefined
      ? checkpointBlock + 1
      : controller.created_block);
  const end = args.toBlock ?? tip;

  if (start > end) {
    console.log(
      `[chain ${chainId}] Nothing to heal: start=${start} > end=${end}`,
    );
    return;
  }

  const limit = controller.rpc_block_limit;
  const totalBatches = Math.ceil((end - start) / limit);

  console.log(
    `[chain ${chainId}] Healing blocks ${start} → ${end} ` +
      `(${end - start} blocks, ${totalBatches} batches of ${limit})`,
  );

  if (args.dryRun) return;

  let batchIdx = 0;
  for (let from = start; from <= end; from += limit) {
    batchIdx += 1;
    const to = Math.min(from + limit - 1, end);

    const t0 = Date.now();
    // isRetry=true so getEvents does NOT bump last_scanned_block
    // (the live cron is the source of truth for that pointer).
    await getEvents({
      address: controller.address,
      from,
      to,
      client,
      isRetry: true,
    });
    const ms = Date.now() - t0;

    if (batchIdx % 25 === 0 || to === end) {
      const pct = ((batchIdx / totalBatches) * 100).toFixed(1);
      console.log(
        `[chain ${chainId}] batch ${batchIdx}/${totalBatches} ` +
          `(${pct}%) blocks ${from}-${to} in ${ms}ms`,
      );
    }

    const prev = checkpoint[String(chainId)] ?? -1;
    if (to > prev) {
      checkpoint[String(chainId)] = to;
      writeCheckpoint(checkpoint);
    }
  }

  console.log(`[chain ${chainId}] Event heal complete up to block ${end}`);
}

async function healCosts(args: Args) {
  // Find every (transaction_hash, chain_id) we registered an envelope on, that
  // either has no TransactionGasCosts row at all, or has nulls in critical USD
  // fields. Each registration tx is the entry point we already call
  // calculateTxCosts() on during normal collection, so re-running it here is
  // both idempotent and sufficient to backfill prices.
  const filters = [
    isNull(transactionGasCosts.transaction_hash), // missing row
    isNull(transactionGasCosts.transaction_fee_usd),
    isNull(transactionGasCosts.token_usd_price),
  ];

  const baseQuery = db
    .selectDistinct({
      transaction_hash: envelopeRegistered.transaction_hash,
      chain_id: envelopeRegistered.chain_id,
    })
    .from(envelopeRegistered)
    .leftJoin(
      transactionGasCosts,
      eq(transactionGasCosts.transaction_hash, envelopeRegistered.transaction_hash),
    );

  const rows = await (args.chain !== null
    ? baseQuery.where(
        and(eq(envelopeRegistered.chain_id, args.chain), or(...filters)),
      )
    : baseQuery.where(or(...filters)));

  console.log(`[costs] ${rows.length} transactions need price backfill`);

  if (args.dryRun || rows.length === 0) return;

  let healed = 0;
  let failed = 0;
  for (const [i, row] of rows.entries()) {
    if (!row.transaction_hash || row.chain_id === null) continue;
    try {
      await calculateTxCosts(row.transaction_hash as `0x${string}`, row.chain_id);
      healed += 1;
    } catch (error) {
      failed += 1;
      console.warn(
        `[costs] ${row.transaction_hash} on chain ${row.chain_id} failed: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }

    if ((i + 1) % 25 === 0 || i === rows.length - 1) {
      console.log(
        `[costs] progress ${i + 1}/${rows.length} (healed=${healed}, failed=${failed})`,
      );
    }
  }

  console.log(`[costs] Done. healed=${healed} failed=${failed}`);
}

async function main() {
  const args = parseArgs();

  if (args.resetCheckpoint && fs.existsSync(CHECKPOINT_PATH)) {
    fs.unlinkSync(CHECKPOINT_PATH);
    console.log(`Cleared checkpoint at ${CHECKPOINT_PATH}`);
  }

  console.log(`Self-heal starting with args: ${JSON.stringify(args)}`);

  if (!args.skipEvents) {
    const checkpoint = readCheckpoint();
    const controllers = await getCrossChainControllers();
    const targetChains = args.chain
      ? controllers.filter((c) => c.chain_id === args.chain)
      : controllers;

    for (const controller of targetChains) {
      try {
        await healEventsForChain(controller.chain_id, args, checkpoint);
      } catch (error) {
        console.error(
          `[chain ${controller.chain_id}] Event heal failed: ` +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    }
  } else {
    console.log("Skipping event pass (--skip-events)");
  }

  if (!args.skipCosts) {
    await healCosts(args);
  } else {
    console.log("Skipping cost pass (--skip-costs)");
  }

  console.log("Self-heal complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
