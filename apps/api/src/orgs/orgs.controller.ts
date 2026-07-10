import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  acceptInviteSchema,
  createOrgSchema,
  inviteUserSchema,
} from "@plansimple/shared";
import { OrgsService } from "./orgs.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentUser, Public, type AuthUser } from "../common/auth.decorators";

@Controller()
@UseGuards(JwtAuthGuard)
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Post("organizations")
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createOrgSchema)) body: unknown
  ) {
    return this.orgs.create(user.userId, body as never);
  }

  @Get("organizations")
  list(@CurrentUser() user: AuthUser) {
    return this.orgs.listForUser(user.userId);
  }

  @Get("organizations/:orgId")
  get(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string
  ) {
    return this.orgs.get(orgId, user.userId);
  }

  @Post("organizations/:orgId/invitations")
  invite(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(inviteUserSchema)) body: unknown
  ) {
    return this.orgs.invite(orgId, user.userId, body as never);
  }

  @Public()
  @Post("invitations/accept")
  accept(@Body(new ZodValidationPipe(acceptInviteSchema)) body: unknown) {
    return this.orgs.acceptInvite(body as never);
  }
}
