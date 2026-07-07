import type {
  Context,
  Log,
  TransactionEvent,
} from "@tenderly/actions";
import { Interface } from "ethers";

import { CCC_EVENT_ABI, type EnvelopeStruct } from "./abis";
import { SUPPORTED_CHAIN_IDS, type SupportedChainId } from "./constants";
import { getProvider } from "./rpc";
import {
  deletePending,
  getPending,
  savePending,
  type PendingEnvelope,
} from "./storage";

const iface = new Interface(CCC_EVENT_ABI);

const isSupportedChain = (id: number): id is SupportedChainId =>
  (SUPPORTED_CHAIN_IDS as readonly number[]).includes(id);

const normalizeEnvelope = (raw: unknown): EnvelopeStruct => {
  const e = raw as {
    nonce: bigint;
    origin: string;
    destination: string;
    originChainId: bigint;
    destinationChainId: bigint;
    message: string;
  };
  return {
    nonce: e.nonce.toString(),
    origin: e.origin,
    destination: e.destination,
    originChainId: e.originChainId.toString(),
    destinationChainId: e.destinationChainId.toString(),
    message: e.message,
  };
};

const tryParseLog = (log: Log) => {
  try {
    return iface.parseLog({ topics: log.topics, data: log.data });
  } catch {
    return null;
  }
};

const getBlockTimestampMs = async (
  context: Context,
  chainId: SupportedChainId,
  blockNumber: number,
): Promise<number> => {
  try {
    const provider = await getProvider(context, chainId);
    const block = await provider.getBlock(blockNumber);
    if (block?.timestamp) return block.timestamp * 1000;
  } catch (error) {
    console.warn(
      `Failed to read block ${blockNumber} timestamp on chain ${chainId}: ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
  return Date.now();
};

export const onCccEvent = async (
  context: Context,
  event: TransactionEvent,
): Promise<void> => {
  const chainId = Number(event.network);
  if (!isSupportedChain(chainId)) {
    console.warn(`Ignoring event on unsupported chain ${chainId}`);
    return;
  }

  let cachedTimestampMs: number | null = null;
  const getTimestampMs = async () => {
    if (cachedTimestampMs === null) {
      cachedTimestampMs = await getBlockTimestampMs(
        context,
        chainId,
        event.blockNumber,
      );
    }
    return cachedTimestampMs;
  };

  for (const log of event.logs) {
    const parsed = tryParseLog(log);
    if (!parsed) continue;

    if (parsed.name === "EnvelopeRegistered") {
      const envelopeId = parsed.args.envelopeId as string;
      const envelope = normalizeEnvelope(parsed.args.envelope);
      const registeredAtMs = await getTimestampMs();

      const existing = await getPending(context.storage, envelopeId);
      if (existing) continue;

      const pending: PendingEnvelope = {
        envelopeId,
        envelope,
        registeredAtMs,
        txHash: event.hash,
        blockNumber: event.blockNumber,
      };
      await savePending(context.storage, pending);
      console.log(
        `📬 Tracking envelope ${envelopeId} (chain ${chainId}, block ${event.blockNumber})`,
      );
      continue;
    }

    if (parsed.name === "EnvelopeDeliveryAttempted") {
      const envelopeId = parsed.args.envelopeId as string;
      const isDelivered = parsed.args.isDelivered as boolean;
      if (!isDelivered) continue;
      await deletePending(context.storage, envelopeId);
      console.log(`✅ Envelope ${envelopeId} delivered (cross-chain)`);
      continue;
    }

    if (parsed.name === "TransactionForwardingAttempted") {
      const envelopeId = parsed.args.envelopeId as string;
      const adapterSuccessful = parsed.args.adapterSuccessful as boolean;
      if (!adapterSuccessful) continue;

      const pending = await getPending(context.storage, envelopeId);
      if (!pending) continue;
      if (pending.envelope.originChainId === pending.envelope.destinationChainId) {
        await deletePending(context.storage, envelopeId);
        console.log(`✅ Envelope ${envelopeId} delivered (same-chain)`);
      }
    }
  }
};
