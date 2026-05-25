-- Notificaciones in-app por rol
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  -- brutos_ready | deliverable_sent | review_rejected | task_assigned | task_unblocked
  title       text NOT NULL,
  body        text,
  task_id     uuid REFERENCES content_tasks(id) ON DELETE SET NULL,
  client_name text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve sus propias notificaciones
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- El service role puede insertar notificaciones para cualquier usuario
CREATE POLICY "notifications_service_insert" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;
