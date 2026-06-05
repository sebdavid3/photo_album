-- ============================================================
-- Photo Album - Esquema de Supabase v2
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- settings
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash TEXT NOT NULL,
  album_name TEXT NOT NULL DEFAULT 'Nuestro Album',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- photos
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
-- albums
-- ============================================================
CREATE TABLE IF NOT EXISTS albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- album_photos (junction)
-- ============================================================
CREATE TABLE IF NOT EXISTS album_photos (
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (album_id, photo_id)
);

-- ============================================================
-- letters (cartas)
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
-- Funciones
-- ============================================================
CREATE OR REPLACE FUNCTION verify_password(password_attempt TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE stored_hash TEXT;
BEGIN
  SELECT password_hash INTO stored_hash FROM public.settings WHERE id = 1;
  RETURN stored_hash = extensions.crypt(password_attempt, stored_hash);
END; $$;

CREATE OR REPLACE FUNCTION set_password(new_password TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.settings 
  SET password_hash = extensions.crypt(new_password, extensions.gen_salt('bf')), updated_at = NOW()
  WHERE id = 1;
END; $$;

-- ============================================================
-- RLS: lecturas publicas, escrituras via Edge Function (service_role)
-- ============================================================
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters ENABLE ROW LEVEL SECURITY;

-- Public reads (anon key)
CREATE POLICY "public_select" ON photos FOR SELECT USING (true);
CREATE POLICY "public_select" ON albums FOR SELECT USING (true);
CREATE POLICY "public_select" ON album_photos FOR SELECT USING (true);
CREATE POLICY "public_select" ON letters FOR SELECT USING (true);

-- Edge Function usa service_role -> bypass RLS automaticamente, no necesita policies

-- ============================================================
-- Datos iniciales
-- ============================================================
INSERT INTO settings (id, password_hash, album_name)
VALUES (1, extensions.crypt('gogui', extensions.gen_salt('bf')), 'Nuestro Album')
ON CONFLICT (id) DO NOTHING;
