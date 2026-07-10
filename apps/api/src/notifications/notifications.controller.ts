import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, type AuthUser } from "../common/auth.decorators";

@Controller()
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("organizations/:orgId/notifications")
  list(@CurrentUser() user: AuthUser, @Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.notifications.list(orgId, user.userId);
  }

  @Get("organizations/:orgId/notifications/digest-preview")
  digest(@CurrentUser() user: AuthUser, @Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.notifications.digestPreview(orgId, user.userId);
  }

  @Post("organizations/:orgId/notifications/:id/read")
  markRead(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("id", ParseUUIDPipe) id: string
  ) {
    return this.notifications.markRead(orgId, user.userId, id);
  }

  @Get("organizations/:orgId/audit-log")
  audit(@CurrentUser() user: AuthUser, @Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.notifications.listAudit(orgId, user.userId);
  }
}
