import { decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const organisations = mysqlTable("organisations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  plan: mysqlEnum("plan", ["starter", "professional", "enterprise"]).default("starter").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("organisations_createdByUserId_idx").on(table.createdByUserId)]);

export const organisationMembers = mysqlTable("organisationMembers", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "agency_admin", "agent", "building_manager", "operations", "analyst", "resident"]).default("agent").notNull(),
  status: mysqlEnum("status", ["active", "invited", "suspended"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("organisationMembers_org_user_uidx").on(table.organisationId, table.userId),
  index("organisationMembers_userId_idx").on(table.userId),
]);

export const organisationInvitations = mysqlTable("organisationInvitations", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["agency_admin", "agent", "building_manager", "operations", "analyst", "resident"]).default("agent").notNull(),
  token: varchar("token", { length: 96 }).notNull().unique(),
  invitedByUserId: int("invitedByUserId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("organisationInvitations_org_idx").on(table.organisationId)]);

export const properties = mysqlTable("properties", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  agentUserId: int("agentUserId").notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  slug: varchar("slug", { length: 240 }).notNull(),
  propertyType: mysqlEnum("propertyType", ["house", "apartment", "townhouse", "estate", "commercial", "land"]).default("house").notNull(),
  listingStatus: mysqlEnum("listingStatus", ["draft", "review", "live", "under_offer", "sold", "archived"]).default("draft").notNull(),
  addressLine: varchar("addressLine", { length: 255 }).notNull(),
  suburb: varchar("suburb", { length: 120 }),
  city: varchar("city", { length: 120 }),
  province: varchar("province", { length: 120 }),
  postalCode: varchar("postalCode", { length: 24 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  priceZar: decimal("priceZar", { precision: 14, scale: 2 }),
  bedrooms: int("bedrooms").default(0).notNull(),
  bathrooms: decimal("bathrooms", { precision: 4, scale: 1 }).default("0").notNull(),
  parking: int("parking").default(0).notNull(),
  floorAreaSqm: int("floorAreaSqm"),
  description: text("description"),
  features: json("features").$type<string[]>(),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("properties_org_slug_uidx").on(table.organisationId, table.slug),
  index("properties_org_status_idx").on(table.organisationId, table.listingStatus),
  index("properties_agent_idx").on(table.agentUserId),
]);

export const propertyMedia = mysqlTable("propertyMedia", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  altText: varchar("altText", { length: 280 }),
  mediaType: mysqlEnum("mediaType", ["image", "video", "floorplan", "document"]).default("image").notNull(),
  position: int("position").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("propertyMedia_property_idx").on(table.propertyId)]);

export const propertyShares = mysqlTable("propertyShares", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  token: varchar("token", { length: 96 }).notNull().unique(),
  permission: mysqlEnum("permission", ["property", "report"]).default("property").notNull(),
  expiresAt: timestamp("expiresAt"),
  revokedAt: timestamp("revokedAt"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("propertyShares_property_idx").on(table.propertyId)]);

export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  propertyId: int("propertyId"),
  assignedUserId: int("assignedUserId"),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 40 }),
  source: varchar("source", { length: 100 }).default("manual").notNull(),
  stage: mysqlEnum("stage", ["new", "contacted", "viewing", "offer", "won", "lost"]).default("new").notNull(),
  notes: text("notes"),
  lastContactedAt: timestamp("lastContactedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("leads_org_stage_idx").on(table.organisationId, table.stage)]);

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  propertyId: int("propertyId"),
  leadId: int("leadId"),
  buildingId: int("buildingId"),
  assignedUserId: int("assignedUserId"),
  title: varchar("title", { length: 220 }).notNull(),
  dueAt: timestamp("dueAt"),
  status: mysqlEnum("status", ["open", "in_progress", "completed"]).default("open").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, table => [index("tasks_org_status_idx").on(table.organisationId, table.status)]);

export const viewings = mysqlTable("viewings", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  propertyId: int("propertyId").notNull(),
  leadId: int("leadId"),
  agentUserId: int("agentUserId").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  status: mysqlEnum("status", ["scheduled", "confirmed", "completed", "cancelled"]).default("scheduled").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("viewings_org_schedule_idx").on(table.organisationId, table.scheduledAt)]);

