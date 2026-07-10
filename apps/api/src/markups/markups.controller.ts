import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { bulkStatusSchema, createMarkupSchema, updateMarkupSchema } from "@plansimple/shared";
import { CurrentUser, type AuthUser } from "../common/auth.decorators";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MarkupsService } from "./markups.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class MarkupsController {
  constructor(private readonly markups: MarkupsService) {}

  @Get("organizations/:orgId/pages/:pageId/markups")
  listByPage(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string
  ) {
    return this.markups.listByPage(orgId, pageId, user.userId);
  }

  @Get("organizations/:orgId/revisions/:revisionId/markups")
  listByRevision(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("revisionId", ParseUUIDPipe) revisionId: string
  ) {
    return this.markups.listByRevision(orgId, revisionId, user.userId);
  }

  @Post("organizations/:orgId/markups")
  create(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(createMarkupSchema)) body: unknown
  ) {
    return this.markups.create(orgId, user.userId, body as never);
  }

  @Patch("organizations/:orgId/markups/:markupId")
  update(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("markupId", ParseUUIDPipe) markupId: string,
    @Body(new ZodValidationPipe(updateMarkupSchema)) body: unknown
  ) {
    return this.markups.update(orgId, markupId, user.userId, body as never);
  }

  @Delete("organizations/:orgId/markups/:markupId")
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("markupId", ParseUUIDPipe) markupId: string
  ) {
    await this.markups.remove(orgId, markupId, user.userId);
  }

  @Post("organizations/:orgId/markups/bulk-status")
  bulkStatus(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(bulkStatusSchema)) body: unknown
  ) {
    return this.markups.bulkStatus(orgId, user.userId, body as never);
  }
}
