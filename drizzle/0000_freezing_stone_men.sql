CREATE TABLE "AddressBook" (
	"address" varchar NOT NULL,
	"chain_id" bigint NOT NULL,
	"name" text,
	CONSTRAINT "AddressBook_address_chain_id_pk" PRIMARY KEY("address","chain_id")
);
--> statement-breakpoint
CREATE TABLE "BridgeExplorers" (
	"chain_id" bigint NOT NULL,
	"address" varchar NOT NULL,
	"explorer_link" text,
	CONSTRAINT "BridgeExplorers_chain_id_address_pk" PRIMARY KEY("chain_id","address")
);
--> statement-breakpoint
CREATE TABLE "CrossChainControllers" (
	"chain_id" bigint PRIMARY KEY NOT NULL,
	"address" varchar DEFAULT '' NOT NULL,
	"rpc_block_limit" bigint DEFAULT 500 NOT NULL,
	"created_block" bigint DEFAULT 0 NOT NULL,
	"rpc_urls" text[],
	"last_scanned_block" bigint,
	"chain_name_alias" text,
	"analytics_rpc_url" text,
	"native_token_name" text,
	"native_token_symbol" text
);
--> statement-breakpoint
CREATE TABLE "EnvelopeDeliveryAttempted" (
	"transaction_hash" varchar NOT NULL,
	"log_index" bigint NOT NULL,
	"envelope_id" text,
	"block_number" bigint,
	"is_delivered" boolean DEFAULT false NOT NULL,
	"chain_id" bigint,
	"timestamp" timestamp with time zone,
	CONSTRAINT "EnvelopeDeliveryAttempted_transaction_hash_log_index_pk" PRIMARY KEY("transaction_hash","log_index")
);
--> statement-breakpoint
CREATE TABLE "EnvelopeRegistered" (
	"transaction_hash" varchar NOT NULL,
	"log_index" bigint NOT NULL,
	"envelope_id" text,
	"block_number" bigint,
	"chain_id" bigint,
	"timestamp" timestamp with time zone,
	CONSTRAINT "EnvelopeRegistered_transaction_hash_log_index_pk" PRIMARY KEY("transaction_hash","log_index")
);
--> statement-breakpoint
CREATE TABLE "Envelopes" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message" "bytea",
	"origin" varchar,
	"destination" varchar,
	"origin_chain_id" bigint,
	"destination_chain_id" bigint,
	"nonce" bigint,
	"registered_at" timestamp with time zone,
	"proposal_id" text,
	"payload_id" bigint
);
--> statement-breakpoint
CREATE TABLE "Retries" (
	"from_block" bigint NOT NULL,
	"to_block" bigint NOT NULL,
	"chain_id" bigint NOT NULL,
	CONSTRAINT "Retries_from_block_to_block_chain_id_pk" PRIMARY KEY("from_block","to_block","chain_id")
);
--> statement-breakpoint
CREATE TABLE "SentNotifications" (
	"notification_hash" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE "TransactionCosts" (
	"transaction_hash" varchar NOT NULL,
	"value" numeric,
	"token_address" varchar,
	"token_name" text,
	"token_usd_price" numeric,
	"from" varchar NOT NULL,
	"to" varchar NOT NULL,
	"chain_id" bigint,
	"token_symbol" text,
	"value_usd" numeric,
	"log_index" bigint NOT NULL,
	"timestamp" timestamp with time zone,
	CONSTRAINT "TransactionCosts_transaction_hash_from_to_log_index_pk" PRIMARY KEY("transaction_hash","from","to","log_index")
);
--> statement-breakpoint
CREATE TABLE "TransactionForwardingAttempted" (
	"transaction_hash" varchar NOT NULL,
	"log_index" bigint NOT NULL,
	"envelope_id" text,
	"block_number" bigint,
	"chain_id" bigint,
	"transaction_id" text,
	"destination_chain_id" bigint,
	"bridge_adapter" text,
	"destination_bridge_adapter" text,
	"adapter_successful" boolean,
	"return_data" "bytea",
	"encoded_transaction" "bytea",
	"timestamp" timestamp with time zone,
	CONSTRAINT "TransactionForwardingAttempted_transaction_hash_log_index_pk" PRIMARY KEY("transaction_hash","log_index")
);
--> statement-breakpoint
CREATE TABLE "TransactionGasCosts" (
	"transaction_hash" varchar PRIMARY KEY NOT NULL,
	"chain_id" bigint,
	"gas_price" numeric,
	"transaction_fee" numeric,
	"transaction_fee_usd" numeric,
	"token_usd_price" numeric,
	"token_name" text,
	"token_symbol" text,
	"timestamp" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "TransactionReceived" (
	"transaction_hash" varchar NOT NULL,
	"log_index" bigint NOT NULL,
	"envelope_id" text NOT NULL,
	"block_number" bigint NOT NULL,
	"chain_id" bigint,
	"transaction_id" text,
	"origin_chain_id" bigint,
	"bridge_adapter" text,
	"confirmations" bigint,
	"nonce" bigint,
	"encoded_envelope" "bytea",
	"timestamp" timestamp with time zone,
	CONSTRAINT "TransactionReceived_transaction_hash_log_index_pk" PRIMARY KEY("transaction_hash","log_index")
);
