import React from "react";
import * as chains from "viem/chains";

import { ChainIcon } from "@/components/ChainIcon";
import { ExplorerLinkCopyButton } from "@/components/ExplorerLinkCopyButton";
import { Tooltip } from "@/components/Tooltip";
import { api } from "@/trpc/server";
import { cn } from "@/utils/cn";

const EXPLORER_OVERRIDES: Record<number, string> = {
  143: "https://monadscan.com", // Monad
};

export const ExplorerLink = async ({
  type,
  value,
  chainId,
  skipAdapter,
  hideLabel,
  tiny,
}: {
  type: "tx" | "address";
  value: string;
  chainId: number;
  skipAdapter?: boolean;
  hideLabel?: boolean;
  tiny?: boolean;
}) => {
  let label;

  if (type === "address" && !hideLabel) {
    label = await api.address.get({ address: value, chainId });
  }

  const chain = Object.values(chains).find((chain) => chain.id === chainId);
  if (!chain) {
    return null;
  }

  let url;

  const explorerUrl =
    EXPLORER_OVERRIDES[chainId] ??
    ("blockExplorers" in chain
      ? chain.blockExplorers?.default?.url
      : undefined);
  if (explorerUrl) {
    url = `${explorerUrl}/${type}/${value}`;
  }

  const [firstEight, lastEight] = [value.slice(0, 8), value.slice(-8)];

  if (tiny) {
    label = label && skipAdapter ? label.replace(/adapter$/, "") : label;

    return (
      <Tooltip value={label ? `${firstEight}...${lastEight}` : "Unknown"}>
        <a
          href={url}
          className="shrink translate-y-[1px] cursor-pointer truncate border-b border-dotted border-transparent font-mono text-xs leading-none opacity-60 hover:border-brand-900 hover:text-brand-900 hover:opacity-100"
          target="_blank"
        >
          {label || <span>{`${firstEight}...${lastEight}`}</span>}
        </a>
      </Tooltip>
    );
  }

  return (
    <div className="inline-flex items-center">
      <div className="flex items-center gap-2">
        {!hideLabel && (
          <div
            className={cn("flex items-center", {
              ["-ml-0.5 rounded-full bg-brand-300 pl-0.5 text-brand-900"]:
                label,
            })}
          >
            <div
              className={cn(
                "shrink-0 opacity-60 grayscale transition-opacity hover:opacity-100 hover:contrast-100 hover:grayscale-0",
                {
                  ["contrast-150"]: label,
                },
              )}
            >
              <ChainIcon chainId={chainId} />
            </div>
            {label && (
              <div className="truncate rounded-r-full bg-brand-300 py-1 pl-1.5 pr-2 text-xs font-semibold text-brand-900">
                {skipAdapter ? label.replace(/adapter$/, "") : label}
              </div>
            )}
          </div>
        )}
        <a
          href={url}
          className="block shrink translate-y-[1px] cursor-pointer truncate border-b border-dotted border-transparent font-mono text-sm leading-none opacity-60 hover:border-brand-900 hover:text-brand-900 hover:opacity-100"
          target="_blank"
        >
          <span className="xl:hidden">
            {firstEight}
            {"..."}
            {!label && lastEight}
          </span>
          <span className="hidden xl:block">{value}</span>
        </a>
      </div>
      <ExplorerLinkCopyButton value={value} />
    </div>
  );
};
