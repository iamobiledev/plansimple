import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { initiateUploadSchema, completeUploadSchema } from "@plansimple/shared";
import { DocumentsService } from "./documents.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentUser, Public, type AuthUser } from "../common/auth.decorators";
import { StorageService } from "../storage/storage.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly storage: StorageService
  ) {}

  @Post("organizations/:orgId/projects/:projectId/documents/uploads")
  initiate(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(initiateUploadSchema)) body: unknown
  ) {
    return this.documents.initiateUpload(orgId, projectId, user.userId, body as never);
  }

  @Post("organizations/:orgId/projects/:projectId/documents/upload")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 * 1024 },
    })
  )
  async uploadDirect(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file?.buffer?.length) throw new BadRequestException("file required");
    const initiated = await this.documents.initiateUpload(orgId, projectId, user.userId, {
      filename: file.originalname || "drawing.pdf",
      fileSize: file.size,
      contentType: file.mimetype || "application/pdf",
    });
    await this.storage.putObject(
      initiated.storageKey,
      file.buffer,
      file.mimetype || "application/pdf"
    );
    const completed = await this.documents.completeUpload(
      orgId,
      user.userId,
      initiated.documentId,
      initiated.revisionId
    );
    return { ...initiated, ...completed };
  }

  @Post("organizations/:orgId/documents/uploads/complete")
  complete(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body(new ZodValidationPipe(completeUploadSchema)) body: unknown
  ) {
    const b = body as { documentId: string; revisionId: string };
    return this.documents.completeUpload(orgId, user.userId, b.documentId, b.revisionId);
  }

  @Get("organizations/:orgId/projects/:projectId/documents")
  list(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string
  ) {
    return this.documents.list(orgId, projectId, user.userId);
  }

  @Get("organizations/:orgId/documents/:documentId")
  get(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string
  ) {
    return this.documents.get(orgId, documentId, user.userId);
  }

  @Get("organizations/:orgId/documents/:documentId/pages/:pageId/tiles")
  tiles(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string
  ) {
    return this.documents.getPageTiles(orgId, documentId, pageId, user.userId);
  }

  @Post("organizations/:orgId/documents/:documentId/revisions/upload")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 * 1024 },
    })
  )
  async uploadRevision(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file?.buffer?.length) throw new BadRequestException("file required");
    return this.documents.uploadRevision(orgId, documentId, user.userId, file);
  }

  @Get("organizations/:orgId/documents/:documentId/revisions")
  listRevisions(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("documentId", ParseUUIDPipe) documentId: string
  ) {
    return this.documents.listRevisions(orgId, documentId, user.userId);
  }

  @Public()
  @Post("internal/ingest/callback")
  callback(
    @Headers("x-plansimple-ingest-secret") secret: string | undefined,
    @Body() body: unknown
  ) {
    const expected = process.env.INGEST_CALLBACK_SECRET || "dev-ingest-secret";
    if (secret !== expected) {
      throw new UnauthorizedException("Invalid ingest callback secret");
    }
    return this.documents.applyIngestResult(body as never);
  }

  @Public()
  @Post("internal/diff/callback")
  diffCallback(
    @Headers("x-plansimple-ingest-secret") secret: string | undefined,
    @Body() body: unknown
  ) {
    const expected = process.env.INGEST_CALLBACK_SECRET || "dev-ingest-secret";
    if (secret !== expected) {
      throw new UnauthorizedException("Invalid ingest callback secret");
    }
    return this.documents.applyDiffResult(body as never);
  }
}
