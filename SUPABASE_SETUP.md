# Guía de Configuración de Supabase

## 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta (o inicia sesión)
2. Haz clic en **"New project"**
3. Elige la organización, nombre del proyecto (`photo-album`) y una contraseña segura para la DB
4. Elige la región más cercana a ti
5. Espera a que el proyecto se cree (~2 minutos)

## 2. Ejecutar la migración SQL

1. En el dashboard de Supabase, ve a **SQL Editor** en el menú lateral
2. Haz clic en **"New query"**
3. Copia TODO el contenido de `supabase/migrations/001_schema.sql`
4. Pégalo en el editor y haz clic en **"Run"**
5. Verifica que no haya errores

Esto creará:
- Tablas: `settings`, `photos`, `letters`
- Funciones SQL: `verify_password`, `set_password`
- Contraseña por defecto: `gogui`
- Políticas RLS para seguridad

## 3. Crear buckets de Storage

1. En el dashboard, ve a **Storage** en el menú lateral
2. Haz clic en **"New bucket"**
3. Crea un bucket llamado `photos`:
   - Nombre: `photos`
   - Marca "Public bucket" (necesario para mostrar las imágenes)
   - Haz clic en "Save"
4. Crea otro bucket llamado `letters`:
   - Nombre: `letters`
   - Marca "Public bucket" (necesario para descargar PDFs)
   - Haz clic en "Save"

### Políticas de Storage

Para cada bucket (`photos` y `letters`), configura estas políticas:

1. Ve al bucket → **Policies** tab
2. Crea estas políticas (para ambos buckets):

**Política de SELECT (lectura pública):**
- Nombre: `Public read access`
- Operación: `SELECT`
- Rol: `anon`
- Política: `true`

**Política de INSERT (subida):**
- Nombre: `Allow uploads`
- Operación: `INSERT`
- Rol: `anon`
- Política: `true`

**Política de DELETE (solo vía API):**
- No crear esta política - los archivos solo se borran vía Edge Function

## 4. Desplegar la Edge Function

### Opción A: Usando Supabase CLI

1. Instala Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Inicia sesión:
   ```bash
   supabase login
   ```

3. Vincula tu proyecto:
   ```bash
   supabase link --project-ref <TU_PROJECT_REF>
   ```
   El project_ref lo encuentras en Settings → General → Reference ID

4. Despliega la función:
   ```bash
   supabase functions deploy api --project-ref <TU_PROJECT_REF>
   ```

### Opción B: Desde el dashboard

1. Ve a **Edge Functions** en el menú lateral
2. Haz clic en **"Create a new function"**
3. Nombre: `api`
4. Copia el contenido de `supabase/functions/api/index.ts`
5. Haz clic en **"Deploy"**

## 5. Configurar credenciales

Las credenciales NO van hardcodeadas. Se inyectan vía variables de entorno.

### Para desarrollo local

Copia `.env.example` a `.env` y ejecuta:
```bash
source .env && ./scripts/generate-config.sh
```

Esto genera `config.js` (gitignorado) con tus credenciales.

### Para Vercel (producción)

1. En el dashboard de Vercel, ve a **Settings → Environment Variables**
2. Agrega estas dos variables:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://xxxxxxxxxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Tu anon key (empieza con `eyJ...`) |

3. Redeploya. El `buildCommand` en `vercel.json` genera `config.js` automáticamente.

### Variables necesarias

- **SUPABASE_URL**: Settings → API → Project URL
- **SUPABASE_ANON_KEY**: Settings → API → anon public
- **API_URL** se genera automáticamente como `SUPABASE_URL + '/functions/v1/api'`

## 6. Verificar que todo funciona

1. Abre el proyecto localmente o despliégalo en Vercel
2. Intenta iniciar sesión con la contraseña `stardew`
3. Sube una foto de prueba
4. Crea una carta de prueba

## 7. Cambiar la contraseña por defecto

La contraseña inicial es `stardew`. Para cambiarla:

1. Abre tu álbum
2. Inicia sesión con `gogui`
3. Ve a la tab **Options** (Settings)
4. Cambia la contraseña desde ahí

O desde el SQL Editor:
```sql
SELECT set_password('tu-nueva-contraseña');
```

## 8. Desplegar en Vercel

1. Sube el proyecto a un repo de GitHub
2. Ve a [vercel.com](https://vercel.com) e importa el repo
3. Vercel detectará automáticamente que es un sitio estático
4. Haz clic en **"Deploy"**
5. ¡Listo! Tu álbum está online.
