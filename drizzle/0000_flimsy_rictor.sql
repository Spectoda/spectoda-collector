CREATE TABLE `network_event_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`networkId` integer,
	`label` text,
	`segId` integer,
	`network_timestamp` integer,
	`timestamp_utc` integer,
	`type` integer,
	`value` real,
	`ownerSignature` text
);
--> statement-breakpoint
CREATE TABLE `network_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`networkId` integer,
	`segId` integer,
	`timestamp_utc` integer,
	`watt` real,
	`brightness` real,
	`ownerSignature` text
);
--> statement-breakpoint
CREATE TABLE `network` (
	`network` text,
	`ownerSignature` text,
	`ownerKey` text
);
