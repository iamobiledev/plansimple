import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { and, eq, or } from "drizzle-orm";
import type { CreateToolChestItemInput } from "@plansimple/shared";
import { DatabaseService } from "../db/database.service";
import { toolChestItems, auditLog } from "../db/schema";
import { OrgsService } from "../orgs/orgs.service";

@Injectable()
export class ToolChestService {
  constructor(
    private readonly db: DatabaseService,
    private readonly orgs: OrgsService
  ) {}

  async list(organizationId: string, userId: string) {
    await this.orgs.requireRole(organizationId, userId, [
      "owner",
      "admin",
      "editor",
      "reviewer",
      "viewer",
    ]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      return db
        .select()
        .from(toolChestItems)
        .where(
          and(
            eq(toolChestItems.organizationId, organizationId),
            or(eq(toolChestItems.shared, true), eq(toolChestItems.ownerUserId, userId))
          )
        );
    });
  }

  async create(organizationId: string, userId: string, input: CreateToolChestItemInput) {
    await this.orgs.requireRole(organizationId, userId, ["owner", "admin", "editor"]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      const [row] = await db
        .insert(toolChestItems)
        .values({
          organizationId,
          ownerUserId: userId,
          name: input.name,
          shared: input.shared ?? false,
          markupType: input.markupType,
          style: input.style ?? {},
          defaultSubject: input.defaultSubject ?? null,
          defaultGeometry: input.defaultGeometry ?? null,
        })
        .returning();
      await db.insert(auditLog).values({
        organizationId,
        actorId: userId,
        action: "tool_chest.create",
        entityType: "tool_chest_item",
        entityId: row!.id,
        after: { name: row!.name, markupType: row!.markupType },
      });
      return row!;
    });
  }

  async remove(organizationId: string, itemId: string, userId: string) {
    await this.orgs.requireRole(organizationId, userId, ["owner", "admin", "editor"]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      const rows = await db
        .select()
        .from(toolChestItems)
        .where(
          and(eq(toolChestItems.id, itemId), eq(toolChestItems.organizationId, organizationId))
        );
      const existing = rows[0];
      if (!existing) throw new NotFoundException();
      const membership = await this.orgs.getMembership(organizationId, userId);
      const isAdmin = membership && ["owner", "admin"].includes(membership.role);
      if (!isAdmin && existing.ownerUserId !== userId) {
        throw new ForbiddenException("Cannot delete another user's tool");
      }
      await db.delete(toolChestItems).where(eq(toolChestItems.id, itemId));
      return { ok: true };
    });
  }
}
