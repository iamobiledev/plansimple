import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Public } from "../common/auth.decorators";

/**
 * Feature flags — post-Phase-2 features default off.
 * Org-scoped overrides will read `feature_flags` table later.
 */
const DEFAULT_FLAGS: Record<string, boolean> = {
  markup_engine: true, // Phase 2 enabled for local/demo; override with FEATURE_MARKUP_ENGINE=0
  realtime_sessions: true, // Phase 3 Yjs sessions; override with FEATURE_REALTIME_SESSIONS=0
  measurements: true, // Phase 4 takeoff; override with FEATURE_MEASUREMENTS=0
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

function envOverride(key: string, fallback: boolean): boolean {
  const envKey = `FEATURE_${key.toUpperCase()}`;
  const raw = process.env[envKey];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

@Controller("feature-flags")
@UseGuards(JwtAuthGuard)
export class FlagsController {
  @Public()
  @Get()
  list() {
    const flags: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(DEFAULT_FLAGS)) {
      flags[key] = envOverride(key, value);
    }
    return flags;
  }
}
