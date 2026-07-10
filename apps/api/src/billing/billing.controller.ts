import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, Public, type AuthUser } from "../common/auth.decorators";
import { OrgsService } from "../orgs/orgs.service";

/**
 * Stripe billing stub — viewers free forever; editors billed per seat.
 * Replace with Stripe Checkout / Customer Portal when STRIPE_SECRET_KEY is set.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly orgs: OrgsService) {}

  @Get("organizations/:orgId/billing")
  async status(@CurrentUser() user: AuthUser, @Param("orgId", ParseUUIDPipe) orgId: string) {
    await this.orgs.requireRole(orgId, user.userId, ["owner", "admin"]);
    const org = await this.orgs.get(orgId, user.userId);
    const members = org?.members ?? [];
    const editors = members.filter((m) =>
      ["owner", "admin", "editor", "reviewer"].includes(m.role)
    ).length;
    const viewers = members.filter((m) => m.role === "viewer").length;
    return {
      plan: "plansimple_seats",
      currency: "usd",
      editorSeatPriceMonthly: 49,
      editorSeats: editors,
      viewerSeats: viewers,
      viewerSeatsFree: true,
      estimatedMonthly: editors * 49,
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      portalUrl: null,
      note: "Wire Stripe Checkout when STRIPE_SECRET_KEY is present.",
    };
  }

  @Post("organizations/:orgId/billing/checkout-session")
  async checkout(@CurrentUser() user: AuthUser, @Param("orgId", ParseUUIDPipe) orgId: string) {
    await this.orgs.requireRole(orgId, user.userId, ["owner", "admin"]);
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        ok: false,
        stub: true,
        message: "Stripe not configured. Set STRIPE_SECRET_KEY to enable checkout.",
      };
    }
    return {
      ok: true,
      stub: true,
      message: "Stripe SDK integration placeholder — create Checkout Session here.",
    };
  }
}

@Controller("auth/sso")
export class SsoController {
  @Public()
  @Get("oidc/login")
  oidcLogin() {
    return {
      stub: true,
      message: "OIDC login stub. Configure OIDC_ISSUER / CLIENT_ID / CLIENT_SECRET.",
      authorizeUrl: null,
    };
  }

  @Public()
  @Get("saml/metadata")
  samlMetadata() {
    return {
      stub: true,
      message: "SAML SP metadata stub. Configure SAML_ENTRY_POINT / CERT.",
      entityId: process.env.PUBLIC_API_URL || "http://localhost:3000",
    };
  }

  @Public()
  @Post("saml/acs")
  samlAcs(@Body() _body: unknown) {
    return { stub: true, message: "SAML ACS stub — assert and issue JWT here." };
  }
}
