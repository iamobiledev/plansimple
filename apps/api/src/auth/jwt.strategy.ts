import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import type { AuthUser } from "../common/auth.decorators";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_ACCESS_SECRET") || "dev-secret",
    });
  }

  validate(payload: { sub: string; email: string }): AuthUser {
    return { userId: payload.sub, email: payload.email };
  }
}
