import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from "@nestjs/common";
import type { Role } from "@plansimple/shared";

export type AuthUser = {
  userId: string;
  email: string;
};

export type OrgContext = {
  organizationId: string;
  role: Role;
};

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser;
  }
);

export const CurrentOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OrgContext => {
    const req = ctx.switchToHttp().getRequest();
    return req.org as OrgContext;
  }
);
