import { Module } from "@nestjs/common";
import { OrgsModule } from "../orgs/orgs.module";
import { DocumentsModule } from "../documents/documents.module";
import { ExportService } from "./export.service";
import { ExportController } from "./export.controller";
import { ProjectExportController } from "./project-export.controller";

@Module({
  imports: [OrgsModule, DocumentsModule],
  providers: [ExportService],
  controllers: [ExportController, ProjectExportController],
  exports: [ExportService],
})
export class ExportModule {}
