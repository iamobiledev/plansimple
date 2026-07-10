import { Module } from "@nestjs/common";
import { OrgsModule } from "../orgs/orgs.module";
import { AiService } from "./ai.service";
import { AiController } from "./ai.controller";

@Module({
  imports: [OrgsModule],
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
