import { closeDemoDatabase } from "./helpers/demoDatabase.js";

export default async function globalSetup() {
  return async () => {
    await closeDemoDatabase();
  };
}