export const geoReports = mysqlTable("geoReports", {
  id: int("id").autoincrement().primaryKey(),
  propertyId: int("propertyId").notNull(),
  snapshot: json("snapshot").$type<Record<string, unknown>>().notNull(),
  sourceSummary: varchar("sourceSummary", { length: 1000 }).notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  validUntil: timestamp("validUntil"),
}, table => [index("geoReports_property_idx").on(table.propertyId)]);

export const mediaJobs = mysqlTable("mediaJobs", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  propertyId: int("propertyId"),
  requestedByUserId: int("requestedByUserId").notNull(),
  provider: varchar("provider", { length: 80 }).default("genx").notNull(),
  providerJobId: varchar("providerJobId", { length: 180 }),
  idempotencyKey: varchar("idempotencyKey", { length: 120 }),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed", "cancelled"]).default("queued").notNull(),
  templateKey: varchar("templateKey", { length: 100 }).notNull(),
  inputSnapshot: json("inputSnapshot").$type<Record<string, unknown>>().notNull(),
  outputUrl: varchar("outputUrl", { length: 1024 }),
  outputStorageKey: varchar("outputStorageKey", { length: 512 }),
  providerUsage: json("providerUsage").$type<Record<string, unknown>>(),
  errorMessage: text("errorMessage"),
  retryCount: int("retryCount").default(0).notNull(),
  costCredits: int("costCredits").default(0).notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("mediaJobs_org_status_idx").on(table.organisationId, table.status), uniqueIndex("mediaJobs_provider_idempotency_uidx").on(table.provider, table.idempotencyKey)]);

