import postgres from "postgres";
import { migrate } from "./migrations.ts";

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url)
  throw new Error(
    "Set DATABASE_URL_UNPOOLED to an empty development database.",
  );
if (new URL(url).hostname.includes("-pooler"))
  throw new Error("Migrations require a direct connection.");
const sql = postgres(url, { max: 1 });
try {
  await migrate(sql);
} finally {
  await sql.end();
}
