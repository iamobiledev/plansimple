import { Module } from "@nestjs/common";
import { OrgsModule } from "../orgs/orgs.module";
import { MarkupsController } from "./markups.controller";
import { MarkupsService } from "./markups.service";

@Module({
  imports: [OrgsModule],
  providers: [MarkupsService],
  controllers: [MarkupsController],
  exports: [MarkupsService],
})
export class MarkupsModule {}
