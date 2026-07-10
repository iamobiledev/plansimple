import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { createSessionSchema } from "@plansimple/shared";
import { SessionsService } from "./sessions.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentUser, type AuthUser } from "../common/auth.decorators";

@Controller()
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post("organizations/:orgId/projects/:projectId/sessions")
  create(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(createSessionSchema)) body: unknown
  ) {
    return this.sessions.create(orgId, projectId, user.userId, body as never);
  }

  @Get("organizations/:orgId/projects/:projectId/sessions")
  list(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string
  ) {
    return this.sessions.list(orgId, projectId, user.userId);
  }

  @Post("organizations/:orgId/sessions/:sessionId/end")
  end(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string
  ) {
    return this.sessions.end(orgId, sessionId, user.userId);
  }
}
