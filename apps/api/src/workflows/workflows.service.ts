import { Injectable } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { DatabaseService } from "../db/database.service";
import { rfis, submittals, punchItems, auditLog } from "../db/schema";
import { OrgsService } from "../orgs/orgs.service";

type WorkflowInput = {
  number: string;
  title: string;
  body?: string;
  assigneeId?: string;
  dueDate?: string;
  linkedMarkupIds?: string[];
};

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly orgs: OrgsService
  ) {}

  private async assertWrite(orgId: string, userId: string) {
    await this.orgs.requireRole(orgId, userId, ["owner", "admin", "editor"]);
  }

  private async assertRead(orgId: string, userId: string) {
    await this.orgs.requireRole(orgId, userId, [
      "owner",
      "admin",
      "editor",
      "reviewer",
      "viewer",
    ]);
  }

  async listRfis(orgId: string, projectId: string, userId: string) {
    await this.assertRead(orgId, userId);
    return this.db.withTenant(orgId, userId, async (db) =>
      db
        .select()
        .from(rfis)
        .where(and(eq(rfis.organizationId, orgId), eq(rfis.projectId, projectId)))
    );
  }

  async createRfi(orgId: string, projectId: string, userId: string, input: WorkflowInput) {
    await this.assertWrite(orgId, userId);
    return this.db.withTenant(orgId, userId, async (db) => {
      const [row] = await db
        .insert(rfis)
        .values({
          organizationId: orgId,
          projectId,
          number: input.number,
          title: input.title,
          body: input.body ?? null,
          assigneeId: input.assigneeId ?? null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          linkedMarkupIds: input.linkedMarkupIds ?? [],
          createdBy: userId,
        })
        .returning();
      await db.insert(auditLog).values({
        organizationId: orgId,
        actorId: userId,
        action: "rfi.create",
        entityType: "rfi",
        entityId: row!.id,
        after: { number: row!.number, title: row!.title },
      });
      return row!;
    });
  }

  async listSubmittals(orgId: string, projectId: string, userId: string) {
    await this.assertRead(orgId, userId);
    return this.db.withTenant(orgId, userId, async (db) =>
      db
        .select()
        .from(submittals)
        .where(and(eq(submittals.organizationId, orgId), eq(submittals.projectId, projectId)))
    );
  }

  async createSubmittal(orgId: string, projectId: string, userId: string, input: WorkflowInput) {
    await this.assertWrite(orgId, userId);
    return this.db.withTenant(orgId, userId, async (db) => {
      const [row] = await db
        .insert(submittals)
        .values({
          organizationId: orgId,
          projectId,
          number: input.number,
          title: input.title,
          body: input.body ?? null,
          assigneeId: input.assigneeId ?? null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          linkedMarkupIds: input.linkedMarkupIds ?? [],
          createdBy: userId,
        })
        .returning();
      return row!;
    });
  }

  async listPunch(orgId: string, projectId: string, userId: string) {
    await this.assertRead(orgId, userId);
    return this.db.withTenant(orgId, userId, async (db) =>
      db
        .select()
        .from(punchItems)
        .where(and(eq(punchItems.organizationId, orgId), eq(punchItems.projectId, projectId)))
    );
  }

  async createPunch(orgId: string, projectId: string, userId: string, input: WorkflowInput) {
    await this.assertWrite(orgId, userId);
    return this.db.withTenant(orgId, userId, async (db) => {
      const [row] = await db
        .insert(punchItems)
        .values({
          organizationId: orgId,
          projectId,
          number: input.number,
          title: input.title,
          body: input.body ?? null,
          assigneeId: input.assigneeId ?? null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          linkedMarkupIds: input.linkedMarkupIds ?? [],
          createdBy: userId,
        })
        .returning();
      return row!;
    });
  }
}
