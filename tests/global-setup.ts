import { execSync } from "node:child_process";
import path from "node:path";
import dotenv from "dotenv";

export default async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, "../.env.test") });

  if (!process.env.DATABASE_URL?.includes("_test")) {
    throw new Error(
      `Refusing to run tests: DATABASE_URL does not look like a test database (${process.env.DATABASE_URL}). ` +
        "Set DATABASE_URL to a database whose name contains '_test' before running tests."
    );
  }

  execSync("npx prisma db push --skip-generate --force-reset --accept-data-loss", {
    stdio: "inherit",
    env: process.env,
  });
}
