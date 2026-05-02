export type SupportedChainId = 1 | 137 | 43114;

export const SUPPORTED_CHAIN_IDS: readonly SupportedChainId[] = [1, 137, 43114];

export const CHAIN_ID_TO_NAME: Record<SupportedChainId, string> = {
  1: "Ethereum",
  137: "Polygon",
  43114: "Avalanche",
};

export const CHAIN_ID_TO_NATIVE_CURRENCY: Record<SupportedChainId, string> = {
  1: "ETH",
  137: "MATIC",
  43114: "AVAX",
};

export const LINK_TOKEN_ADDRESS: Record<SupportedChainId, string> = {
  1: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  137: "0xb0897686c545045aFc77CF20eC7A532E3120E0F1",
  43114: "0x5947BB275c521040051D82396192181b413227A3",
};

export type Thresholds = { native: bigint; link: bigint };

export const NOTIFICATION_THRESHOLDS: Record<SupportedChainId, Thresholds> = {
  1: { native: 80_000_000_000_000_000n, link: 5_000_000_000_000_000_000n },
  137: { native: 350_000_000_000_000_000_000n, link: 15_000_000_000_000_000_000n },
  43114: { native: 120_000_000_000_000_000_000n, link: 15_000_000_000_000_000_000n },
};

export const DELIVERY_NOTIFICATION_TIMEOUT_MS = 60 * 60 * 1000;
export const AUTO_RETRY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const PENDING_ENVELOPE_TTL_MS = 8 * 24 * 60 * 60 * 1000;

export const DASHBOARD_BASE_URL = "https://adi.onaave.com";

export const TENDERLY_GATEWAY_NETWORK_SLUG: Record<SupportedChainId, string> = {
  1: "mainnet",
  137: "polygon",
  43114: "avalanche-mainnet",
};
