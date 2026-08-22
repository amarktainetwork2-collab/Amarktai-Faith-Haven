CREATE TABLE `auditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int,
	`actorUserId` int,
	`action` varchar(140) NOT NULL,
	`entityType` varchar(100) NOT NULL,
	`entityId` varchar(100),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `buildings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`addressLine` varchar(255) NOT NULL,
	`city` varchar(120),
	`managerUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `buildings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`buildingId` int,
	`propertyId` int,
	`title` varchar(220) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`visibility` enum('internal','owners','residents','public') NOT NULL DEFAULT 'internal',
	`uploadedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entitlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`orderId` int,
	`key` varchar(100) NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`status` enum('active','consumed','expired','revoked') NOT NULL DEFAULT 'active',
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `entitlements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geoReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`snapshot` json NOT NULL,
	`sourceSummary` varchar(1000) NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`validUntil` timestamp,
	CONSTRAINT `geoReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geoSourceRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceKey` varchar(120) NOT NULL,
	`status` enum('ready','running','failed') NOT NULL DEFAULT 'ready',
	`sourceVersion` varchar(160),
	`recordCount` int NOT NULL DEFAULT 0,
	`sourceUrl` varchar(1000),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `geoSourceRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`propertyId` int,
	`assignedUserId` int,
	`name` varchar(160) NOT NULL,
	`email` varchar(320),
	`phone` varchar(40),
	`source` varchar(100) NOT NULL DEFAULT 'manual',
	`stage` enum('new','contacted','viewing','offer','won','lost') NOT NULL DEFAULT 'new',
	`notes` text,
	`lastContactedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `levyEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`buildingId` int NOT NULL,
	`unitId` int NOT NULL,
	`entryType` enum('charge','payment','adjustment') NOT NULL,
	`amountZar` decimal(14,2) NOT NULL,
	`description` varchar(255) NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`createdByUserId` int NOT NULL,
	CONSTRAINT `levyEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenanceTickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`buildingId` int NOT NULL,
	`unitId` int,
	`raisedByUserId` int,
	`assignedUserId` int,
	`title` varchar(220) NOT NULL,
	`description` text,
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`status` enum('open','assigned','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintenanceTickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mediaJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`propertyId` int,
	`requestedByUserId` int NOT NULL,
	`provider` varchar(80) NOT NULL DEFAULT 'genx',
	`providerJobId` varchar(180),
	`status` enum('queued','running','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
	`templateKey` varchar(100) NOT NULL,
	`inputSnapshot` json NOT NULL,
	`outputUrl` varchar(1024),
	`outputStorageKey` varchar(512),
	`errorMessage` text,
	`retryCount` int NOT NULL DEFAULT 0,
	`costCredits` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mediaJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`buildingId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`body` text NOT NULL,
	`audience` enum('all','owners','residents') NOT NULL DEFAULT 'all',
	`publishedAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`merchantReference` varchar(100) NOT NULL,
	`productKey` varchar(100) NOT NULL,
	`amountZar` decimal(14,2) NOT NULL,
	`status` enum('pending','paid','cancelled','failed','refunded') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_merchantReference_unique` UNIQUE(`merchantReference`)
);
--> statement-breakpoint
CREATE TABLE `organisationInvitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('agency_admin','agent','building_manager','operations','analyst','resident') NOT NULL DEFAULT 'agent',
	`token` varchar(96) NOT NULL,
	`invitedByUserId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organisationInvitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organisationInvitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `organisationMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','agency_admin','agent','building_manager','operations','analyst','resident') NOT NULL DEFAULT 'agent',
	`status` enum('active','invited','suspended') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organisationMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `organisationMembers_org_user_uidx` UNIQUE(`organisationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `organisations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`plan` enum('starter','professional','enterprise') NOT NULL DEFAULT 'starter',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organisations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organisations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `paymentNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`providerTransactionId` varchar(120) NOT NULL,
	`signatureValid` int NOT NULL DEFAULT 0,
	`payload` json NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paymentNotifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `paymentNotifications_provider_tx_uidx` UNIQUE(`providerTransactionId`)
);
--> statement-breakpoint
CREATE TABLE `portalExports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`propertyId` int NOT NULL,
	`portalKey` varchar(100) NOT NULL,
	`status` enum('ready','submitted','published','failed') NOT NULL DEFAULT 'ready',
	`payload` json NOT NULL,
	`remoteListingId` varchar(160),
	`errorMessage` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portalExports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`agentUserId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`slug` varchar(240) NOT NULL,
	`propertyType` enum('house','apartment','townhouse','estate','commercial','land') NOT NULL DEFAULT 'house',
	`listingStatus` enum('draft','review','live','under_offer','sold','archived') NOT NULL DEFAULT 'draft',
	`addressLine` varchar(255) NOT NULL,
	`suburb` varchar(120),
	`city` varchar(120),
	`province` varchar(120),
	`postalCode` varchar(24),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`priceZar` decimal(14,2),
	`bedrooms` int NOT NULL DEFAULT 0,
	`bathrooms` decimal(4,1) NOT NULL DEFAULT '0',
	`parking` int NOT NULL DEFAULT 0,
	`floorAreaSqm` int,
	`description` text,
	`features` json,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `properties_id` PRIMARY KEY(`id`),
	CONSTRAINT `properties_org_slug_uidx` UNIQUE(`organisationId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `propertyMedia` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`altText` varchar(280),
	`mediaType` enum('image','video','floorplan','document') NOT NULL DEFAULT 'image',
	`position` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `propertyMedia_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `propertyShares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`token` varchar(96) NOT NULL,
	`permission` enum('property','report') NOT NULL DEFAULT 'property',
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `propertyShares_id` PRIMARY KEY(`id`),
	CONSTRAINT `propertyShares_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`propertyId` int,
	`leadId` int,
	`buildingId` int,
	`assignedUserId` int,
	`title` varchar(220) NOT NULL,
	`dueAt` timestamp,
	`status` enum('open','in_progress','completed') NOT NULL DEFAULT 'open',
	`priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`buildingId` int NOT NULL,
	`unitNumber` varchar(60) NOT NULL,
	`ownerUserId` int,
	`residentUserId` int,
	`status` enum('occupied','vacant','maintenance') NOT NULL DEFAULT 'occupied',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `units_id` PRIMARY KEY(`id`),
	CONSTRAINT `units_building_unit_uidx` UNIQUE(`buildingId`,`unitNumber`)
);
--> statement-breakpoint
CREATE TABLE `viewings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organisationId` int NOT NULL,
	`propertyId` int NOT NULL,
	`leadId` int,
	`agentUserId` int NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`status` enum('scheduled','confirmed','completed','cancelled') NOT NULL DEFAULT 'scheduled',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `viewings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `auditEvents_org_created_idx` ON `auditEvents` (`organisationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `buildings_org_idx` ON `buildings` (`organisationId`);--> statement-breakpoint
CREATE INDEX `documents_org_idx` ON `documents` (`organisationId`);--> statement-breakpoint
CREATE INDEX `entitlements_org_key_idx` ON `entitlements` (`organisationId`,`key`);--> statement-breakpoint
CREATE INDEX `geoReports_property_idx` ON `geoReports` (`propertyId`);--> statement-breakpoint
CREATE INDEX `geoSourceRuns_source_created_idx` ON `geoSourceRuns` (`sourceKey`,`createdAt`);--> statement-breakpoint
CREATE INDEX `leads_org_stage_idx` ON `leads` (`organisationId`,`stage`);--> statement-breakpoint
CREATE INDEX `levyEntries_building_unit_idx` ON `levyEntries` (`buildingId`,`unitId`);--> statement-breakpoint
CREATE INDEX `maintenanceTickets_building_status_idx` ON `maintenanceTickets` (`buildingId`,`status`);--> statement-breakpoint
CREATE INDEX `mediaJobs_org_status_idx` ON `mediaJobs` (`organisationId`,`status`);--> statement-breakpoint
CREATE INDEX `notices_building_idx` ON `notices` (`buildingId`);--> statement-breakpoint
CREATE INDEX `organisationInvitations_org_idx` ON `organisationInvitations` (`organisationId`);--> statement-breakpoint
CREATE INDEX `organisationMembers_userId_idx` ON `organisationMembers` (`userId`);--> statement-breakpoint
CREATE INDEX `organisations_createdByUserId_idx` ON `organisations` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `portalExports_property_idx` ON `portalExports` (`propertyId`);--> statement-breakpoint
CREATE INDEX `properties_org_status_idx` ON `properties` (`organisationId`,`listingStatus`);--> statement-breakpoint
CREATE INDEX `properties_agent_idx` ON `properties` (`agentUserId`);--> statement-breakpoint
CREATE INDEX `propertyMedia_property_idx` ON `propertyMedia` (`propertyId`);--> statement-breakpoint
CREATE INDEX `propertyShares_property_idx` ON `propertyShares` (`propertyId`);--> statement-breakpoint
CREATE INDEX `tasks_org_status_idx` ON `tasks` (`organisationId`,`status`);--> statement-breakpoint
CREATE INDEX `viewings_org_schedule_idx` ON `viewings` (`organisationId`,`scheduledAt`);
