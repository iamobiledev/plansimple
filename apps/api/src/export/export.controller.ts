import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { ExportService } from "./export.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, type AuthUser } from "../common/auth.decorators";

@Controller()
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Get("organizations/:orgId/documents/:documentId/export")
  async exportDoc(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Query("mode") mode: string | undefined,
    @Res() res: Response
  ) {
    const resolved =
      mode === "original" || mode === "flattened" || mode === "annotations"
        ? mode
        : "annotations";
    const result = await this.exports.exportDocument(
      orgId,
      documentId,
      user.userId,
      resolved
    );
    res.setHeader("Content-Type", result.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename.replace(/"/g, "")}"`
    );
    res.send(Buffer.from(result.bytes));
  }
}
