const PROPOSALS_PAYLOADS_URL =
  "https://raw.githubusercontent.com/aave-dao/aave-governance-cache/main/cache/ui/mainnet/proposals_payloads.json";

type PayloadItem = {
  id: number;
  chainId: number;
  payloadsController: string;
};

type PayloadData = Record<string, PayloadItem[]>;

type Data = {
  data: PayloadData;
};

export const getPayloadProposalRelation = async (
  payloadId: number | string,
  chainId: number,
) => {
  const response = await fetch(PROPOSALS_PAYLOADS_URL, {
    next: { revalidate: 30 },
  });
  const { data } = (await response.json()) as Data;

  for (const key in data) {
    if (
      data[key]!.some(
        (item) => item.id === Number(payloadId) && item.chainId === chainId,
      )
    ) {
      return key;
    }
  }

  return null;
};
