-- Settings: banco fixo por usuário para o link público
CREATE TABLE public.public_link_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  bank_id TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.public_link_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own link settings" ON public.public_link_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own link settings" ON public.public_link_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own link settings" ON public.public_link_settings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own link settings" ON public.public_link_settings
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_public_link_settings_updated_at
  BEFORE UPDATE ON public.public_link_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Solicitações de atualização de email
CREATE TYPE public.email_update_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.email_update_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  bank_id TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  numero_folha TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  employee_secullum_id BIGINT,
  employee_payload JSONB NOT NULL,
  current_email TEXT,
  requested_email TEXT NOT NULL,
  status public.email_update_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  secullum_response JSONB,
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_update_requests_owner_status
  ON public.email_update_requests(owner_user_id, status, created_at DESC);

ALTER TABLE public.email_update_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their requests" ON public.email_update_requests
  FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Owners update their requests" ON public.email_update_requests
  FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Owners delete their requests" ON public.email_update_requests
  FOR DELETE USING (auth.uid() = owner_user_id);

CREATE TRIGGER update_email_update_requests_updated_at
  BEFORE UPDATE ON public.email_update_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();