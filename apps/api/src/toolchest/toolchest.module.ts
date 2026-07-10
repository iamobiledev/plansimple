import { Module } from "@nestjs/common";
import { OrgsModule } from "../orgs/orgs.module";
import { ToolChestService } from "./toolchest.service";
import { ToolChestController } from "./toolchest.controller";

@Module({
  imports: [OrgsModule],
  providers: [ToolChestService],
  controllers: [ToolChestController],
  exports: [ToolChestService],
})
export class ToolChestModule {}
