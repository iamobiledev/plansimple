import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { createToolChestItemSchema } from "@plansimple/shared";
import { ToolChestService } from "./toolchest.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentUser, type AuthUser } from "../common/auth.decorators";

@Controller("organizations/:orgId/tool-chest")
@UseGuards(JwtAuthGuard)
export class ToolChestController {
  constructor(private readonly toolChest: ToolChestService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.toolChest.list(orgId, user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(createToolChestItemSchema)) body: unknown
  ) {
    return this.toolChest.create(orgId, user.userId, body as never);
  }

  @Delete(":itemId")
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string
  ) {
    await this.toolChest.remove(orgId, itemId, user.userId);
  }
}
