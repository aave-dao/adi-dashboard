import type { Storage } from "@tenderly/actions";

import type { EnvelopeStruct } from "./abis";

const PENDING_PREFIX = "pending:";
const DELIVERY_ALERT_PREFIX = "delivery-alert:";
const RETRY_PREFIX = "retry-attempted:";
const BALANCE_DEDUP_PREFIX = "low-balance:";
const PENDING_INDEX_KEY = "pending:index";

export type PendingEnvelope = {
  envelopeId: string;
  envelope: EnvelopeStruct;
  registeredAtMs: number;
  txHash: string;
  blockNumber: number;
};

export type RetryRecord = {
  txHash: string;
  submittedAtMs: number;
};

const readJson = async <T>(storage: Storage, key: string): Promise<T | null> => {
  const raw = await storage.getStr(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJson = async (storage: Storage, key: string, value: unknown): Promise<void> => {
  await storage.putStr(key, JSON.stringify(value));
};

const readIndex = async (storage: Storage): Promise<string[]> => {
  const list = await readJson<string[]>(storage, PENDING_INDEX_KEY);
  return list ?? [];
};

const writeIndex = async (storage: Storage, ids: string[]): Promise<void> => {
  await writeJson(storage, PENDING_INDEX_KEY, ids);
};

export const savePending = async (
  storage: Storage,
  pending: PendingEnvelope,
): Promise<void> => {
  await writeJson(storage, PENDING_PREFIX + pending.envelopeId, pending);
  const index = await readIndex(storage);
  if (!index.includes(pending.envelopeId)) {
    index.push(pending.envelopeId);
    await writeIndex(storage, index);
  }
};

export const getPending = async (
  storage: Storage,
  envelopeId: string,
): Promise<PendingEnvelope | null> =>
  readJson<PendingEnvelope>(storage, PENDING_PREFIX + envelopeId);

export const deletePending = async (
  storage: Storage,
  envelopeId: string,
): Promise<void> => {
  await storage.delete(PENDING_PREFIX + envelopeId);
  const index = await readIndex(storage);
  const next = index.filter((id) => id !== envelopeId);
  if (next.length !== index.length) {
    await writeIndex(storage, next);
  }
};

export const listPending = async (
  storage: Storage,
): Promise<PendingEnvelope[]> => {
  const ids = await readIndex(storage);
  const out: PendingEnvelope[] = [];
  for (const id of ids) {
    const p = await getPending(storage, id);
    if (p) out.push(p);
  }
  return out;
};

export const wasDeliveryAlerted = async (
  storage: Storage,
  envelopeId: string,
): Promise<boolean> => {
  const v = await storage.getStr(DELIVERY_ALERT_PREFIX + envelopeId);
  return Boolean(v);
};

export const markDeliveryAlerted = async (
  storage: Storage,
  envelopeId: string,
): Promise<void> => {
  await storage.putStr(
    DELIVERY_ALERT_PREFIX + envelopeId,
    new Date().toISOString(),
  );
};

export const getRetryRecord = async (
  storage: Storage,
  envelopeId: string,
): Promise<RetryRecord | null> =>
  readJson<RetryRecord>(storage, RETRY_PREFIX + envelopeId);

export const saveRetryRecord = async (
  storage: Storage,
  envelopeId: string,
  record: RetryRecord,
): Promise<void> => {
  await writeJson(storage, RETRY_PREFIX + envelopeId, record);
};

export const balanceDedupKey = (
  chainName: string,
  token: string,
  isoDate: string,
): string => `${BALANCE_DEDUP_PREFIX}${chainName}:${token}:${isoDate}`;

export const wasBalanceAlerted = async (
  storage: Storage,
  key: string,
): Promise<boolean> => {
  const v = await storage.getStr(key);
  return Boolean(v);
};

export const markBalanceAlerted = async (
  storage: Storage,
  key: string,
): Promise<void> => {
  await storage.putStr(key, new Date().toISOString());
};
