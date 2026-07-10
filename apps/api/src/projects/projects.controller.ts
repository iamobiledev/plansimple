import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
} from "@nestjs/common";
import { createProjectSchema } from "@plansimple/shared";
import { ProjectsService } from "./projects.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentUser, type AuthUser } from "../common/auth.decorators";

@Controller("organizations/:orgId/projects")
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(createProjectSchema)) body: unknown
  ) {
    return this.projects.create(orgId, user.userId, body as never);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string
  ) {
    return this.projects.list(orgId, user.userId);
  }

  @Get(":projectId")
  get(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string
  ) {
    return this.projects.get(orgId, projectId, user.userId);
  }

  @Delete(":projectId")
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string
  ) {
    await this.projects.remove(orgId, projectId, user.userId);
  }
}
