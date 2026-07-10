import { Body, Controller, Param, ParseUUIDPipe, Patch, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { pointSchema } from "@plansimple/shared";
import { PagesService } from "./pages.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentUser, type AuthUser } from "../common/auth.decorators";

const calibrateSchema = z.object({
  points: z.tuple([pointSchema, pointSchema]),
  realWorldDistance: z.number().positive(),
  unit: z.enum(["ft", "m", "in", "mm"]),
});

@Controller()
@UseGuards(JwtAuthGuard)
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Patch("organizations/:orgId/pages/:pageId/calibration")
  calibrate(
    @CurrentUser() user: AuthUser,
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string,
    @Body(new ZodValidationPipe(calibrateSchema)) body: unknown
  ) {
    return this.pages.calibrate(orgId, pageId, user.userId, body as never);
  }
}
