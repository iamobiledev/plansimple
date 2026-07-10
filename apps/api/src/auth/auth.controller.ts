import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  HttpCode,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { loginSchema, registerSchema } from "@plansimple/shared";
import { AuthService } from "./auth.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentUser, Public, type AuthUser } from "../common/auth.decorators";
import { JwtAuthGuard } from "./jwt-auth.guard";

const REFRESH_COOKIE = "ps_refresh";

@Controller("auth")
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/auth",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  @Public()
  @Post("register")
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: unknown,
    @Res({ passthrough: true }) res: Response
  ) {
    const tokens = await this.auth.register(body as never);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, tokenType: tokens.tokenType };
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: unknown,
    @Res({ passthrough: true }) res: Response
  ) {
    const tokens = await this.auth.login(body as never);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, tokenType: tokens.tokenType };
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) || undefined;
    if (!token) return { error: "missing_refresh" };
    const tokens = await this.auth.refresh(token);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, tokenType: tokens.tokenType };
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }
}
