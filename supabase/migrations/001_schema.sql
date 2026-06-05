-- ============================================================
-- Photo Album - Esquema de Supabase
-- Ejecutar en SQL Editor: https://supabase.com/dashboard
-- ============================================================

-- Habilitar pgcrypto para hashing de contraseñas
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- Tabla: settings
-- Configuración global del álbum
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash TEXT NOT NULL,
  album_name TEXT NOT NULL DEFAULT 'Nuestro Album',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Tabla: photos
-- Fotos del álbum con título y descripción
-- ============================================================
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Tabla: letters
-- Cartas de amor con contenido y PDF opcional
-- ============================================================
CREATE TABLE IF NOT EXISTS letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  pdf_url TEXT,
  pdf_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Funciones auxiliares
-- ============================================================

-- Verifica una contraseña contra el hash almacenado
CREATE OR REPLACE FUNCTION verify_password(password_attempt TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT password_hash INTO stored_hash FROM settings WHERE id = 1;
  RETURN stored_hash = extensions.crypt(password_attempt, stored_hash);
END;
$$;

-- Cambia la contraseña (genera nuevo hash)
CREATE OR REPLACE FUNCTION set_password(new_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE settings 
  SET password_hash = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = NOW()
  WHERE id = 1;
END;
$$;

-- ============================================================
-- Row Level Security (RLS)
-- Solo el service_role (Edge Function) puede acceder
-- El frontend NUNCA expone la service_role key
-- ============================================================
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters ENABLE ROW LEVEL SECURITY;

-- Políticas: service_role tiene acceso total
CREATE POLICY "service_role_all" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON letters FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Datos iniciales
-- Contraseña por defecto: stardew
-- ============================================================
INSERT INTO settings (id, password_hash, album_name)
VALUES (1, extensions.crypt('gogui', extensions.gen_salt('bf')), 'Nuestro Album')
ON CONFLICT (id) DO NOTHING;
