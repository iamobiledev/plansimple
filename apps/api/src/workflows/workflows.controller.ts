import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { createWorkflowItemSchema } from "@plansimple/shared";
import { WorkflowsService } from "./workflows.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentUser, type AuthUser } from "../common/auth.decorators";

@Controller("organizations/:orgId/projects/:projectId")
@UseGuards(JwtAuthGuard)
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get("rfis")
  listRfis(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string
  ) {
    return this.workflows.listRfis(orgId, projectId, user.userId);
  }

  @Post("rfis")
  createRfi(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(createWorkflowItemSchema)) body: unknown
  ) {
    return this.workflows.createRfi(orgId, projectId, user.userId, body as never);
  }

  @Get("submittals")
  listSubmittals(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string
  ) {
    return this.workflows.listSubmittals(orgId, projectId, user.userId);
  }

  @Post("submittals")
  createSubmittal(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(createWorkflowItemSchema)) body: unknown
  ) {
    return this.workflows.createSubmittal(orgId, projectId, user.userId, body as never);
  }

  @Get("punch-items")
  listPunch(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string
  ) {
    return this.workflows.listPunch(orgId, projectId, user.userId);
  }

  @Post("punch-items")
  createPunch(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(createWorkflowItemSchema)) body: unknown
  ) {
    return this.workflows.createPunch(orgId, projectId, user.userId, body as never);
  }
}
