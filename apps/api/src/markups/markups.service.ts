import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { BulkStatusInput, CreateMarkupInput, UpdateMarkupInput } from "@plansimple/shared";
import { DatabaseService } from "../db/database.service";
import { auditLog, markups } from "../db/schema";
import { OrgsService } from "../orgs/orgs.service";

const READ_ROLES = ["owner", "admin", "editor", "reviewer", "viewer"] as const;
const WRITE_ROLES = ["owner", "admin", "editor"] as const;
const STATUS_ROLES = ["owner", "admin", "editor", "reviewer"] as const;
const DELETE_OWN_ROLES = ["owner", "admin", "editor", "reviewer"] as const;

@Injectable()
export class MarkupsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly orgs: OrgsService
  ) {}

  async listByPage(organizationId: string, pageId: string, userId: string) {
    await this.orgs.requireRole(organizationId, userId, [...READ_ROLES]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      return db
        .select()
        .from(markups)
        .where(and(eq(markups.organizationId, organizationId), eq(markups.pageId, pageId)))
        .orderBy(desc(markups.createdAt));
    });
  }

  async listByRevision(organizationId: string, revisionId: string, userId: string) {
    await this.orgs.requireRole(organizationId, userId, [...READ_ROLES]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      return db
        .select()
        .from(markups)
        .where(and(eq(markups.organizationId, organizationId), eq(markups.revisionId, revisionId)))
        .orderBy(desc(markups.createdAt));
    });
  }

  async create(organizationId: string, userId: string, input: CreateMarkupInput) {
    await this.orgs.requireRole(organizationId, userId, [...WRITE_ROLES]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      const [markup] = await db
        .insert(markups)
        .values({
          organizationId,
          pageId: input.pageId,
          revisionId: input.revisionId,
          authorId: userId,
          type: input.type,
          geometry: input.geometry,
          style: input.style ?? {},
          status: input.status ?? "open",
          subject: input.subject ?? null,
          layer: input.layer ?? "Default",
          measurement: input.measurement ?? null,
        })
        .returning();

      await db.insert(auditLog).values({
        organizationId,
        actorId: userId,
        action: "markup.create",
        entityType: "markup",
        entityId: markup!.id,
        after: markup,
      });

      return markup!;
    });
  }

  async update(organizationId: string, markupId: string, userId: string, input: UpdateMarkupInput) {
    const keys = Object.keys(input);
    if (keys.length === 0) {
      throw new BadRequestException("No markup fields provided");
    }

    const statusOnly = keys.length === 1 && keys[0] === "status";
    await this.orgs.requireRole(organizationId, userId, [
      ...(statusOnly ? STATUS_ROLES : WRITE_ROLES),
    ]);

    return this.db.withTenant(organizationId, userId, async (db) => {
      const existing = await db.query.markups.findFirst({
        where: and(eq(markups.id, markupId), eq(markups.organizationId, organizationId)),
      });
      if (!existing) throw new NotFoundException("Markup not found");

      const [updated] = await db
        .update(markups)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(markups.id, markupId))
        .returning();

      await db.insert(auditLog).values({
        organizationId,
        actorId: userId,
        action: "markup.update",
        entityType: "markup",
        entityId: markupId,
        before: existing,
        after: updated,
      });

      return updated!;
    });
  }

  async remove(organizationId: string, markupId: string, userId: string) {
    const membership = await this.orgs.requireRole(organizationId, userId, [...DELETE_OWN_ROLES]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      const existing = await db.query.markups.findFirst({
        where: and(eq(markups.id, markupId), eq(markups.organizationId, organizationId)),
      });
      if (!existing) throw new NotFoundException("Markup not found");

      const canDeleteAny = membership.role === "owner" || membership.role === "admin";
      const isAuthor = existing.authorId === userId;
      if (!canDeleteAny && !isAuthor) {
        throw new ForbiddenException("Only owners, admins, or the markup author can delete");
      }

      await db.delete(markups).where(eq(markups.id, markupId));
      await db.insert(auditLog).values({
        organizationId,
        actorId: userId,
        action: "markup.delete",
        entityType: "markup",
        entityId: markupId,
        before: existing,
      });
    });
  }

  async bulkStatus(organizationId: string, userId: string, input: BulkStatusInput) {
    await this.orgs.requireRole(organizationId, userId, [...STATUS_ROLES]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      const existing = await db
        .select()
        .from(markups)
        .where(and(eq(markups.organizationId, organizationId), inArray(markups.id, input.ids)));

      const updated = await db
        .update(markups)
        .set({ status: input.status, updatedAt: new Date() })
        .where(and(eq(markups.organizationId, organizationId), inArray(markups.id, input.ids)))
        .returning();

      await db.insert(auditLog).values({
        organizationId,
        actorId: userId,
        action: "markup.bulk_status",
        entityType: "markup",
        entityId: null,
        before: { ids: existing.map((m) => m.id), statuses: existing.map((m) => m.status) },
        after: { ids: updated.map((m) => m.id), status: input.status },
      });

      return { updated: updated.length, markups: updated };
    });
  }
}
