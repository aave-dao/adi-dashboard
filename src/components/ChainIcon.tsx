"use client";

import { Web3Icon } from "@aave-dao/react-web3-icons";
import { chainsIconsPack } from "@aave-dao/react-web3-icons/dist/iconsPacks/chainsIconsPack";

import { Tooltip } from "@/components/Tooltip";
import { cn } from "@/utils/cn";
import { getChainName } from "@/utils/getChainName";

type Props = {
  chainId?: number | null;
  isBig?: boolean;
};

export const ChainIcon = ({ chainId, isBig }: Props) => {
  if (!chainId) return null;
  const chainName = getChainName(chainId);

  return (
    <Tooltip value={chainName ?? "Unknown chain"}>
      <div>
        <Web3Icon
          chainId={chainId}
          className={cn("h-5 w-5 shrink-0", { ["h-7 w-7"]: isBig })}
          iconsPack={chainsIconsPack}
          fallbackProps={{
            className: cn("h-5 w-5 shrink-0", { ["h-7 w-7"]: isBig }),
          }}
        />
      </div>
    </Tooltip>
  );
};
