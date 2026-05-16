import { index, integer, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

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
