/**
 * Populate the AddressBook (address -> human name) and BridgeExplorers
 * (adapter address -> bridge-explorer URL prefix) tables, which the UI reads
 * via api.address.get / api.address.getBridgeExplorerLink to label bridge
 * adapters and CCC addresses. Neither table is filled anywhere else, so a
 * fresh database shows raw addresses until this runs.
 *
 * Adapter names come from the adapters themselves: every aDI bridge adapter
 * exposes `adapterName()` on-chain (e.g. "CCIP adapter", "LayerZero adapter").
 * Adapter addresses are discovered two ways and unioned:
 *   1. From collected events (TransactionForwardingAttempted / Received) — the
 *      adapters actually shown in the UI.
 *   2. On-chain from each CCC via getForwarder/ReceiverBridgeAdaptersByChain
 *      across every chain pair — configured adapters, even if not yet used.
 *
 * Idempotent (onConflictDoUpdate). Safe to re-run as chains/adapters change.
 *
 *   pnpm db:populate-addressbook            # resolve + upsert
 *   pnpm db:populate-addressbook --dry-run  # print plan, no writes
 */

import { getContract, getAddress, isAddress, type Address } from "viem";
import { sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  addressBook,
  bridgeExplorers,
  crossChainControllers,
  transactionForwardingAttempted,
  transactionReceived,
} from "@/server/db/schema";
import { getClients } from "@/server/eventCollection/getClients";
import { getCrossChainControllers } from "@/server/eventCollection/getCrossChainControllers";

const ZERO = "0x0000000000000000000000000000000000000000";

