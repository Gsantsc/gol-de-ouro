-- QA VALIDATION FIX - Adicionar colunas updated_at faltantes
-- FASE 4: Validação de banco

-- Adicionar updated_at em groups
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Adicionar updated_at em tournaments
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Criar trigger para atualizar updated_at em groups
CREATE OR REPLACE FUNCTION public.update_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS groups_touch_updated_at ON public.groups;
CREATE TRIGGER groups_touch_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_groups_updated_at();

-- Criar trigger para atualizar updated_at em tournaments
CREATE OR REPLACE FUNCTION public.update_tournaments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tournaments_touch_updated_at ON public.tournaments;
CREATE TRIGGER tournaments_touch_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tournaments_updated_at();
