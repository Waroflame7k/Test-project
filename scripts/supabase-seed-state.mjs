import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function readSeedData() {
  const candidates = [
    path.join(process.cwd(), "data", "app-data.shared.json"),
  ];
  for (const filePath of candidates) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw);
    } catch {
      // continue
    }
  }
  throw new Error("Cannot find seed data file at data/app-data.shared.json");
}

async function main() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = required("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const seedData = await readSeedData();

  const { error: appStateError } = await supabase.from("app_state").upsert(
    {
      id: "main",
      data: seedData,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (appStateError) {
    throw new Error(`Failed to seed app_state: ${appStateError.message}`);
  }

  console.log("Supabase seed completed successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
