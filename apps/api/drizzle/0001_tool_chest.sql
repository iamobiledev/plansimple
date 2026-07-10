-- Tool Chest + RLS for tool_chest_items

CREATE TABLE IF NOT EXISTS tool_chest_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  shared BOOLEAN NOT NULL DEFAULT false,
  markup_type TEXT NOT NULL,
  style JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_subject TEXT,
  default_geometry JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tool_chest_items_org_idx ON tool_chest_items(organization_id);

ALTER TABLE tool_chest_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_chest_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tool_chest_items_tenant_isolation ON tool_chest_items;
CREATE POLICY tool_chest_items_tenant_isolation ON tool_chest_items
  FOR ALL
  USING (app_bypass_rls() OR organization_id = app_current_org_id())
  WITH CHECK (app_bypass_rls() OR organization_id = app_current_org_id());
