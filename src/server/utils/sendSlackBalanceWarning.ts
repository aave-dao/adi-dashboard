import { env } from "@/env";
import { slackClient } from "@/server/utils/slackClient";

export const sendSlackBalanceWarning = async ({
  chainName,
  threshold,
  balance,
  tokenName,
}: {
  chainName: string;
  threshold: string;
  balance: string;
  tokenName: string;
}) => {
  await slackClient.chat.postMessage({
    channel: env.SLACK_CHANNEL_ID,
    text: "Low balance",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "☹️💰",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*CCC balance on ${chainName} is below threshold*`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Threshold:*\n${threshold} ${tokenName}`,
          },
          {
            type: "mrkdwn",
            text: `*Current balance:*\n${balance} ${tokenName}`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Check balances",
              emoji: true,
            },
            style: "primary",
            url: `https://adi.tools.aave.com/status`,
          },
        ],
      },
    ],
  });
};