const adapterNameAbi = [
  {
    inputs: [],
    name: "adapterName",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const forwarderAbi = [
  {
    inputs: [{ internalType: "uint256", name: "chainId", type: "uint256" }],
    name: "getForwarderBridgeAdaptersByChain",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "destinationBridgeAdapter",
            type: "address",
          },
          {
            internalType: "address",
            name: "currentChainBridgeAdapter",
            type: "address",
          },
        ],
        internalType: "struct ChainIdBridgeConfig[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "chainId", type: "uint256" }],
    name: "getReceiverBridgeAdaptersByChain",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Bridge-explorer URL prefixes, keyed by a substring of adapterName() (lower-
// cased). The UI appends the source txHash to this prefix. Native rollup
// adapters (Polygon/Arbitrum/Optimism/... "native") have no per-tx bridge
// explorer, so they're intentionally absent and fall back to the chain's
// regular block explorer.
const BRIDGE_EXPLORER_BY_NAME: { match: string; prefix: string }[] = [
  { match: "ccip", prefix: "https://ccip.chain.link/tx/" },
  { match: "layerzero", prefix: "https://layerzeroscan.com/tx/" },
  { match: "wormhole", prefix: "https://wormholescan.io/#/tx/" },
  { match: "hyperlane", prefix: "https://explorer.hyperlane.xyz/?search=" },
  { match: "axelar", prefix: "https://axelarscan.io/gmp/" },
];

const explorerPrefixFor = (name: string): string | null => {
  const lower = name.toLowerCase();
  return BRIDGE_EXPLORER_BY_NAME.find((e) => lower.includes(e.match))?.prefix ?? null;
};

const dryRun = process.argv.includes("--dry-run");

// chain_id -> (lowercased address -> checksummed address)
type Candidates = Map<number, Map<string, Address>>;

const addCandidate = (cands: Candidates, chainId: number, raw: string) => {
  if (!raw || !isAddress(raw)) return;
  const checksummed = getAddress(raw);
  if (checksummed === ZERO) return;
  if (!cands.has(chainId)) cands.set(chainId, new Map());
  cands.get(chainId)!.set(checksummed.toLowerCase(), checksummed);
};

async function collectFromEvents(cands: Candidates) {
  const [fwdCurrent, fwdDest, received] = await Promise.all([
    db
      .selectDistinct({
        chain_id: transactionForwardingAttempted.chain_id,
        adapter: transactionForwardingAttempted.bridge_adapter,
      })
      .from(transactionForwardingAttempted),
    db
      .selectDistinct({
        chain_id: transactionForwardingAttempted.destination_chain_id,
        adapter: transactionForwardingAttempted.destination_bridge_adapter,
      })
      .from(transactionForwardingAttempted),
    db
      .selectDistinct({
        chain_id: transactionReceived.chain_id,
        adapter: transactionReceived.bridge_adapter,
      })
      .from(transactionReceived),
  ]);

  let n = 0;
  for (const row of [...fwdCurrent, ...fwdDest, ...received]) {
    if (row.chain_id != null && row.adapter) {
      addCandidate(cands, row.chain_id, row.adapter);
      n += 1;
    }
  }
  console.log(`  events: ${n} (chain, adapter) rows scanned`);
}

async function collectFromChain(
  cands: Candidates,
  controllers: Awaited<ReturnType<typeof getCrossChainControllers>>,
  clients: Awaited<ReturnType<typeof getClients>>,
) {
  const chainIds = controllers.map((c) => c.chain_id);

  await Promise.all(
    controllers.map(async (from) => {
      const client = clients[from.chain_id];
      if (!client) return;
      const ccc = getContract({
        address: from.address as Address,
        abi: forwarderAbi,
        client,
      });
      const others = chainIds.filter((id) => id !== from.chain_id);

      await Promise.all(
        others.map(async (to) => {
          try {
            const fwd = await ccc.read.getForwarderBridgeAdaptersByChain([
              BigInt(to),
            ]);
            for (const pair of fwd) {
              addCandidate(cands, from.chain_id, pair.currentChainBridgeAdapter);
              addCandidate(cands, to, pair.destinationBridgeAdapter);
            }
          } catch {
            /* no forwarder route configured for this pair */
          }
          try {
            const recv = await ccc.read.getReceiverBridgeAdaptersByChain([
              BigInt(to),
            ]);
            for (const addr of recv) addCandidate(cands, from.chain_id, addr);
          } catch {
            /* no receiver route configured for this pair */
          }
        }),
      );
    }),
  );

  const total = [...cands.values()].reduce((acc, m) => acc + m.size, 0);
  console.log(`  on-chain enumeration done; ${total} distinct (chain, adapter)`);
}

async function main() {
  console.log(`Populate AddressBook${dryRun ? " (dry-run)" : ""}`);

  const controllers = await getCrossChainControllers();
  const clients = await getClients({ crossChainControllers: controllers });

  // Force CCC addresses themselves to a fixed label (they don't implement
  // adapterName()), keyed by `${chainId}:${addrLower}`.
  const forcedNames = new Map<string, string>();
  for (const c of controllers) {
    forcedNames.set(
      `${c.chain_id}:${getAddress(c.address).toLowerCase()}`,
      "Cross Chain Controller",
    );
  }

  const candidates: Candidates = new Map();
  for (const c of controllers) addCandidate(candidates, c.chain_id, c.address);

  console.log("Discovering adapters...");
  await collectFromEvents(candidates);
  await collectFromChain(candidates, controllers, clients);

  // Resolve adapterName() per (chain, address), batched via each client's
  // multicall. Failures (non-adapter contracts, CCCs) resolve to null.
  console.log("Resolving adapterName() on-chain...");
  const nameRows: { chain_id: number; address: string; name: string }[] = [];
  const explorerRows: {
    chain_id: number;
    address: string;
    explorer_link: string;
  }[] = [];

  await Promise.all(
    [...candidates.entries()].map(async ([chainId, addrMap]) => {
      const client = clients[chainId];
      if (!client) return;

      await Promise.all(
        [...addrMap.values()].map(async (address) => {
          const forced = forcedNames.get(`${chainId}:${address.toLowerCase()}`);
          let name = forced ?? null;

          if (!name) {
            name = await client
              .readContract({
                address,
                abi: adapterNameAbi,
                functionName: "adapterName",
              })
              .then((r) => (typeof r === "string" ? r.trim() : null))
              .catch(() => null);
          }

          if (!name) return;
          nameRows.push({ chain_id: chainId, address, name });

          const prefix = explorerPrefixFor(name);
          if (prefix) {
            explorerRows.push({
              chain_id: chainId,
              address,
              explorer_link: prefix,
            });
          }
        }),
      );
    }),
  );

  console.log(
    `Resolved ${nameRows.length} names, ${explorerRows.length} bridge explorers.`,
  );

  // Summary by name for a quick sanity check.
  const byName = nameRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.name] = (acc[r.name] ?? 0) + 1;
    return acc;
  }, {});
  for (const [name, count] of Object.entries(byName).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(3)}  ${name}`);
  }

  if (dryRun) {
    console.log("Dry-run: no writes.");
    return;
  }

  if (nameRows.length > 0) {
    await db
      .insert(addressBook)
      .values(nameRows)
      .onConflictDoUpdate({
        target: [addressBook.address, addressBook.chain_id],
        set: { name: sql`excluded.name` },
      });
  }

  if (explorerRows.length > 0) {
    await db
      .insert(bridgeExplorers)
      .values(explorerRows)
      .onConflictDoUpdate({
        target: [bridgeExplorers.chain_id, bridgeExplorers.address],
        set: { explorer_link: sql`excluded.explorer_link` },
      });
  }

  console.log(
    `Done. Upserted ${nameRows.length} AddressBook rows, ` +
      `${explorerRows.length} BridgeExplorers rows.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
