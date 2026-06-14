import {
  GovernanceV3Arbitrum,
  GovernanceV3Avalanche,
  GovernanceV3Base,
  GovernanceV3BNB,
  GovernanceV3Bob,
  GovernanceV3Celo,
  GovernanceV3Ethereum,
  GovernanceV3Fuji,
  GovernanceV3Gnosis,
  GovernanceV3Ink,
  GovernanceV3Linea,
  GovernanceV3Mantle,
  GovernanceV3MegaEth,
  GovernanceV3Metis,
  GovernanceV3Optimism,
  GovernanceV3Plasma,
  GovernanceV3Polygon,
  GovernanceV3Scroll,
  GovernanceV3Soneium,
  GovernanceV3Sonic,
  GovernanceV3XLayer,
  GovernanceV3ZkSync,
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

// Single Tenderly Node RPC access key, reused across every gateway subdomain.
// Tenderly access keys are account-scoped, so the same key authenticates on
// all `<network>.gateway.tenderly.co` endpoints (verified per network below).
const tenderly = (slug: string) =>
  `https://${slug}.gateway.tenderly.co/3CZrGAx33QZRkbs0Gw9BJX`;

// Higher block range per eth_getLogs query — prod RPCs (Alchemy primary,
// Tenderly + public fallbacks) all support this comfortably.
const RPC_BLOCK_LIMIT = 2000;

// One declarative entry per CrossChainController. Order of rpc_urls matters:
// viem's fallback transport tries them in sequence (Alchemy → Tenderly →
// public). `tenderly_slug: null` means Tenderly's public gateway does not
// serve that network, so we fall back to a public RPC instead.
type ChainDef = {
  gov: { CHAIN_ID: number; CROSS_CHAIN_CONTROLLER: string };
  alchemy_subdomain: string;
  tenderly_slug: string | null;
  public_rpc: string;
  // Creation block of the CROSS_CHAIN_CONTROLLER, found by binary-searching
  // `cast code <ccc> --block <n>` against the Alchemy archive endpoint.
  created_block: number;
  chain_name_alias: string;
  native_token_name: string;
  native_token_symbol: string;
};

const CHAINS: ChainDef[] = [
  {
    gov: GovernanceV3Ethereum,
    alchemy_subdomain: "eth-mainnet",
    tenderly_slug: "mainnet",
    public_rpc: "https://ethereum-rpc.publicnode.com",
    created_block: 18090383,
    chain_name_alias: "Ethereum",
    native_token_name: "Ethereum",
    native_token_symbol: "ETH",
  },
  {
    gov: GovernanceV3Polygon,
    alchemy_subdomain: "polygon-mainnet",
    tenderly_slug: "polygon",
    public_rpc: "https://polygon-bor-rpc.publicnode.com",
    created_block: 47286576,
    chain_name_alias: "Polygon",
    native_token_name: "Polygon",
    native_token_symbol: "POL",
  },
  {
    gov: GovernanceV3Avalanche,
    alchemy_subdomain: "avax-mainnet",
    tenderly_slug: "avalanche",
    public_rpc: "https://api.avax.network/ext/bc/C/rpc",
    created_block: 34913217,
    chain_name_alias: "Avalanche",
    native_token_name: "Avalanche",
    native_token_symbol: "AVAX",
  },
  {
    gov: GovernanceV3Arbitrum,
    alchemy_subdomain: "arb-mainnet",
    tenderly_slug: "arbitrum",
    public_rpc: "https://arb1.arbitrum.io/rpc",
    created_block: 129144946,
    chain_name_alias: "Arbitrum",
    native_token_name: "Ethereum",
    native_token_symbol: "ETH",
  },
  {
    gov: GovernanceV3Base,
    alchemy_subdomain: "base-mainnet",
    tenderly_slug: "base",
    public_rpc: "https://mainnet.base.org",
    created_block: 3686171,
    chain_name_alias: "Base",
    native_token_name: "Ethereum",
    native_token_symbol: "ETH",
  },
  {
    gov: GovernanceV3BNB,
    alchemy_subdomain: "bnb-mainnet",
    // Tenderly's public gateway does not serve BNB Smart Chain.
    tenderly_slug: null,
    public_rpc: "https://bsc-dataseed.bnbchain.org",
    created_block: 31558152,
    chain_name_alias: "BNB Chain",
    native_token_name: "BNB",
    native_token_symbol: "BNB",
  },
  {
    gov: GovernanceV3Bob,
    alchemy_subdomain: "bob-mainnet",
    tenderly_slug: "bob",
    public_rpc: "https://rpc.gobob.xyz",
    created_block: 18092380,
    chain_name_alias: "BOB",
    native_token_name: "Ethereum",
    native_token_symbol: "ETH",
  },
  {
    gov: GovernanceV3Celo,
    alchemy_subdomain: "celo-mainnet",
    tenderly_slug: "celo",
    public_rpc: "https://forno.celo.org",
    created_block: 29733827,
    chain_name_alias: "Celo",
    native_token_name: "Celo",
    native_token_symbol: "CELO",
  },
  {
    gov: GovernanceV3Fuji,
    alchemy_subdomain: "avax-fuji",
    tenderly_slug: "avalanche-fuji",
    public_rpc: "https://api.avax-test.network/ext/bc/C/rpc",
    created_block: 24684103,
    chain_name_alias: "Avalanche Fuji",
    native_token_name: "Avalanche",
    native_token_symbol: "AVAX",
  },
  {
    gov: GovernanceV3Gnosis,
    alchemy_subdomain: "gnosis-mainnet",
    tenderly_slug: "gnosis",
    public_rpc: "https://rpc.gnosischain.com",
    created_block: 30373983,
    chain_name_alias: "Gnosis",
    native_token_name: "xDAI",
    native_token_symbol: "XDAI",
  },
  {
    gov: GovernanceV3Ink,
    alchemy_subdomain: "ink-mainnet",
    tenderly_slug: "ink",
    public_rpc: "https://rpc-gel.inkonchain.com",
    created_block: 9342652,
    chain_name_alias: "Ink",
    native_token_name: "Ethereum",
    native_token_symbol: "ETH",
  },
  {
    gov: GovernanceV3Linea,
    alchemy_subdomain: "linea-mainnet",
    tenderly_slug: "linea",
    public_rpc: "https://rpc.linea.build",
    created_block: 13185281,
    chain_name_alias: "Linea",
    native_token_name: "Ethereum",
    native_token_symbol: "ETH",
  },
  {
    gov: GovernanceV3Mantle,
    alchemy_subdomain: "mantle-mainnet",
    tenderly_slug: "mantle",
    public_rpc: "https://rpc.mantle.xyz",
    created_block: 75528138,
    chain_name_alias: "Mantle",
    native_token_name: "Mantle",
    native_token_symbol: "MNT",
  },
  {
    gov: GovernanceV3MegaEth,
    alchemy_subdomain: "megaeth-mainnet",
    tenderly_slug: "megaeth",
    public_rpc: "https://carrot.megaeth.com/rpc",
    created_block: 5516073,
    chain_name_alias: "MegaETH",
    native_token_name: "Ethereum",
    native_token_symbol: "ETH",
  },
  {
    gov: GovernanceV3Metis,
    alchemy_subdomain: "metis-mainnet",
    tenderly_slug: "metis-andromeda",
    public_rpc: "https://andromeda.metis.io/?owner=1088",
    created_block: 8526247,
    chain_name_alias: "Metis",
    native_token_name: "Metis",
    native_token_symbol: "METIS",
  },
  {
    gov: GovernanceV3Optimism,
    alchemy_subdomain: "opt-mainnet",
    tenderly_slug: "optimism",
    public_rpc: "https://mainnet.optimism.io",
    created_block: 109281878,
    chain_name_alias: "Optimism",
    native_token_name: "Ethereum",
    native_token_symbol: "ETH",
  },
  {
    gov: GovernanceV3Plasma,
    alchemy_subdomain: "plasma-mainnet",
    tenderly_slug: "plasma",
    public_rpc: "https://rpc.plasma.to",
    created_block: 697272,
    chain_name_alias: "Plasma",
    native_token_name: "Plasma",
    native_token_symbol: "XPL",
  },
  {
    gov: GovernanceV3Scroll,
    alchemy_subdomain: "scroll-mainnet",
    tenderly_slug: "scroll-mainnet",
    public_rpc: "https://rpc.scroll.io",
    created_block: 2140900,
    chain_name_alias: "Scroll",
    native_token_name: "Ethereum",
    native_token_symbol: "ETH",
  },
  {
    gov: GovernanceV3Soneium,
    alchemy_subdomain: "soneium-mainnet",
    tenderly_slug: "soneium",
    public_rpc: "https://rpc.soneium.org",
    created_block: 6442439,
    chain_name_alias: "Soneium",
    native_token_name: "Ethereum",
    native_token_symbol: "ETH",
  },
  {
    gov: GovernanceV3Sonic,
    alchemy_subdomain: "sonic-mainnet",
    tenderly_slug: "sonic",
    public_rpc: "https://rpc.soniclabs.com",
    created_block: 7277169,
    chain_name_alias: "Sonic",
    native_token_name: "Sonic",
    native_token_symbol: "S",
  },
  {
    gov: GovernanceV3XLayer,
    alchemy_subdomain: "xlayer-mainnet",
    tenderly_slug: "xlayer",
    public_rpc: "https://rpc.xlayer.tech",
    created_block: 43479454,
    chain_name_alias: "X Layer",
    native_token_name: "OKB",
    native_token_symbol: "OKB",
  },
  {
    gov: GovernanceV3ZkSync,
    alchemy_subdomain: "zksync-mainnet",
    tenderly_slug: "zksync",
    public_rpc: "https://mainnet.era.zksync.io",
    created_block: 40068407,
    chain_name_alias: "zkSync Era",
    native_token_name: "Ethereum",
    native_token_symbol: "ETH",
  },
];

const CCC_ROWS: CccRow[] = CHAINS.map((c) => {
  const primary = alchemy(c.alchemy_subdomain);
  const rpc_urls = [
    primary,
    ...(c.tenderly_slug ? [tenderly(c.tenderly_slug)] : []),
    c.public_rpc,
  ];
  return {
    chain_id: c.gov.CHAIN_ID,
    address: c.gov.CROSS_CHAIN_CONTROLLER,
    created_block: c.created_block,
    rpc_urls,
    rpc_block_limit: RPC_BLOCK_LIMIT,
    analytics_rpc_url: primary,
    chain_name_alias: c.chain_name_alias,
    native_token_name: c.native_token_name,
    native_token_symbol: c.native_token_symbol,
  };
});

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
