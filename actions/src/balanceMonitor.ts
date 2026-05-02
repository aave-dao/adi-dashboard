import type { Context, PeriodicEvent } from "@tenderly/actions";
import { Contract, formatEther } from "ethers";

import { ERC20_BALANCE_OF_ABI } from "./abis";
import { CCC_ADDRESS } from "./cccAddresses";
import {
  CHAIN_ID_TO_NAME,
  CHAIN_ID_TO_NATIVE_CURRENCY,
  LINK_TOKEN_ADDRESS,
  NOTIFICATION_THRESHOLDS,
  SUPPORTED_CHAIN_IDS,
  type SupportedChainId,
} from "./constants";
import { getProvider } from "./rpc";
import { sendBalanceWarning } from "./slack";
import {
  balanceDedupKey,
  markBalanceAlerted,
  wasBalanceAlerted,
} from "./storage";

const checkChain = async (
  context: Context,
  chainId: SupportedChainId,
  isoDate: string,
): Promise<void> => {
  const cccAddress = CCC_ADDRESS[chainId];
  const provider = await getProvider(context, chainId);

  const native = await provider.getBalance(cccAddress);
  const linkContract = new Contract(
    LINK_TOKEN_ADDRESS[chainId],
    ERC20_BALANCE_OF_ABI,
    provider,
  );
  const link = (await linkContract.getFunction("balanceOf")(cccAddress)) as bigint;

  const thresholds = NOTIFICATION_THRESHOLDS[chainId];
  const chainName = CHAIN_ID_TO_NAME[chainId];
  const nativeSymbol = CHAIN_ID_TO_NATIVE_CURRENCY[chainId];

  if (native < thresholds.native) {
    const key = balanceDedupKey(chainName, "native", isoDate);
    if (!(await wasBalanceAlerted(context.storage, key))) {
      console.log(
        `🔴 ${chainName} native below threshold: ${formatEther(native)} ${nativeSymbol}`,
      );
      await sendBalanceWarning(context, {
        chainName,
        threshold: formatEther(thresholds.native),
        balance: formatEther(native),
        tokenName: nativeSymbol,
      });
      await markBalanceAlerted(context.storage, key);
    }
  }

  if (link < thresholds.link) {
    const key = balanceDedupKey(chainName, "link", isoDate);
    if (!(await wasBalanceAlerted(context.storage, key))) {
      console.log(`🔴 ${chainName} LINK below threshold: ${formatEther(link)}`);
      await sendBalanceWarning(context, {
        chainName,
        threshold: formatEther(thresholds.link),
        balance: formatEther(link),
        tokenName: "LINK",
      });
      await markBalanceAlerted(context.storage, key);
    }
  }
};

export const run = async (context: Context, _event: PeriodicEvent): Promise<void> => {
  const isoDate = new Date().toISOString().slice(0, 10);
  const errors: Array<{ chainId: number; error: string }> = [];

  for (const chainId of SUPPORTED_CHAIN_IDS) {
    try {
      await checkChain(context, chainId, isoDate);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Balance check failed on chain ${chainId}: ${message}`);
      errors.push({ chainId, error: message });
    }
  }

  if (errors.length) {
    throw new Error(
      `Balance monitor partial failure: ${JSON.stringify(errors)}`,
    );
  }
};
