import { Injectable } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { DatabaseService } from "../db/database.service";
import { notifications, auditLog } from "../db/schema";
import { OrgsService } from "../orgs/orgs.service";

@Injectable()
export class NotificationsService {
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
        .from(notifications)
        .where(
          and(eq(notifications.organizationId, organizationId), eq(notifications.userId, userId))
        )
        .orderBy(desc(notifications.createdAt))
        .limit(100);
    });
  }

  async markRead(organizationId: string, userId: string, id: string) {
    await this.orgs.requireRole(organizationId, userId, [
      "owner",
      "admin",
      "editor",
      "reviewer",
      "viewer",
    ]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      const [row] = await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.userId, userId),
            eq(notifications.organizationId, organizationId),
            isNull(notifications.readAt)
          )
        )
        .returning();
      return row ?? { id, read: true };
    });
  }

  async create(
    organizationId: string,
    userId: string,
    input: { kind: string; title: string; body?: string; link?: string; actorId?: string }
  ) {
    return this.db.withTenant(organizationId, input.actorId ?? null, async (db) => {
      const [row] = await db
        .insert(notifications)
        .values({
          organizationId,
          userId,
          kind: input.kind,
          title: input.title,
          body: input.body ?? null,
          link: input.link ?? null,
        })
        .returning();
      return row!;
    }, { bypassRls: true });
  }

  /** Stub daily digest payload for email workers. */
  async digestPreview(organizationId: string, userId: string) {
    const items = await this.list(organizationId, userId);
    const unread = items.filter((n) => !n.readAt);
    return {
      subject: `PlanSimple daily digest — ${unread.length} unread`,
      unreadCount: unread.length,
      items: unread.slice(0, 20).map((n) => ({ title: n.title, kind: n.kind, createdAt: n.createdAt })),
      note: "Email delivery via SMTP/Mailpit; wire cron in Phase 7 deploy.",
    };
  }

  async listAudit(organizationId: string, userId: string) {
    await this.orgs.requireRole(organizationId, userId, ["owner", "admin"]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      return db
        .select()
        .from(auditLog)
        .where(eq(auditLog.organizationId, organizationId))
        .orderBy(desc(auditLog.createdAt))
        .limit(200);
    });
  }
}
