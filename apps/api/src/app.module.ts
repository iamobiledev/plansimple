import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { DatabaseModule } from "./db/database.module";
import { AuthModule } from "./auth/auth.module";
import { OrgsModule } from "./orgs/orgs.module";
import { ProjectsModule } from "./projects/projects.module";
import { HealthModule } from "./health/health.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    OrgsModule,
    ProjectsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
