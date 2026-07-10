import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Public } from "../common/auth.decorators";

/**
 * Feature flags — post-Phase-2 features default off.
 * Org-scoped overrides will read `feature_flags` table later.
 */
const DEFAULT_FLAGS: Record<string, boolean> = {
  markup_engine: false,
  realtime_sessions: false,
  measurements: false,
  revision_compare: false,
  ai_sheet_indexing: false,
  ai_nl_search: false,
  ai_diff_narration: false,
  ai_takeoff: false,
  ai_rfi_draft: false,
  ai_session_summary: false,
  workflows_rfi: false,
  billing: false,
};

@Controller("feature-flags")
@UseGuards(JwtAuthGuard)
export class FlagsController {
  @Public()
  @Get()
  list() {
    return DEFAULT_FLAGS;
  }
}
