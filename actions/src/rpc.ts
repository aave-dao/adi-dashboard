import type { Context } from "@tenderly/actions";
import { JsonRpcProvider } from "ethers";

import { type SupportedChainId } from "./constants";

const ALCHEMY_HOST: Record<SupportedChainId, string> = {
  1: "eth-mainnet.g.alchemy.com",
  137: "polygon-mainnet.g.alchemy.com",
  43114: "avax-mainnet.g.alchemy.com",
};

export const getProvider = async (
  context: Context,
  chainId: SupportedChainId,
): Promise<JsonRpcProvider> => {
  const apiKey = await context.secrets.get("ALCHEMY_API_KEY");
  const url = `https://${ALCHEMY_HOST[chainId]}/v2/${apiKey}`;
  return new JsonRpcProvider(url, chainId, { staticNetwork: true });
};
