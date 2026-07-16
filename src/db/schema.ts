import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  discordId: text("discord_id").unique(),
  discordUsername: text("discord_username"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  timezone: text("timezone"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const inventoryLocations = pgTable(
  "inventory_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    system: text("system"),
    locationType: text("location_type"),
    parentLocationId: uuid("parent_location_id"),
    notes: text("notes"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("inventory_locations_user_id_idx").on(table.userId),
    parentLocationIdx: index("inventory_locations_parent_location_id_idx").on(table.parentLocationId),
  }),
);

export const inventoryStacks = pgTable(
  "inventory_stacks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    locationId: uuid("location_id"),
    materialId: text("material_id"),
    materialName: text("material_name"),
    itemName: text("item_name").notNull(),
    itemKind: text("item_kind"),
    catalogItemId: text("catalog_item_id"),
    catalogSource: text("catalog_source"),
    unitType: text("unit_type"),
    quantity: numeric("quantity").notNull().default("0"),
    quality: numeric("quality"),
    qualityBand: integer("quality_band"),
    rarity: text("rarity"),
    container: text("container"),
    notes: text("notes"),
    source: text("source"),
    sourceHistory: jsonb("source_history").notNull().default([]),
    valueAuec: numeric("value_auec"),
    valueUnit: text("value_unit"),
    valueSource: text("value_source"),
    snapshot: jsonb("snapshot").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("inventory_stacks_user_id_idx").on(table.userId),
    locationIdIdx: index("inventory_stacks_location_id_idx").on(table.locationId),
    materialIdIdx: index("inventory_stacks_material_id_idx").on(table.materialId),
  }),
);

export const inventoryImportRuns = pgTable(
  "inventory_import_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    source: text("source").notNull(),
    status: text("status").notNull().default("pending"),
    fileName: text("file_name"),
    importedCount: integer("imported_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    metadata: jsonb("metadata").notNull().default({}),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("inventory_import_runs_user_id_idx").on(table.userId),
  }),
);

export const inventoryImportRows = pgTable(
  "inventory_import_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    importRunId: uuid("import_run_id").notNull(),
    inventoryStackId: uuid("inventory_stack_id"),
    rowIndex: integer("row_index").notNull(),
    status: text("status").notNull().default("pending"),
    rawData: jsonb("raw_data").notNull().default({}),
    normalizedData: jsonb("normalized_data").notNull().default({}),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("inventory_import_rows_user_id_idx").on(table.userId),
    importRunIdx: index("inventory_import_rows_import_run_id_idx").on(table.importRunId),
  }),
);

export const buildQueues = pgTable(
  "build_queues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    sourceType: text("source_type").notNull().default("custom"),
    sourceReference: text("source_reference"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("build_queues_user_id_idx").on(table.userId),
    sourceReferenceIdx: index("build_queues_source_reference_idx").on(table.userId, table.sourceType, table.sourceReference),
  }),
);

export const buildQueueItems = pgTable(
  "build_queue_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    queueId: uuid("queue_id").notNull().references(() => buildQueues.id, { onDelete: "cascade" }),
    recipeId: text("recipe_id").notNull(),
    blueprintId: text("blueprint_id"),
    itemId: text("item_id"),
    itemName: text("item_name"),
    quantity: integer("quantity").notNull().default(1),
    status: text("status").notNull().default("queued"),
    priority: integer("priority").notNull().default(0),
    priorityActive: boolean("priority_active").notNull().default(false),
    allowLowerQuality: boolean("allow_lower_quality").notNull().default(false),
    finalProductQualityBand: numeric("final_product_quality_band"),
    finalProductQualityAverage: numeric("final_product_quality_average"),
    finalProductRarity: text("final_product_rarity"),
    materialRequirements: jsonb("material_requirements").notNull().default([]),
    reservedAllocations: jsonb("reserved_allocations").notNull().default([]),
    blueprintSources: jsonb("blueprint_sources").notNull().default([]),
    snapshot: jsonb("snapshot").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("build_queue_items_user_id_idx").on(table.userId),
    queueIdIdx: index("build_queue_items_queue_id_idx").on(table.queueId),
    recipeIdIdx: index("build_queue_items_recipe_id_idx").on(table.recipeId),
  }),
);

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id").primaryKey(),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const userSavedBlueprints = pgTable(
  "user_saved_blueprints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    blueprintId: text("blueprint_id").notNull(),
    faction: text("faction"),
    itemName: text("item_name"),
    sourceType: text("source_type").default("blueprint"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_saved_blueprints_user_id_idx").on(table.userId),
    userBlueprintUnique: unique("user_saved_blueprints_user_id_blueprint_id_unique").on(
      table.userId,
      table.blueprintId,
    ),
  }),
);

export const userBuildQueueItems = pgTable(
  "user_build_queue_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    recipeId: text("recipe_id").notNull(),
    variantId: text("variant_id"),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_build_queue_items_user_id_idx").on(table.userId),
    userRecipeVariantUnique: unique("user_build_queue_items_user_id_recipe_id_variant_id_unique").on(
      table.userId,
      table.recipeId,
      table.variantId,
    ),
  }),
);

export const userInventoryEntries = pgTable(
  "user_inventory_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    itemName: text("item_name").notNull(),
    itemType: text("item_type").notNull(),
    qualityBand: integer("quality_band"),
    qualityValue: integer("quality_value"),
    quantity: numeric("quantity").notNull().default("0"),
    locationKey: text("location_key"),
    source: text("source").default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_inventory_entries_user_id_idx").on(table.userId),
    userLocationIdx: index("user_inventory_entries_user_id_location_key_idx").on(table.userId, table.locationKey),
    userItemLocationUnique: unique("user_inventory_entries_user_item_quality_location_unique").on(
      table.userId,
      table.itemName,
      table.itemType,
      table.qualityBand,
      table.locationKey,
    ),
  }),
);
