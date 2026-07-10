import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { CreateOrgInput, InviteUserInput, AcceptInviteInput, Role } from "@plansimple/shared";
import * as bcrypt from "bcryptjs";
import * as nodemailer from "nodemailer";
import { DatabaseService } from "../db/database.service";
import {
  organizations,
  memberships,
  invitations,
  users,
  auditLog,
} from "../db/schema";

@Injectable()
export class OrgsService {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.get("SMTP_HOST") || "localhost",
      port: Number(config.get("SMTP_PORT") || 1025),
      secure: false,
    });
  }

  async create(userId: string, input: CreateOrgInput) {
    return this.db.withBypass(async (db) => {
      const existing = await db.query.organizations.findFirst({
        where: eq(organizations.slug, input.slug),
      });
      if (existing) throw new ConflictException("Slug already taken");

      const [org] = await db
        .insert(organizations)
        .values({ name: input.name, slug: input.slug })
        .returning();
      if (!org) throw new ConflictException("Could not create organization");

      await db.insert(memberships).values({
        organizationId: org.id,
        userId,
        role: "owner",
      });

      await db.insert(auditLog).values({
        organizationId: org.id,
        actorId: userId,
        action: "organization.create",
        entityType: "organization",
        entityId: org.id,
        after: { name: org.name, slug: org.slug },
      });

      return org;
    });
  }

  async listForUser(userId: string) {
    return this.db.withBypass(async (db) => {
      return db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          role: memberships.role,
          createdAt: organizations.createdAt,
        })
        .from(memberships)
        .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
        .where(eq(memberships.userId, userId));
    });
  }

  async getMembership(organizationId: string, userId: string) {
    return this.db.withBypass(async (db) => {
      return db.query.memberships.findFirst({
        where: and(
          eq(memberships.organizationId, organizationId),
          eq(memberships.userId, userId)
        ),
      });
    });
  }

  async requireRole(organizationId: string, userId: string, allowed: Role[]) {
    const m = await this.getMembership(organizationId, userId);
    if (!m || !allowed.includes(m.role as Role)) {
      throw new ForbiddenException("Insufficient permissions");
    }
    return m;
  }

  async invite(organizationId: string, actorId: string, input: InviteUserInput) {
    await this.requireRole(organizationId, actorId, ["owner", "admin"]);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await this.db.withTenant(organizationId, actorId, async (db) => {
      const [row] = await db
        .insert(invitations)
        .values({
          organizationId,
          email: input.email.toLowerCase(),
          role: input.role,
          token,
          invitedBy: actorId,
          expiresAt,
        })
        .returning();
      return row!;
    });

    const webUrl = this.config.get("PUBLIC_WEB_URL") || "http://localhost:5173";
    const acceptUrl = `${webUrl}/accept-invite?token=${token}`;
    try {
      await this.transporter.sendMail({
        from: this.config.get("SMTP_FROM") || "PlanSimple <noreply@plansimple.local>",
        to: input.email,
        subject: "You're invited to PlanSimple",
        text: `You've been invited to join an organization on PlanSimple.\n\nAccept: ${acceptUrl}\n`,
        html: `<p>You've been invited to join an organization on <strong>PlanSimple</strong>.</p><p><a href="${acceptUrl}">Accept invitation</a></p>`,
      });
    } catch {
      // Mailpit may be down in unit tests; invitation still created.
    }

    return { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt };
  }

  async acceptInvite(input: AcceptInviteInput) {
    return this.db.withBypass(async (db) => {
      const invite = await db.query.invitations.findFirst({
        where: eq(invitations.token, input.token),
      });
      if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
        throw new BadRequestException("Invalid or expired invitation");
      }

      let user = await db.query.users.findFirst({
        where: eq(users.email, invite.email),
      });

      if (!user) {
        if (!input.password) {
          throw new BadRequestException("Password required to create account");
        }
        const passwordHash = await bcrypt.hash(input.password, 12);
        const [created] = await db
          .insert(users)
          .values({
            email: invite.email,
            passwordHash,
            name: input.name ?? null,
          })
          .returning();
        user = created!;
      }

      const existing = await db.query.memberships.findFirst({
        where: and(
          eq(memberships.organizationId, invite.organizationId),
          eq(memberships.userId, user.id)
        ),
      });
      if (!existing) {
        await db.insert(memberships).values({
          organizationId: invite.organizationId,
          userId: user.id,
          role: invite.role,
        });
      }

      await db
        .update(invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(invitations.id, invite.id));

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, invite.organizationId),
      });

      return {
        organization: org,
        user: { id: user.id, email: user.email, name: user.name },
        role: invite.role,
      };
    });
  }

  async get(organizationId: string, userId: string) {
    await this.requireRole(organizationId, userId, [
      "owner",
      "admin",
      "editor",
      "reviewer",
      "viewer",
    ]);
    return this.db.withTenant(organizationId, userId, async (db) => {
      // organizations table itself is not RLS-scoped; fetch via bypass-safe join
      return db.query.organizations.findFirst({
        where: eq(organizations.id, organizationId),
      });
    }).then(async () => {
      return this.db.withBypass(async (db) => {
        const org = await db.query.organizations.findFirst({
          where: eq(organizations.id, organizationId),
        });
        if (!org) throw new NotFoundException();
        const members = await db
          .select({
            userId: memberships.userId,
            role: memberships.role,
            email: users.email,
            name: users.name,
          })
          .from(memberships)
          .innerJoin(users, eq(users.id, memberships.userId))
          .where(eq(memberships.organizationId, organizationId));
        return { ...org, members };
      });
    });
  }
}
