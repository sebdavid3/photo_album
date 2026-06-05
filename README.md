# Nuestro Álbum - Stardew Valley Theme

Álbum de fotos con temática de Stardew Valley para compartir recuerdos con tu persona especial.

## Características

- **Galería de fotos** - Sube imágenes con título y descripción
- **Cartas** - Escribe cartas tipo blog y sube PDFs de cartas a mano o dibujos
- **Estética retro** - Diseño pixel-art del menú del juego Stardew Valley
- **Protegido con contraseña** - Solo tú y tu novia pueden acceder
- **Listo para crecer** - Tabs ocultas para futuras funcionalidades

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | HTML + CSS + Vanilla JS (estética retro) |
| Backend | Supabase (DB, Storage, Edge Functions) |
| Despliegue | Vercel |

## Estructura del proyecto

```
photo_album/
├── index.html              # App principal (login + tabs)
├── style.css               # Estilos (template SV + propios)
├── script.js               # Lógica (auth, CRUD, UI)
├── assets/                 # Assets del tema (fuentes, iconos, bordes)
├── supabase/
│   ├── migrations/
│   │   └── 001_schema.sql  # Esquema de base de datos
│   └── functions/
│       └── api/
│           └── index.ts    # Edge Function (API protegida)
├── SUPABASE_SETUP.md       # Guía de configuración de Supabase
├── vercel.json             # Config de despliegue
└── README.md               # Este archivo
```

## Configuración rápida

1. **Crea un proyecto en Supabase** → [supabase.com](https://supabase.com)
2. **Sigue la guía** → [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
3. **Configura las credenciales** en `script.js` (SUPABASE_URL, SUPABASE_ANON_KEY, API_URL)
4. **Despliega en Vercel** → Conecta el repo y listo

## Tabs del álbum

| Tab | Icono | Propósito | Estado |
|-----|-------|-----------|--------|
| Inventory | Mochila | Galería de fotos | Activo |
| Skills | Avatar | Subir nueva foto | Activo |
| Socials | Corazón | Cartas de amor | Activo |
| Map | Mapa | Lugares especiales | Futuro v2 |
| Crafting | Herramienta | Colecciones/álbumes | Futuro v2 |
| Collection | Bolsa | Favoritos | Futuro v2 |
| Options | Consola | Configuración | Activo |
| Exit | Cerrar | Salir del álbum | Activo |

## Sobre el Settings

Además de cambiar la contraseña y el nombre del álbum, en el futuro se podría agregar:
- Toggle de tema (día/noche/estaciones como en el juego)
- Exportar datos (descargar todas las fotos y cartas)
- Modo presentación (slideshow automático)
- Estadísticas del álbum ("Has subido X fotos en Y días")
