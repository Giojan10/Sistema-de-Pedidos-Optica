-- Ejecutar UNA VEZ en el SQL Editor de Supabase (la tabla compras ya existe).
-- Permite el estado 'Cancelado' en la tabla compras.
ALTER TABLE compras DROP CONSTRAINT IF EXISTS compras_estado_check;
ALTER TABLE compras
  ADD CONSTRAINT compras_estado_check
  CHECK (estado IN ('Pendiente', 'Realizado', 'Cancelado'));
