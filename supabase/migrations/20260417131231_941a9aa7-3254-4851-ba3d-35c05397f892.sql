-- Habilita extensões necessárias para o agendador
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Colunas de controle de retry
ALTER TABLE public.report_executions
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamp with time zone;

-- Permitir UPDATE do dono (faltava no schema atual)
CREATE POLICY "Users can update own executions"
  ON public.report_executions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Bucket privado para PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket: arquivos ficam em <user_id>/...
CREATE POLICY "Users can view own report files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own report files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own report files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);