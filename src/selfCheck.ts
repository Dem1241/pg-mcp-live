import { checkFeatureSupport, evaluateSelfCheck } from "./db/features.js";
import { checkDatabaseHealth } from "./db/health.js";
import { closePool } from "./db/pool.js";

async function main() {
  try {
    const [health, featureSupport] = await Promise.all([
      checkDatabaseHealth(),
      checkFeatureSupport(),
    ]);
    const result = evaluateSelfCheck(featureSupport);

    console.error(result.summary);
    console.error(`- Database: ${health.currentDatabase}`);
    console.error(`- User: ${health.currentUser}`);

    for (const check of result.checks) {
      console.error(`- ${check}`);
    }

    await closePool();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown self-check error";

    console.error("pg-mcp-live self-check failed");
    console.error(`- ${message}`);

    await closePool().catch(() => undefined);
    process.exit(1);
  }
}

void main();
