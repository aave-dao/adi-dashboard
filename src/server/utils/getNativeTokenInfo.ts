import { env } from "@/env";

// CoinGecko coin IDs are lowercase slugs and not always the same as the chain
// label we store in CrossChainControllers.native_token_name. Map the chain
// labels (and their tickers) to the canonical CG IDs so price history works.
const NATIVE_TOKEN_TO_COINGECKO_ID: Record<string, string> = {
  ethereum: "ethereum",
  eth: "ethereum",
  polygon: "polygon-ecosystem-token",
  pol: "polygon-ecosystem-token",
  matic: "matic-network",
  avalanche: "avalanche-2",
  avax: "avalanche-2",
};

const resolveCoinGeckoId = (nativeTokenName: string): string => {
  const slug = nativeTokenName.trim().toLowerCase();
  return NATIVE_TOKEN_TO_COINGECKO_ID[slug] ?? slug;
};

export const getNativeTokenInfo = async (
  formattedBlockDate: string,
  nativeTokenName: string,
  nativeTokenSymbol: string,
) => {
  const coinId = resolveCoinGeckoId(nativeTokenName);
  const tokenMarketDataOnDateData = await fetch(
    `https://pro-api.coingecko.com/api/v3/coins/${coinId}/history?date=${formattedBlockDate}&localization=false&x_cg_pro_api_key=${env.COINGECKO_API_KEY}`,
  );
  if (!tokenMarketDataOnDateData.ok) {
    throw new Error(
      `Failed to fetch token price for ${nativeTokenName} (CG id ${coinId}) on ${formattedBlockDate}: HTTP ${tokenMarketDataOnDateData.status}`,
    );
  }
  const tokenMarketDataOnDate = await tokenMarketDataOnDateData.json();
  const tokenPriceOnDate = tokenMarketDataOnDate.market_data?.current_price?.usd;

  return {
    name: nativeTokenName,
    symbol: nativeTokenSymbol,
    price: parseFloat(Number(tokenPriceOnDate ?? 0).toFixed(10)),
  };
};
