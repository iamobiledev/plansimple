import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { eq, and, isNull, gt } from "drizzle-orm";
import type { LoginInput, RegisterInput } from "@plansimple/shared";
import { DatabaseService } from "../db/database.service";
import { users, refreshTokens, memberships, organizations } from "../db/schema";

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  async register(input: RegisterInput) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.db.withBypass(async (db) => {
      const existing = await db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
      });
      if (existing) throw new ConflictException("Email already registered");

      const [created] = await db
        .insert(users)
        .values({
          email: input.email.toLowerCase(),
          passwordHash,
          name: input.name ?? null,
        })
        .returning();
      if (!created) throw new ConflictException("Could not create user");
      return created;
    });
    // Issue tokens after the user transaction commits (separate connection).
    return this.issueTokens(user.id, user.email);
  }

  async login(input: LoginInput) {
    const user = await this.db.withBypass(async (db) => {
      return db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
      });
    });
    if (!user?.passwordHash) throw new UnauthorizedException("Invalid credentials");
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    return this.issueTokens(user.id, user.email);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const user = await this.db.withBypass(async (db) => {
      const row = await db.query.refreshTokens.findFirst({
        where: and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date())
        ),
      });
      if (!row) throw new UnauthorizedException("Invalid refresh token");

      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, row.id));

      const found = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
      if (!found) throw new UnauthorizedException("User not found");
      return found;
    });
    return this.issueTokens(user.id, user.email);
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    const tokenHash = this.hashToken(refreshToken);
    await this.db.withBypass(async (db) => {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.tokenHash, tokenHash));
    });
  }

  async me(userId: string) {
    return this.db.withBypass(async (db) => {
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!user) throw new UnauthorizedException();
      const membershipRows = await db
        .select({
          organizationId: memberships.organizationId,
          role: memberships.role,
          orgName: organizations.name,
          orgSlug: organizations.slug,
        })
        .from(memberships)
        .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
        .where(eq(memberships.userId, userId));

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        organizations: membershipRows.map((m) => ({
          id: m.organizationId,
          name: m.orgName,
          slug: m.orgSlug,
          role: m.role,
        })),
      };
    });
  }

  private async issueTokens(userId: string, email: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.get<string>("JWT_ACCESS_SECRET") || "dev-secret",
        expiresIn: (this.config.get<string>("JWT_ACCESS_TTL") || "15m") as `${number}m`,
      }
    );

    const refreshToken = randomBytes(48).toString("base64url");
    const days = 30;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.db.withBypass(async (db) => {
      await db.insert(refreshTokens).values({
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      });
    });

    return { accessToken, refreshToken, tokenType: "Bearer" as const };
  }
}