export const buildings = mysqlTable("buildings", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  addressLine: varchar("addressLine", { length: 255 }).notNull(),
  city: varchar("city", { length: 120 }),
  managerUserId: int("managerUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("buildings_org_idx").on(table.organisationId)]);

export const units = mysqlTable("units", {
  id: int("id").autoincrement().primaryKey(),
  buildingId: int("buildingId").notNull(),
  unitNumber: varchar("unitNumber", { length: 60 }).notNull(),
  ownerUserId: int("ownerUserId"),
  residentUserId: int("residentUserId"),
  status: mysqlEnum("status", ["occupied", "vacant", "maintenance"]).default("occupied").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("units_building_unit_uidx").on(table.buildingId, table.unitNumber)]);

export const maintenanceTickets = mysqlTable("maintenanceTickets", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  buildingId: int("buildingId").notNull(),
  unitId: int("unitId"),
  raisedByUserId: int("raisedByUserId"),
  assignedUserId: int("assignedUserId"),
  title: varchar("title", { length: 220 }).notNull(),
  description: text("description"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  status: mysqlEnum("status", ["open", "assigned", "in_progress", "resolved", "closed"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("maintenanceTickets_building_status_idx").on(table.buildingId, table.status)]);

export const notices = mysqlTable("notices", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  buildingId: int("buildingId").notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  body: text("body").notNull(),
  audience: mysqlEnum("audience", ["all", "owners", "residents"]).default("all").notNull(),
  publishedAt: timestamp("publishedAt"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("notices_building_idx").on(table.buildingId)]);

export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  buildingId: int("buildingId"),
  propertyId: int("propertyId"),
  title: varchar("title", { length: 220 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull(),
  visibility: mysqlEnum("visibility", ["internal", "owners", "residents", "public"]).default("internal").notNull(),
  uploadedByUserId: int("uploadedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("documents_org_idx").on(table.organisationId)]);

export const levyEntries = mysqlTable("levyEntries", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  buildingId: int("buildingId").notNull(),
  unitId: int("unitId").notNull(),
  entryType: mysqlEnum("entryType", ["charge", "payment", "adjustment"]).notNull(),
  amountZar: decimal("amountZar", { precision: 14, scale: 2 }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  createdByUserId: int("createdByUserId").notNull(),
}, table => [index("levyEntries_building_unit_idx").on(table.buildingId, table.unitId)]);

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  merchantReference: varchar("merchantReference", { length: 100 }).notNull().unique(),
  productKey: varchar("productKey", { length: 100 }).notNull(),
  amountZar: decimal("amountZar", { precision: 14, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "paid", "cancelled", "failed", "refunded"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const paymentNotifications = mysqlTable("paymentNotifications", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  providerTransactionId: varchar("providerTransactionId", { length: 120 }).notNull(),
  signatureValid: int("signatureValid").default(0).notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
}, table => [uniqueIndex("paymentNotifications_provider_tx_uidx").on(table.providerTransactionId)]);

export const entitlements = mysqlTable("entitlements", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  orderId: int("orderId"),
  key: varchar("key", { length: 100 }).notNull(),
  quantity: int("quantity").default(0).notNull(),
  status: mysqlEnum("status", ["active", "consumed", "expired", "revoked"]).default("active").notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("entitlements_org_key_idx").on(table.organisationId, table.key)]);

export const researchJobs = mysqlTable("researchJobs", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  propertyId: int("propertyId"),
  requestedByUserId: int("requestedByUserId").notNull(),
  provider: varchar("provider", { length: 80 }).default("genx").notNull(),
  providerSessionId: varchar("providerSessionId", { length: 180 }),
  providerJobId: varchar("providerJobId", { length: 180 }),
  idempotencyKey: varchar("idempotencyKey", { length: 120 }).notNull(),
  researchType: mysqlEnum("researchType", ["amenities", "services", "crime", "market"]).notNull(),
  locationLabel: varchar("locationLabel", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed", "cancelled", "awaiting_provider_contract"]).default("queued").notNull(),
  requestedCredits: int("requestedCredits").default(1).notNull(),
  debitedCredits: int("debitedCredits").default(0).notNull(),
  inputSnapshot: json("inputSnapshot").$type<Record<string, unknown>>().notNull(),
  sourceSnapshot: json("sourceSnapshot").$type<Record<string, unknown>>(),
  resultSnapshot: json("resultSnapshot").$type<Record<string, unknown>>(),
  providerUsage: json("providerUsage").$type<Record<string, unknown>>(),
  errorMessage: text("errorMessage"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("researchJobs_org_status_idx").on(table.organisationId, table.status), uniqueIndex("researchJobs_org_idempotency_uidx").on(table.organisationId, table.idempotencyKey)]);

export const researchCreditLedger = mysqlTable("researchCreditLedger", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  orderId: int("orderId"),
  researchJobId: int("researchJobId"),
  createdByUserId: int("createdByUserId"),
  entryType: mysqlEnum("entryType", ["grant", "debit", "refund", "adjustment"]).notNull(),
  credits: int("credits").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 160 }).notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("researchCreditLedger_idempotency_uidx").on(table.idempotencyKey), index("researchCreditLedger_org_created_idx").on(table.organisationId, table.createdAt), index("researchCreditLedger_job_idx").on(table.researchJobId)]);

export const portalExports = mysqlTable("portalExports", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  propertyId: int("propertyId").notNull(),
  portalKey: varchar("portalKey", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["ready", "submitted", "published", "failed"]).default("ready").notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  remoteListingId: varchar("remoteListingId", { length: 160 }),
  errorMessage: text("errorMessage"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("portalExports_property_idx").on(table.propertyId)]);

export const portalAdapters = mysqlTable("portalAdapters", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId").notNull(),
  portalKey: varchar("portalKey", { length: 100 }).notNull(),
  displayName: varchar("displayName", { length: 160 }).notNull(),
  status: mysqlEnum("status", ["draft", "approved", "disabled"]).default("draft").notNull(),
  approvalReference: varchar("approvalReference", { length: 255 }),
  configuredByUserId: int("configuredByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("portalAdapters_org_key_uidx").on(table.organisationId, table.portalKey),
  index("portalAdapters_org_status_idx").on(table.organisationId, table.status),
]);

export const geoSourceRuns = mysqlTable("geoSourceRuns", {
  id: int("id").autoincrement().primaryKey(),
  sourceKey: varchar("sourceKey", { length: 120 }).notNull(),
  status: mysqlEnum("status", ["ready", "running", "failed"]).default("ready").notNull(),
  sourceVersion: varchar("sourceVersion", { length: 160 }),
  recordCount: int("recordCount").default(0).notNull(),
  sourceUrl: varchar("sourceUrl", { length: 1000 }),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("geoSourceRuns_source_created_idx").on(table.sourceKey, table.createdAt)]);

export const auditEvents = mysqlTable("auditEvents", {
  id: int("id").autoincrement().primaryKey(),
  organisationId: int("organisationId"),
  actorUserId: int("actorUserId"),
  action: varchar("action", { length: 140 }).notNull(),
  entityType: varchar("entityType", { length: 100 }).notNull(),
  entityId: varchar("entityId", { length: 100 }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("auditEvents_org_created_idx").on(table.organisationId, table.createdAt)]);
