CREATE TABLE `portalAdapters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`portalKey` varchar(100) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`status` enum('draft','approved','disabled') NOT NULL DEFAULT 'draft',
	`approvalReference` varchar(255),
	`configuredByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portalAdapters_id` PRIMARY KEY(`id`),
	CONSTRAINT `portalAdapters_org_key_uidx` UNIQUE(`organisationId`,`portalKey`)
);
--> statement-breakpoint
CREATE INDEX `portalAdapters_org_status_idx` ON `portalAdapters` (`organisationId`,`status`);