# Gastos — PWA personal de administración de gastos

PWA privada de un solo usuario para registrar gastos en iPhone (Safari), con ingesta automática desde Atajos de iOS y Web Push nativo.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 4 (`darkMode` vía `prefers-color-scheme`)
- Supabase (Postgres, Auth con Apple, RLS)
- PWA (`@ducanh2912/next-pwa` + service worker custom para push)
- Web Push con claves VAPID (`web-push`)
- Deploy en Vercel

## Requisitos

- Node.js 20+
- Proyecto en [Supabase](https://supabase.com)
- Cuenta Apple Developer (para Sign in with Apple en Supabase)

## Variables de entorno

Copiá `.env.example` a `.env.local` y completá los valores:

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima (cliente + API con sesión) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor (rutas `/api/ingest/*`) |
| `INGEST_SECRET` | Bearer token para Atajos / email |
| `INGEST_USER_ID` | UUID de tu usuario en `auth.users` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Misma clave pública VAPID (cliente) |
| `VAPID_SUBJECT` | Opcional, p. ej. `mailto:tu@email.com` |

## Local

```bash
npm install
node scripts/generate-icons.mjs
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## Migraciones Supabase

1. Instalá la CLI de Supabase o usá el SQL Editor del dashboard.
2. Aplicá el archivo:

   `supabase/migrations/20260326120000_initial_schema.sql`

3. En **Authentication → Providers**, activá **Apple** y configurá redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://tu-dominio.vercel.app/auth/callback`

4. Tras el primer login, copiá tu `user id` desde **Authentication → Users** y ponelo en `INGEST_USER_ID`.

El trigger `on_auth_user_created_seed_categories` crea 8 categorías por defecto al registrarse.

## Claves VAPID

```bash
npx web-push generate-vapid-keys
```

Pegá la clave pública en `VAPID_PUBLIC_KEY` y `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, y la privada en `VAPID_PRIVATE_KEY`.

## Atajos de iOS (ingesta)

POST a `https://tu-dominio.vercel.app/api/ingest/shortcut`

Headers:

```
Authorization: Bearer TU_INGEST_SECRET
Content-Type: application/json
```

Body JSON:

```json
{
  "amount": 1500,
  "merchant": "Supermercado",
  "card_name": "Visa",
  "occurred_at": "2026-03-26T12:00:00.000Z"
}
```

`occurred_at` es opcional. También existe `/api/ingest/email` con el mismo contrato.

## Instalar en iPhone

1. Desplegá en Vercel (o usá un túnel HTTPS para pruebas).
2. En **Safari**, abrí la URL de la app.
3. Tocá **Compartir** → **Agregar a pantalla de inicio**.
4. Abrí la app desde el ícono en la pantalla de inicio (modo standalone).
5. En **Ajustes** de la app, tocá **Activar push** y aceptá el permiso cuando iOS lo pida.

> Web Push en iOS requiere PWA instalada en pantalla de inicio y iOS 16.4+.

## Deploy en Vercel

1. Conectá el repo de GitHub.
2. Agregá las variables de entorno del `.env.example`.
3. Deploy. El service worker se genera en `next build` (deshabilitado en `dev`).

## API (resumen)

| Método | Ruta | Auth |
|--------|------|------|
| POST/GET | `/api/transactions` | Sesión Supabase |
| PATCH/DELETE | `/api/transactions/[id]` | Sesión |
| GET | `/api/budgets/summary?month=YYYY-MM` | Sesión |
| POST | `/api/push/subscribe`, `/api/push/unsubscribe` | Sesión |
| GET | `/api/export/csv` | Sesión |
| POST | `/api/ingest/shortcut`, `/api/ingest/email` | Bearer `INGEST_SECRET` |

## Extras incluidos

- Exportación CSV (`/api/export/csv` y enlace en Ajustes)
- Estados vacíos en inicio, movimientos y categorías
- Seed de 8 categorías al crear usuario
- Cola offline en `localStorage` si falla el POST al agregar un gasto

## Scripts

- `npm run dev` — desarrollo
- `npm run build` — producción + PWA
- `npm run start` — servidor de producción
- `node scripts/generate-icons.mjs` — iconos PWA
