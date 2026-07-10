import { Module } from "@nestjs/common";
import { OrgsModule } from "../orgs/orgs.module";
import { WorkflowsService } from "./workflows.service";
import { WorkflowsController } from "./workflows.controller";

@Module({
  imports: [OrgsModule],
  providers: [WorkflowsService],
  controllers: [WorkflowsController],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
