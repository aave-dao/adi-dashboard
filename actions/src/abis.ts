export const ERC20_BALANCE_OF_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
];

export const CCC_EVENT_ABI = [
  "event EnvelopeRegistered(bytes32 indexed envelopeId, (uint256 nonce, address origin, address destination, uint256 originChainId, uint256 destinationChainId, bytes message) envelope)",
  "event EnvelopeDeliveryAttempted(bytes32 envelopeId, (uint256 nonce, address origin, address destination, uint256 originChainId, uint256 destinationChainId, bytes message) envelope, bool isDelivered)",
  "event TransactionForwardingAttempted(bytes32 transactionId, bytes32 indexed envelopeId, bytes encodedTransaction, uint256 destinationChainId, address indexed bridgeAdapter, address destinationBridgeAdapter, bool indexed adapterSuccessful, bytes returnData)",
];

export const CCC_RETRY_ENVELOPE_ABI = [
  "function retryEnvelope((uint256 nonce, address origin, address destination, uint256 originChainId, uint256 destinationChainId, bytes message) envelope, uint256 gasLimit) returns (bytes32)",
];

export type EnvelopeStruct = {
  nonce: string;
  origin: string;
  destination: string;
  originChainId: string;
  destinationChainId: string;
  message: string;
};
