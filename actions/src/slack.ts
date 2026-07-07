import type { Context } from "@tenderly/actions";
import { WebClient } from "@slack/web-api";

import { DASHBOARD_BASE_URL } from "./constants";

const buildClient = async (context: Context): Promise<{ client: WebClient; channel: string }> => {
  const token = await context.secrets.get("SLACK_BOT_TOKEN");
  const channel = await context.secrets.get("SLACK_REDUNDANCY_CHANNEL_ID");
  return { client: new WebClient(token), channel };
};

export const sendBalanceWarning = async (
  context: Context,
  args: {
    chainName: string;
    threshold: string;
    balance: string;
    tokenName: string;
  },
): Promise<void> => {
  const { client, channel } = await buildClient(context);
  await client.chat.postMessage({
    channel,
    text: "[REDUNDANCY] Low balance",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "☹️💰 [REDUNDANCY]", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*CCC balance on ${args.chainName} is below threshold*\n_Source: Tenderly Web3 Action_`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Threshold:*\n${args.threshold} ${args.tokenName}` },
          { type: "mrkdwn", text: `*Current balance:*\n${args.balance} ${args.tokenName}` },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Check balances", emoji: true },
            style: "primary",
            url: `${DASHBOARD_BASE_URL}/status`,
          },
        ],
      },
    ],
  });
};

export const sendDeliveryWarning = async (
  context: Context,
  args: {
    envelopeId: string;
    timeframe: string;
    notificationThreshold: string;
    chainFrom: string;
    chainTo: string;
  },
): Promise<void> => {
  const { client, channel } = await buildClient(context);
  const [firstEight, lastEight] = [args.envelopeId.slice(0, 8), args.envelopeId.slice(-8)];
  const iconKey = await context.secrets.get("ICON_GENERATOR_KEY").catch(() => "");

  await client.chat.postMessage({
    channel,
    text: "[REDUNDANCY] Envelope wasn't delivered",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "⚠️ [REDUNDANCY]", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Envelope delivery overdue by ${args.timeframe}* _(<${args.notificationThreshold} expected)_\n_Source: Tenderly Web3 Action_\n\n${args.chainFrom} → ${args.chainTo}\n\n\`${firstEight}...${lastEight}\``,
        },
        ...(iconKey
          ? {
              accessory: {
                type: "image",
                image_url: `${DASHBOARD_BASE_URL}/api/envelope-icon/${args.envelopeId}?key=${iconKey}`,
                alt_text: "Envelope Icon",
              },
            }
          : {}),
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Envelope Details", emoji: true },
            style: "primary",
            url: `${DASHBOARD_BASE_URL}/envelope/${args.envelopeId}`,
          },
        ],
      },
    ],
  });
};

export const sendRetrySubmitted = async (
  context: Context,
  args: {
    envelopeId: string;
    chainName: string;
    txHash: string;
    explorerUrl: string;
  },
): Promise<void> => {
  const { client, channel } = await buildClient(context);
  const [firstEight, lastEight] = [args.envelopeId.slice(0, 8), args.envelopeId.slice(-8)];
  await client.chat.postMessage({
    channel,
    text: "[REDUNDANCY] retryEnvelope submitted",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🔁 [REDUNDANCY] retryEnvelope submitted", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Auto-retry submitted on ${args.chainName}*\nEnvelope: \`${firstEight}...${lastEight}\``,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View tx", emoji: true },
            style: "primary",
            url: args.explorerUrl,
          },
        ],
      },
    ],
  });
};

export const sendRetryFailed = async (
  context: Context,
  args: { envelopeId: string; chainName: string; reason: string },
): Promise<void> => {
  const { client, channel } = await buildClient(context);
  await client.chat.postMessage({
    channel,
    text: "[REDUNDANCY] retryEnvelope failed",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "❌ [REDUNDANCY] retryEnvelope failed", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Envelope \`${args.envelopeId}\` on ${args.chainName} could not be auto-retried.\n*Reason:* \`${args.reason}\``,
        },
      },
    ],
  });
};
