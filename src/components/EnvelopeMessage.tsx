"use client";
import { useState } from "react";
import { type Hex } from "viem";

import { Button } from "@/components/Button";
import { CopyIcon } from "@/components/CopyIcon";
import { type RouterOutput } from "@/server/api/types";
import { msToTimeComponents } from "@/server/utils/msToTimeComponents";
import { timeComponentsToString } from "@/server/utils/timeComponentsToString";

export const EnvelopeMessage = ({
  decodedMessage,
  message,
  chainId,
  payloadsControllerAddress,
}: {
  decodedMessage: RouterOutput["envelopes"]["get"]["decodedMessage"];
  message: RouterOutput["envelopes"]["get"]["message"];
  chainId: number;
  payloadsControllerAddress: Hex;
}) => {
  const [isRawMessageVisible, setIsRawMessageVisible] =
    useState(!decodedMessage);

  return (
    <div className="">
      {decodedMessage && (
        <div className="pt-6">
          <h2 className="mb-4 flex items-center text-xs font-semibold uppercase tracking-wider">
            {decodedMessage.type}
            <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-500">
              Decoded
            </span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.keys(decodedMessage.data).map((key) => (
              <MessageValue
                key={key}
                chainId={chainId}
                payloadsControllerAddress={payloadsControllerAddress}
                type={key}
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                value={decodedMessage.data[key]}
              />
            ))}
          </div>
        </div>
      )}
      {isRawMessageVisible && (
        <div className="pt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider">
            Encoded message
          </h2>
          <textarea
            className="w-full resize-none font-mono text-sm opacity-60 outline-none"
            value={message ?? ""}
            readOnly
          />
        </div>
      )}
      {decodedMessage && (
        <div className="mt-6">
          <Button
            onClick={() => setIsRawMessageVisible((prev) => !prev)}
            className="text-sm"
          >
            {isRawMessageVisible ? "Hide" : "Show"} raw message
          </Button>
        </div>
      )}
    </div>
  );
};

const MessageValue = ({
  type,
  value,
  chainId,
  payloadsControllerAddress,
}: {
  type: string;
  value: string;
  chainId: number;
  payloadsControllerAddress: Hex;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyClick = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  const getDisplayValue = (type: string, value: string) => {
    const stringifiedValue = value.toString();

    if (type === "timestamp") {
      const dateParts = new Date(+value * 1000)
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
        .split(",");
      return (
        <div className="flex h-7 flex-col justify-center text-left font-mono text-xs font-semibold leading-none">
          <div className="mb-0.5">{dateParts[0]}</div>
          <div>{dateParts[1]}</div>
        </div>
      );
    }

    if (type === "votingDuration") {
      const timeComponents = msToTimeComponents(+value * 1000);
      return timeComponentsToString(timeComponents);
    }

    if (type === "forVotes" || type === "againstVotes") {
      return `${(Number(value) / 1e18).toFixed(2)}`;
    }

    if (stringifiedValue.length > 20) {
      return `${stringifiedValue.slice(0, 10)}...`;
    }

    return stringifiedValue;
  };

  if (type === "payloadId") {
    return (
      <a
        href={`https://vote.tools.aave.com/payloads-explorer/?payloadId=${value}&payloadChainId=${chainId}&payloadsControllerAddress=${payloadsControllerAddress}`}
        className="group/payload-link border bg-brand-100 p-3 hover:border-brand-900"
        target="_blank"
      >
        <div className="flex h-7 items-center font-mono text-xl leading-none opacity-60 group-hover/payload-link:opacity-100">
          <span>{getDisplayValue(type, value)}</span>
          <svg
            className="ml-1 h-4 w-4"
            viewBox="0 0 50 50"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M8 13.6818H22.2727V17.6818H12V37.9034H33.2468V28H37.2468V41.9034H8V13.6818Z"
              fill="currentColor"
            />
            <path
              d="M42.7 21.73V7H27.97V11H35.87L20.87 26L23.5 29.03L38.7 13.83V21.73H42.7Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <h3 className="mt-2 text-xs font-semibold text-brand-900">{type}</h3>
      </a>
    );
  }

  if (type === "proposalId") {
    return (
      <a
        href={`https://vote.tools.aave.com/proposal/?proposalId=${value}`}
        className="group/payload-link border bg-brand-100 p-3 hover:border-brand-900"
        target="_blank"
      >
        <div className="flex h-7 items-center font-mono text-xl leading-none opacity-60 group-hover/payload-link:opacity-100">
          <span>{getDisplayValue(type, value)}</span>
          <svg
            className="ml-1 h-4 w-4"
            viewBox="0 0 50 50"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M8 13.6818H22.2727V17.6818H12V37.9034H33.2468V28H37.2468V41.9034H8V13.6818Z"
              fill="currentColor"
            />
            <path
              d="M42.7 21.73V7H27.97V11H35.87L20.87 26L23.5 29.03L38.7 13.83V21.73H42.7Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <h3 className="mt-2 text-xs font-semibold text-brand-900">{type}</h3>
      </a>
    );
  }

  return (
    <button
      className="group/payload-link border bg-brand-100 p-3 hover:border-brand-900"
      onClick={handleCopyClick}
    >
      <div className="flex h-7 items-center gap-2 font-mono text-xl leading-none opacity-60 group-hover/payload-link:opacity-100">
        <span>{getDisplayValue(type, value)}</span>
        <CopyIcon isCopied={copied} />
      </div>
      <h3 className="mt-2 text-left text-xs font-semibold text-brand-900">
        {type}
      </h3>
    </button>
  );
};
