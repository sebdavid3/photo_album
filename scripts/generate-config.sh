#!/bin/bash
# Genera config.js con las variables de entorno de Supabase
# Usado por Vercel en el build step

SUPABASE_URL="${SUPABASE_URL:-https://TU_PROJECT_REF.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-TU_ANON_KEY}"

cat > config.js << EOF
window.APP_CONFIG = {
  SUPABASE_URL: '${SUPABASE_URL}',
  SUPABASE_ANON_KEY: '${SUPABASE_ANON_KEY}'
};
EOF

echo "config.js generado correctamente"
