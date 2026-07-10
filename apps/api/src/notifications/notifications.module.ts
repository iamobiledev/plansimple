import { Module } from "@nestjs/common";
import { OrgsModule } from "../orgs/orgs.module";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";

@Module({
  imports: [OrgsModule],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
