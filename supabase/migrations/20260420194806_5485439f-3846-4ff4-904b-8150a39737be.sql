-- Enum para status do funcionário no link público
CREATE TYPE public.employee_email_status AS ENUM ('had_email', 'updated_via_link', 'no_email');

CREATE TABLE public.public_link_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  bank_id TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  employee_secullum_id BIGINT,
  numero_folha TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  original_email TEXT,
  current_email TEXT,
  status public.employee_email_status NOT NULL DEFAULT 'no_email',
  employee_payload JSONB,
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, bank_id, numero_folha)
);

CREATE INDEX idx_public_link_employees_owner_bank ON public.public_link_employees (owner_user_id, bank_id);
CREATE INDEX idx_public_link_employees_status ON public.public_link_employees (status);

ALTER TABLE public.public_link_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their employees"
ON public.public_link_employees
FOR SELECT
USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners insert their employees"
ON public.public_link_employees
FOR INSERT
WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Owners update their employees"
ON public.public_link_employees
FOR UPDATE
USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners delete their employees"
ON public.public_link_employees
FOR DELETE
USING (auth.uid() = owner_user_id);

CREATE TRIGGER update_public_link_employees_updated_at
BEFORE UPDATE ON public.public_link_employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();