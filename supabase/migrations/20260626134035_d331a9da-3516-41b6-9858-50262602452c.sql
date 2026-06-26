
CREATE TABLE public.secullum_equipamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_id INTEGER NOT NULL,
  equipamento_id INTEGER NOT NULL,
  descricao TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, bank_id, equipamento_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.secullum_equipamentos TO authenticated;
GRANT ALL ON public.secullum_equipamentos TO service_role;

ALTER TABLE public.secullum_equipamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own equipamentos"
ON public.secullum_equipamentos
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_secullum_equipamentos_user_bank
  ON public.secullum_equipamentos (user_id, bank_id);

CREATE TRIGGER update_secullum_equipamentos_updated_at
BEFORE UPDATE ON public.secullum_equipamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
