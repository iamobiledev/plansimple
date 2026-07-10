import { Module, forwardRef } from "@nestjs/common";
import { OrgsModule } from "../orgs/orgs.module";
import { PagesModule } from "../pages/pages.module";
import { MarkupsController } from "./markups.controller";
import { MarkupsService } from "./markups.service";

@Module({
  imports: [OrgsModule, forwardRef(() => PagesModule)],
  providers: [MarkupsService],
  controllers: [MarkupsController],
  exports: [MarkupsService],
})
export class MarkupsModule {}
