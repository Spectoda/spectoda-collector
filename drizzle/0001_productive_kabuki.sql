CREATE TABLE `network_stats_aggregated` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`networkId` integer,
	`segId` integer,
	`timestamp_utc` integer,
	`watt` real,
	`brightness` real,
	`ownerSignature` text
);
