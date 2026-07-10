import { Controller, Get } from "@nestjs/common";
import { Public } from "../common/auth.decorators";
import { DatabaseService } from "../db/database.service";

@Controller("health")
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get()
  async check() {
    let dbOk = false;
    try {
      await this.db.pool.query("SELECT 1");
      dbOk = true;
    } catch {
      dbOk = false;
    }
    return {
      status: dbOk ? "ok" : "degraded",
      service: "plansimple-api",
      db: dbOk,
      ts: new Date().toISOString(),
    };
  }

  @Public()
  @Get("metrics")
  metrics() {
    return [
      "# HELP plansimple_up 1 if API process is up",
      "# TYPE plansimple_up gauge",
      "plansimple_up 1",
    ].join("\n");
  }
}
