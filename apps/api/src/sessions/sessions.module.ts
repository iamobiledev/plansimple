import { Module } from "@nestjs/common";
import { OrgsModule } from "../orgs/orgs.module";
import { SessionsService } from "./sessions.service";
import { SessionsController } from "./sessions.controller";

@Module({
  imports: [OrgsModule],
  providers: [SessionsService],
  controllers: [SessionsController],
  exports: [SessionsService],
})
export class SessionsModule {}
