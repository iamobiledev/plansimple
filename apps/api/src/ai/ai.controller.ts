import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { AiService } from "./ai.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentUser, Public, type AuthUser } from "../common/auth.decorators";

const nlSearchSchema = z.object({ query: z.string().min(1).max(500) });
const pageIndexSchema = z.object({
  sheetNumber: z.string().max(64).optional(),
  sheetTitle: z.string().max(500).optional(),
  discipline: z.string().max(120).optional(),
});
const draftRfiSchema = z.object({
  markupId: z.string().uuid().optional(),
  subject: z.string().max(500).optional(),
  comments: z.array(z.string()).optional(),
});

@Controller()
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Public()
  @Get("ai/health")
  health() {
    return this.ai.health();
  }

  @Post("organizations/:orgId/documents/:documentId/ai/sheet-index")
  index(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string
  ) {
    return this.ai.indexDocumentPages(orgId, documentId, user.userId);
  }

  @Patch("organizations/:orgId/pages/:pageId/index")
  updateIndex(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string,
    @Body(new ZodValidationPipe(pageIndexSchema)) body: unknown
  ) {
    return this.ai.updatePageIndex(orgId, pageId, user.userId, body as never);
  }

  @Post("organizations/:orgId/projects/:projectId/ai/search")
  search(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(nlSearchSchema)) body: unknown
  ) {
    const b = body as { query: string };
    return this.ai.nlSearch(orgId, projectId, user.userId, b.query);
  }

  @Post("organizations/:orgId/ai/draft-rfi")
  draftRfi(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(draftRfiSchema)) body: unknown
  ) {
    return this.ai.draftRfi(orgId, user.userId, body as never);
  }
}
