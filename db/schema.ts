import { integer, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

export const logosSchema = pgSchema("logos");

/**
 * A non-domain singleton used only to prove migrations, grants, fixtures, and
 * export/restore before Phase 02 has any domain tables.
 */
export const infrastructureProbe = logosSchema.table("infrastructure_probe", {
  id: integer().primaryKey(),
  marker: text().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
