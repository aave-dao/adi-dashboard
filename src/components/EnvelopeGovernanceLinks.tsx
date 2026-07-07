import { type Hex } from "viem";

export const EnvelopeGovernanceLinks = ({
  proposalId,
  payloadId,
  chainId,
  payloadsControllerAddress,
}: {
  proposalId?: string | number | null;
  payloadId?: number | null;
  chainId: number;
  payloadsControllerAddress: Hex;
}) => {
  return (
    <>
      <div className="pt-7">
        <h2 className="mb-4 flex items-center text-xs font-semibold uppercase tracking-wider">
          Governance links
        </h2>
        <div className="flex gap-2">
          {proposalId && (
            <a
              href={`https://vote.tools.aave.com/proposal/?proposalId=${proposalId}`}
              className="group/payload-link border bg-brand-100 p-3 hover:border-brand-900"
              target="_blank"
            >
              <div className="flex h-7 items-center font-mono text-xl leading-none opacity-60 group-hover/payload-link:opacity-100">
                <span>{proposalId}</span>
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
              <h3 className="mt-2 text-xs font-semibold text-brand-900">
                Proposal ID
              </h3>
            </a>
          )}
          {payloadId && (
            <a
              href={`https://vote.tools.aave.com/payloads-explorer/?payloadId=${payloadId}&payloadChainId=${chainId}&payloadsControllerAddress=${payloadsControllerAddress}`}
              className="group/payload-link border bg-brand-100 p-3 hover:border-brand-900"
              target="_blank"
            >
              <div className="flex h-7 items-center font-mono text-xl leading-none opacity-60 group-hover/payload-link:opacity-100">
                <span>{payloadId}</span>
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
              <h3 className="mt-2 text-xs font-semibold text-brand-900">
                Payload ID
              </h3>
            </a>
          )}
        </div>
      </div>
    </>
  );
};
