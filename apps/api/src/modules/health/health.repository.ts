import { verifyDatabaseConnection, type DatabaseCheckResult } from "../../config/database.js";

export class HealthRepository {
  async checkDatabase(): Promise<DatabaseCheckResult> {
    return verifyDatabaseConnection();
  }
}

export const healthRepository = new HealthRepository();
