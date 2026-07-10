import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { DatabaseModule } from "./db/database.module";
import { AuthModule } from "./auth/auth.module";
import { OrgsModule } from "./orgs/orgs.module";
import { ProjectsModule } from "./projects/projects.module";
import { HealthModule } from "./health/health.module";
import { StorageModule } from "./storage/storage.module";
import { DocumentsModule } from "./documents/documents.module";
import { FlagsModule } from "./flags/flags.module";
import { MarkupsModule } from "./markups/markups.module";
import { SessionsModule } from "./sessions/sessions.module";
import { WorkflowsModule } from "./workflows/workflows.module";
import { ToolChestModule } from "./toolchest/toolchest.module";
import { ExportModule } from "./export/export.module";
import { PagesModule } from "./pages/pages.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    StorageModule,
    AuthModule,
    OrgsModule,
    ProjectsModule,
    DocumentsModule,
    MarkupsModule,
    PagesModule,
    SessionsModule,
    WorkflowsModule,
    ToolChestModule,
    ExportModule,
    FlagsModule,
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
