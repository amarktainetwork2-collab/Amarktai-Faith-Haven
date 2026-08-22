ALTER TABLE `mediaJobs` ADD `idempotencyKey` varchar(120);--> statement-breakpoint
ALTER TABLE `mediaJobs` ADD `providerUsage` json;--> statement-breakpoint
ALTER TABLE `mediaJobs` ADD `completedAt` timestamp;--> statement-breakpoint
ALTER TABLE `mediaJobs` ADD CONSTRAINT `mediaJobs_provider_idempotency_uidx` UNIQUE(`provider`,`idempotencyKey`);