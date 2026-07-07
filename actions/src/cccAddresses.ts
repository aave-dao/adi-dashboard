import {
  GovernanceV3Avalanche,
  GovernanceV3Ethereum,
  GovernanceV3Polygon,
} from "@aave-dao/aave-address-book";

import { type SupportedChainId } from "./constants";

export const CCC_ADDRESS: Record<SupportedChainId, string> = {
  1: GovernanceV3Ethereum.CROSS_CHAIN_CONTROLLER,
  137: GovernanceV3Polygon.CROSS_CHAIN_CONTROLLER,
  43114: GovernanceV3Avalanche.CROSS_CHAIN_CONTROLLER,
};
