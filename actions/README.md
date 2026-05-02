# ADI Monitoring — Tenderly Web3 Actions

Independent watchdog that mirrors the safety-critical paths of the [adi-dashboard](../) Vercel crons. If Vercel, Postgres, or Slack from the primary path goes silent, this layer keeps firing alerts (and optionally executes `retryEnvelope` on-chain).

The actions in this directory **do not import from** the Next.js app and have no DB dependency. State lives in Tenderly's per-action KV.

## What it does

| Action | Trigger | Mirrors |
| --- | --- | --- |
| `balance-monitor` | every 30m | [`/api/cron/notify/balances`](../src/app/api/cron/notify/balances/route.ts) |
| `envelope-events` | on CCC events (3 chains × 3 events) | event collection that feeds the Postgres `Envelopes` table |
| `delivery-monitor` | every 5m | [`/api/cron/notify/delivery`](../src/app/api/cron/notify/delivery/route.ts) + adds on-chain `retryEnvelope` |

Slack messages are posted to a **separate redundancy channel** with a `[REDUNDANCY]` prefix so ops can distinguish them from primary-path alerts.

## Layout

```
actions/
├── tenderly.yaml          # spec + triggers + secret references
├── package.json           # @tenderly/actions, ethers, @slack/web-api
├── tsconfig.json
├── src/
│   ├── constants.ts       # chains, thresholds, TTLs
│   ├── abis.ts            # CCC events + retryEnvelope ABI
│   ├── slack.ts           # Block-Kit formatters
│   ├── storage.ts         # KV wrappers (pending, dedup)
│   ├── rpc.ts             # ethers JsonRpcProvider via Tenderly Gateway
│   ├── balanceMonitor.ts
│   ├── eventHandlers.ts
│   ├── deliveryMonitor.ts
│   └── retry.ts           # signer + retryEnvelope tx builder
└── README.md
```

## Required secrets

Configure these in the Tenderly project Secrets UI before deploying:

| Secret | Purpose |
| --- | --- |
| `SLACK_BOT_TOKEN` | Slack bot token (must have `chat:write` on the redundancy channel) |
| `SLACK_REDUNDANCY_CHANNEL_ID` | Slack channel ID for redundancy alerts |
| `RETRY_SIGNER_PRIVATE_KEY` | Hex private key for the EOA that signs `retryEnvelope` |
| `AUTO_RETRY_ENABLED` | `"true"` to enable on-chain auto-retry; anything else = alerts only |
| `RETRY_GAS_LIMIT` | (optional) gasLimit passed into `retryEnvelope`. Default `300000` |
| `ICON_GENERATOR_KEY` | (optional) key for `/api/envelope-icon/...` so delivery alerts render the icon |
| `ALCHEMY_API_KEY` | Single Alchemy key — used to build per-chain RPC URLs for Ethereum, Polygon, and Avalanche |

CrossChainController addresses are pulled from [`@aave-dao/aave-address-book`](https://github.com/aave-dao/aave-address-book) (`GovernanceV3{Ethereum,Polygon,Avalanche}.CROSS_CHAIN_CONTROLLER`) at runtime. The same addresses are duplicated as literals in `tenderly.yaml` because trigger filters can't import from JS — bump the address-book version and refresh those literals together if the canonical addresses ever change.

## Auto-retry safety rails

Even with `AUTO_RETRY_ENABLED=true`, retries are bounded by:

- **One auto-retry per envelope** — `retry-attempted:{envelopeId}` is written before the second attempt would happen, so any further attention is a human decision.
- **24h max age** — envelopes older than `AUTO_RETRY_MAX_AGE_MS` (24h) only get Slack alerts, never on-chain retries.
- **Kill-switch** — flipping `AUTO_RETRY_ENABLED` to anything other than `"true"` immediately pauses on-chain retries; alerts continue.
- **Origin-chain only** — the call goes to the **origin** chain CCC. The signer must hold gas on that chain (and LINK if the bridge route requires it).

## Deploy

```bash
cd actions
npm install
npx tsc --noEmit                       # typecheck
tenderly login                         # one-time
# fill account_id + project_slug in tenderly.yaml
tenderly actions deploy
```

## Verify

End-to-end checklist:

1. **Typecheck**: `npx tsc --noEmit` from `actions/` should be clean.
2. **Balance alert (forced)**: temporarily edit `NOTIFICATION_THRESHOLDS` in `src/constants.ts` to `{ native: 1n << 200n, link: 1n << 200n }`. Deploy, manually run `balance-monitor` from the Tenderly UI. Expect a single `[REDUNDANCY]` Slack message per (chain, token, day). Restore thresholds and redeploy.
3. **Event ingestion**: in Tenderly UI → Web3 Actions → `envelope-events` → "Run Action" → paste the txhash of a recent `EnvelopeRegistered`. Confirm the action's Storage tab shows `pending:0x...` and `pending:index`.
4. **Delivery alert + retry**: pick a pending envelope (or seed one with the storage UI: `pending:0xabc...` JSON with `registeredAtMs` set to 90 minutes ago). Run `delivery-monitor`. Expect:
   - `[REDUNDANCY]` Slack delivery warning to fire once
   - If `AUTO_RETRY_ENABLED=true`: a follow-up Slack `retryEnvelope submitted` with txhash, and `retry-attempted:0xabc...` in storage
   - Second run within the same envelope lifecycle does NOT post again (dedup)
5. **Kill switch**: set `AUTO_RETRY_ENABLED=false`, re-trigger `delivery-monitor` against a fresh stuck envelope. Slack alert fires; no tx is sent.
6. **Failure isolation**: stop Vercel cron temporarily (or block egress). Confirm the redundancy Slack channel still receives alerts.

## Notes on choices

- **ethers v6, not viem** — `@tenderly/actions` runs in a Node sandbox where ethers' single-file build is well-tested; viem is fine but ethers keeps the dep tree smaller.
- **Same-channel dedup is intentionally absent** — primary alerts go to the existing channel, redundancy goes to its own. There's no shared state, so primary-path failure cannot suppress redundancy.
- **`retryEnvelope`, not `retryTransaction`** — `retryEnvelope` re-broadcasts through all configured bridge adapters from the origin CCC. `retryTransaction` is more granular but requires picking specific adapters; the current scope is "broad redundancy", not surgical recovery. Confirm the deployed CCC ABI matches `retryEnvelope((tuple),uint256)` before going live (see Open items in the plan file).
