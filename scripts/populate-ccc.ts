import {
  GovernanceV3Avalanche,
  GovernanceV3Ethereum,
  GovernanceV3Polygon,
} from "@aave-dao/aave-address-book";
import { sql } from "drizzle-orm";

import { env } from "@/env";
import { db } from "@/server/db";
import { crossChainControllers } from "@/server/db/schema";

type CccRow = {
  chain_id: number;
  address: string;
  created_block: number;
  rpc_urls: string[];
  rpc_block_limit: number;
  analytics_rpc_url: string;
  chain_name_alias: string;
  native_token_name: string;
  native_token_symbol: string;
};

const alchemy = (subdomain: string) =>
  `https://${subdomain}.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;

// Higher block range per eth_getLogs query — prod RPCs (Alchemy primary,
// public fallbacks) all support this comfortably.
const RPC_BLOCK_LIMIT = 2000;

const CCC_ROWS: CccRow[] = [
  {
    chain_id: GovernanceV3Ethereum.CHAIN_ID,
    address: GovernanceV3Ethereum.CROSS_CHAIN_CONTROLLER,
    // https://etherscan.io/address/0xEd42a7D8559a463722Ca4beD50E0Cc05a386b0e1
    created_block: 18090383,
    // Order matters: viem's fallback transport tries them in sequence.
    rpc_urls: [
      alchemy("eth-mainnet"),
      "https://mainnet.gateway.tenderly.co/3CZrGAx33QZRkbs0Gw9BJX",
      "https://eth.llamarpc.com",
      "https://eth.merkle.io",
    ],
    rpc_block_limit: RPC_BLOCK_LIMIT,
    analytics_rpc_url: alchemy("eth-mainnet"),
    chain_name_alias: "Ethereum",
    native_token_name: "Ethereum",
    native_token_symbol: "ETH",
  },
  {
    chain_id: GovernanceV3Polygon.CHAIN_ID,
    address: GovernanceV3Polygon.CROSS_CHAIN_CONTROLLER,
    // https://polygonscan.com/address/0xF6B99959F0b5e79E1CC7062E12aF632CEb18eF0d
    created_block: 47286576,
    rpc_urls: [
      alchemy("polygon-mainnet"),
      "https://polygon.gateway.tenderly.co/4jcF4adzoUTzWO8KevFJdy",
    ],
    rpc_block_limit: RPC_BLOCK_LIMIT,
    analytics_rpc_url: alchemy("polygon-mainnet"),
    chain_name_alias: "Polygon",
    native_token_name: "Polygon",
    native_token_symbol: "POL",
  },
  {
    chain_id: GovernanceV3Avalanche.CHAIN_ID,
    address: GovernanceV3Avalanche.CROSS_CHAIN_CONTROLLER,
    // https://snowtrace.io/address/0x27FC7D54C893dA63C0AE6d57e1B2B13A70690928
    created_block: 34913217,
    rpc_urls: [
      alchemy("avax-mainnet"),
      "https://avalanche.gateway.tenderly.co/3D0w0AXLeVVERIEeLUy2tB",
      "https://api.avax.network/ext/bc/C/rpc",
    ],
    rpc_block_limit: RPC_BLOCK_LIMIT,
    analytics_rpc_url: alchemy("avax-mainnet"),
    chain_name_alias: "Avalanche",
    native_token_name: "Avalanche",
    native_token_symbol: "AVAX",
  },
];

async function checkRpc(
  url: string,
): Promise<{ ok: true; block: number } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: [],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as { result?: string; error?: unknown };
    if (typeof data.result !== "string") {
      return {
        ok: false,
        error: `bad payload: ${JSON.stringify(data).slice(0, 120)}`,
      };
    }
    return { ok: true, block: parseInt(data.result, 16) };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? String(err) };
  }
}

async function verifyAllRpcs() {
  const targets = CCC_ROWS.flatMap((row) => {
    const urls = Array.from(new Set([...row.rpc_urls, row.analytics_rpc_url]));
    return urls.map((url) => ({ chain_id: row.chain_id, url }));
  });

  console.log(`Checking ${targets.length} RPC URL(s)...`);

  const results = await Promise.all(
    targets.map(async (t) => ({ ...t, result: await checkRpc(t.url) })),
  );

  for (const r of results) {
    if (r.result.ok) {
      console.log(
        `  ✓ chain_id=${r.chain_id} block=${r.result.block} ${r.url}`,
      );
    } else {
      console.log(`  ✗ chain_id=${r.chain_id} ${r.url} — ${r.result.error}`);
    }
  }

  const failed = results.filter((r) => !r.result.ok);
  if (failed.length > 0) {
    throw new Error(
      `${failed.length} RPC URL(s) failed health check. Aborting upsert.`,
    );
  }
}

async function main() {
  await verifyAllRpcs();

  for (const row of CCC_ROWS) {
    console.log(
      `Upserting chain_id=${row.chain_id} address=${row.address} created_block=${row.created_block}`,
    );
  }

  await db
    .insert(crossChainControllers)
    .values(CCC_ROWS)
    .onConflictDoUpdate({
      target: crossChainControllers.chain_id,
      set: {
        address: sql`excluded.address`,
        created_block: sql`excluded.created_block`,
        rpc_urls: sql`excluded.rpc_urls`,
        rpc_block_limit: sql`excluded.rpc_block_limit`,
        analytics_rpc_url: sql`excluded.analytics_rpc_url`,
        chain_name_alias: sql`excluded.chain_name_alias`,
        native_token_name: sql`excluded.native_token_name`,
        native_token_symbol: sql`excluded.native_token_symbol`,
      },
    });

  console.log(`Done. Upserted ${CCC_ROWS.length} cross-chain controllers.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
