import { env } from "@/env";

export const getNativeTokenInfo = async (
  formattedBlockDate: string,
  nativeTokenName: string,
  nativeTokenSymbol: string,
) => {
  const tokenMarketDataOnDateData = await fetch(
    `https://pro-api.coingecko.com/api/v3/coins/${nativeTokenName}/history?date=${formattedBlockDate}&localization=false&x_cg_pro_api_key=${env.COINGECKO_API_KEY}`,
  );
  if (!tokenMarketDataOnDateData.ok) {
    console.log(tokenMarketDataOnDateData);
    throw new Error(
      `Failed to fetch token price data for token ${nativeTokenName} on date ${formattedBlockDate}`,
    );
  }
  const tokenMarketDataOnDate = await tokenMarketDataOnDateData.json();
  const tokenPriceOnDate = tokenMarketDataOnDate.market_data.current_price.usd;

  return {
    name: nativeTokenName,
    symbol: nativeTokenSymbol,
    price: parseFloat(Number(tokenPriceOnDate).toFixed(10)),
  };
};
