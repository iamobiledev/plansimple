import { Injectable } from "@nestjs/common";
import { eq, and, isNull } from "drizzle-orm";
import type { CreateSessionInput } from "./sessions.types";
import { DatabaseService } from "../db/database.service";
import { collabSessions, auditLog } from "../db/schema";
import { OrgsService } from "../orgs/orgs.service";

@Injectable()
export class SessionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly orgs: OrgsService
  ) {}

  async create(
    organizationId: string,
    projectId: string,
    userId: string,
    input: CreateSessionInput
  ) {
    await this.orgs.requireRole(organizationId, userId, ["owner", "admin", "editor"]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      const [row] = await db
        .insert(collabSessions)
        .values({
          organizationId,
          projectId,
          name: input.name,
          hostId: userId,
          permissions: { markup: true, comment: true, view: true },
        })
        .returning();
      await db.insert(auditLog).values({
        organizationId,
        actorId: userId,
        action: "session.create",
        entityType: "session",
        entityId: row!.id,
        after: { name: row!.name },
      });
      return row!;
    });
  }

  async list(organizationId: string, projectId: string, userId: string) {
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
        .from(collabSessions)
        .where(
          and(
            eq(collabSessions.organizationId, organizationId),
            eq(collabSessions.projectId, projectId)
          )
        );
    });
  }

  async end(organizationId: string, sessionId: string, userId: string) {
    await this.orgs.requireRole(organizationId, userId, ["owner", "admin", "editor"]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      const [row] = await db
        .update(collabSessions)
        .set({ endedAt: new Date() })
        .where(
          and(
            eq(collabSessions.id, sessionId),
            eq(collabSessions.organizationId, organizationId),
            isNull(collabSessions.endedAt)
          )
        )
        .returning();
      return row ?? { id: sessionId, ended: true };
    });
  }
}
