CREATE TABLE `researchCreditLedger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`orderId` int,
	`researchJobId` int,
	`createdByUserId` int,
	`entryType` enum('grant','debit','refund','adjustment') NOT NULL,
	`credits` int NOT NULL,
	`idempotencyKey` varchar(160) NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `researchCreditLedger_id` PRIMARY KEY(`id`),
	CONSTRAINT `researchCreditLedger_idempotency_uidx` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `researchJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`propertyId` int,
	`requestedByUserId` int NOT NULL,
	`provider` varchar(80) NOT NULL DEFAULT 'genx',
	`providerSessionId` varchar(180),
	`providerJobId` varchar(180),
	`idempotencyKey` varchar(120) NOT NULL,
	`researchType` enum('amenities','services','crime','market') NOT NULL,
	`locationLabel` varchar(255) NOT NULL,
	`status` enum('queued','running','completed','failed','cancelled','awaiting_provider_contract') NOT NULL DEFAULT 'queued',
	`requestedCredits` int NOT NULL DEFAULT 1,
	`debitedCredits` int NOT NULL DEFAULT 0,
	`inputSnapshot` json NOT NULL,
	`sourceSnapshot` json,
	`resultSnapshot` json,
	`providerUsage` json,
	`errorMessage` text,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `researchJobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `researchJobs_org_idempotency_uidx` UNIQUE(`organisationId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE INDEX `researchCreditLedger_org_created_idx` ON `researchCreditLedger` (`organisationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `researchCreditLedger_job_idx` ON `researchCreditLedger` (`researchJobId`);--> statement-breakpoint
CREATE INDEX `researchJobs_org_status_idx` ON `researchJobs` (`organisationId`,`status`);