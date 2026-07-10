import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, type AuthUser } from "../common/auth.decorators";
import { OrgsService } from "../orgs/orgs.service";
import { DocumentsService } from "../documents/documents.service";

/**
 * Project data export stub — full ZIP (PDFs + markups CSV + logs) is a selling point (no lock-in).
 * Returns a manifest describing what a complete export would include.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class ProjectExportController {
  constructor(
    private readonly orgs: OrgsService,
    private readonly documents: DocumentsService
  ) {}

  @Get("organizations/:orgId/projects/:projectId/export-manifest")
  async manifest(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string
  ) {
    await this.orgs.requireRole(orgId, user.userId, ["owner", "admin", "editor"]);
    const docs = await this.documents.list(orgId, projectId, user.userId);
    return {
      format: "plansimple-project-zip-v1",
      includes: [
        "pdfs/ (original revisions)",
        "exports/ (annotated + flattened PDFs)",
        "markups.csv",
        "rfis.csv",
        "submittals.csv",
        "punch_items.csv",
        "audit_log.jsonl",
      ],
      documents: docs.map((d) => ({
        id: d.id,
        filename: d.filename,
        pageCount: d.pageCount,
        currentRevisionId: d.currentRevisionId,
      })),
      note: "Streaming ZIP assembly can be added with archiver; per-document PDF export already available.",
    };
  }
}
