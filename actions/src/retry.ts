import type { Context } from "@tenderly/actions";
import { Contract, Wallet } from "ethers";

import { CCC_RETRY_ENVELOPE_ABI, type EnvelopeStruct } from "./abis";
import { CCC_ADDRESS } from "./cccAddresses";
import { type SupportedChainId } from "./constants";
import { getProvider } from "./rpc";

const DEFAULT_RETRY_GAS_LIMIT = 300_000n;

export const isAutoRetryEnabled = async (context: Context): Promise<boolean> => {
  const flag = await context.secrets.get("AUTO_RETRY_ENABLED").catch(() => "");
  return flag === "true";
};

const readGasLimit = async (context: Context): Promise<bigint> => {
  const raw = await context.secrets.get("RETRY_GAS_LIMIT").catch(() => "");
  if (!raw) return DEFAULT_RETRY_GAS_LIMIT;
  try {
    return BigInt(raw);
  } catch {
    return DEFAULT_RETRY_GAS_LIMIT;
  }
};

export const submitRetryEnvelope = async (
  context: Context,
  args: {
    chainId: SupportedChainId;
    envelope: EnvelopeStruct;
  },
): Promise<{ txHash: string }> => {
  const cccAddress = CCC_ADDRESS[args.chainId];
  const privateKey = await context.secrets.get("RETRY_SIGNER_PRIVATE_KEY");
  const provider = await getProvider(context, args.chainId);
  const wallet = new Wallet(privateKey, provider);

  const ccc = new Contract(cccAddress, CCC_RETRY_ENVELOPE_ABI, wallet);
  const gasLimit = await readGasLimit(context);

  const envelopeTuple = {
    nonce: BigInt(args.envelope.nonce),
    origin: args.envelope.origin,
    destination: args.envelope.destination,
    originChainId: BigInt(args.envelope.originChainId),
    destinationChainId: BigInt(args.envelope.destinationChainId),
    message: args.envelope.message,
  };

  const tx = (await ccc.getFunction("retryEnvelope")(envelopeTuple, gasLimit)) as { hash: string };
  return { txHash: tx.hash };
};

export const explorerUrlForTx = (
  chainId: SupportedChainId,
  txHash: string,
): string => {
  switch (chainId) {
    case 1:
      return `https://etherscan.io/tx/${txHash}`;
    case 137:
      return `https://polygonscan.com/tx/${txHash}`;
    case 43114:
      return `https://snowtrace.io/tx/${txHash}`;
  }
};
