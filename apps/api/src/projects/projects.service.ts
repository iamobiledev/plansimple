import { Injectable, NotFoundException } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import type { CreateProjectInput } from "@plansimple/shared";
import { DatabaseService } from "../db/database.service";
import { projects, auditLog } from "../db/schema";
import { OrgsService } from "../orgs/orgs.service";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly orgs: OrgsService
  ) {}

  async create(organizationId: string, userId: string, input: CreateProjectInput) {
    await this.orgs.requireRole(organizationId, userId, [
      "owner",
      "admin",
      "editor",
    ]);

    return this.db.withTenant(organizationId, userId, async (db) => {
      const [project] = await db
        .insert(projects)
        .values({
          organizationId,
          name: input.name,
          description: input.description ?? null,
          createdBy: userId,
        })
        .returning();

      await db.insert(auditLog).values({
        organizationId,
        actorId: userId,
        action: "project.create",
        entityType: "project",
        entityId: project!.id,
        after: { name: project!.name },
      });

      return project!;
    });
  }

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
        .from(projects)
        .where(eq(projects.organizationId, organizationId));
    });
  }

  async get(organizationId: string, projectId: string, userId: string) {
    await this.orgs.requireRole(organizationId, userId, [
      "owner",
      "admin",
      "editor",
      "reviewer",
      "viewer",
    ]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      const project = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)),
      });
      if (!project) throw new NotFoundException("Project not found");
      return project;
    });
  }

  async remove(organizationId: string, projectId: string, userId: string) {
    await this.orgs.requireRole(organizationId, userId, ["owner", "admin"]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      const existing = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)),
      });
      if (!existing) throw new NotFoundException("Project not found");
      await db.delete(projects).where(eq(projects.id, projectId));
      await db.insert(auditLog).values({
        organizationId,
        actorId: userId,
        action: "project.delete",
        entityType: "project",
        entityId: projectId,
        before: { name: existing.name },
      });
      return { ok: true };
    });
  }
}
