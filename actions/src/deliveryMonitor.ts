import type { Context, PeriodicEvent } from "@tenderly/actions";

import {
  AUTO_RETRY_MAX_AGE_MS,
  CHAIN_ID_TO_NAME,
  DELIVERY_NOTIFICATION_TIMEOUT_MS,
  PENDING_ENVELOPE_TTL_MS,
  SUPPORTED_CHAIN_IDS,
  type SupportedChainId,
} from "./constants";
import {
  explorerUrlForTx,
  isAutoRetryEnabled,
  submitRetryEnvelope,
} from "./retry";
import {
  sendDeliveryWarning,
  sendRetryFailed,
  sendRetrySubmitted,
} from "./slack";
import {
  deletePending,
  getRetryRecord,
  listPending,
  markDeliveryAlerted,
  saveRetryRecord,
  wasDeliveryAlerted,
  type PendingEnvelope,
} from "./storage";

const isSupportedChain = (id: number): id is SupportedChainId =>
  (SUPPORTED_CHAIN_IDS as readonly number[]).includes(id);

const formatTimeframe = (ms: number): string => {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const tryRetry = async (
  context: Context,
  pending: PendingEnvelope,
  originChainId: SupportedChainId,
  ageMs: number,
): Promise<void> => {
  if (ageMs > AUTO_RETRY_MAX_AGE_MS) {
    console.log(
      `⏭️  Skipping retry for ${pending.envelopeId}: older than ${AUTO_RETRY_MAX_AGE_MS}ms`,
    );
    return;
  }
  if (await getRetryRecord(context.storage, pending.envelopeId)) {
    console.log(`⏭️  Retry already attempted for ${pending.envelopeId}`);
    return;
  }
  if (!(await isAutoRetryEnabled(context))) {
    console.log("⏸️  Auto-retry disabled (AUTO_RETRY_ENABLED != true)");
    return;
  }

  try {
    const { txHash } = await submitRetryEnvelope(context, {
      chainId: originChainId,
      envelope: pending.envelope,
    });
    await saveRetryRecord(context.storage, pending.envelopeId, {
      txHash,
      submittedAtMs: Date.now(),
    });
    await sendRetrySubmitted(context, {
      envelopeId: pending.envelopeId,
      chainName: CHAIN_ID_TO_NAME[originChainId],
      txHash,
      explorerUrl: explorerUrlForTx(originChainId, txHash),
    });
    console.log(`🔁 Retry submitted for ${pending.envelopeId}: ${txHash}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`Retry failed for ${pending.envelopeId}: ${reason}`);
    await sendRetryFailed(context, {
      envelopeId: pending.envelopeId,
      chainName: CHAIN_ID_TO_NAME[originChainId],
      reason,
    });
  }
};

export const run = async (context: Context, _event: PeriodicEvent): Promise<void> => {
  const pendingList = await listPending(context.storage);
  if (pendingList.length === 0) return;

  const now = Date.now();

  for (const pending of pendingList) {
    const ageMs = now - pending.registeredAtMs;

    if (ageMs > PENDING_ENVELOPE_TTL_MS) {
      console.log(
        `🧹 Pruning ${pending.envelopeId} from pending (age ${formatTimeframe(ageMs)} exceeds TTL)`,
      );
      await deletePending(context.storage, pending.envelopeId);
      continue;
    }

    if (ageMs < DELIVERY_NOTIFICATION_TIMEOUT_MS) continue;

    const originChainId = Number(pending.envelope.originChainId);
    if (!isSupportedChain(originChainId)) {
      console.warn(
        `Unsupported origin chain ${originChainId} on envelope ${pending.envelopeId}`,
      );
      continue;
    }
    const destinationChainId = Number(pending.envelope.destinationChainId);

    if (!(await wasDeliveryAlerted(context.storage, pending.envelopeId))) {
      await sendDeliveryWarning(context, {
        envelopeId: pending.envelopeId,
        timeframe: formatTimeframe(ageMs),
        notificationThreshold: formatTimeframe(DELIVERY_NOTIFICATION_TIMEOUT_MS),
        chainFrom: CHAIN_ID_TO_NAME[originChainId],
        chainTo: isSupportedChain(destinationChainId)
          ? CHAIN_ID_TO_NAME[destinationChainId]
          : `chain ${destinationChainId}`,
      });
      await markDeliveryAlerted(context.storage, pending.envelopeId);
    }

    await tryRetry(context, pending, originChainId, ageMs);
  }
};
