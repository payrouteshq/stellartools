import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

async function migrate() {
  const connectionString = process.env.GHL_APP_DATABASE_URL;
  if (!connectionString) {
    console.error("Error: GHL_APP_DATABASE_URL is not set");
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, "schema.sql");

  // Try applying via pgschema CLI if installed, otherwise fallback to pg pool execution
  try {
    execSync("pgschema --version", { stdio: "ignore" });
    console.log("Applying schema using pgschema...");
    execSync(`pgschema apply --schema "${schemaPath}" --url "${connectionString}"`, { stdio: "inherit" });
    console.log("pgschema migration applied successfully.");
    return;
  } catch {
    // pgschema CLI not installed in environment, executing declarative schema.sql via pg pool
  }

  const pool = new Pool({ connectionString });
  const sql = fs.readFileSync(schemaPath, "utf8");

  try {
    console.log("Applying database schema from db/schema.sql...");
    await pool.query(sql);

    const seedLocationSql = `
      INSERT INTO ghl_locations (location_id, company_id, access_token, refresh_token, token_expires_at)
      VALUES ('test-location', 'test-company', 'x', 'x', NOW() + INTERVAL '30 days')
      ON CONFLICT (location_id) DO NOTHING;
    `;
    await pool.query(seedLocationSql);

    console.log("Database schema applied successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
