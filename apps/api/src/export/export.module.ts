import { Module } from "@nestjs/common";
import { OrgsModule } from "../orgs/orgs.module";
import { ExportService } from "./export.service";
import { ExportController } from "./export.controller";

@Module({
  imports: [OrgsModule],
  providers: [ExportService],
  controllers: [ExportController],
  exports: [ExportService],
})
export class ExportModule {}
