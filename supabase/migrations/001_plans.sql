CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Plan sans titre',
  type text NOT NULL DEFAULT '2d' CHECK (type IN ('2d', '3d', 'scan')),
  svg_data text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_own" ON plans
  FOR ALL USING (auth.uid() = user_id);
