# LaPesadilla Finanzas — asistente financiero personal

PWA multiusuario para administrar cuentas, gastos, ingresos, transferencias,
tarjetas, metas y pagos recurrentes desde iPhone. Incluye registro rápido,
parser local en español, importación CSV y automatización con Siri.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 4 (`darkMode` vía `prefers-color-scheme`)
- Supabase (Postgres, acceso sin contraseña por email, RLS)
- PWA (`@ducanh2912/next-pwa` + service worker custom para push)
- Web Push con claves VAPID (`web-push`)
- Deploy en Vercel

## Requisitos

- Node.js 20+
- Proyecto en [Supabase](https://supabase.com)

## Variables de entorno

Copiá `.env.example` a `.env.local` y completá los valores:

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública `sb_publishable_...` (recomendada) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Alternativa legacy a la publishable key |
| `SUPABASE_SECRET_KEY` | Clave secreta `sb_secret_...`, solo servidor (recomendada) |
| `SUPABASE_SERVICE_ROLE_KEY` | Alternativa legacy a la secret key |
| `INGEST_SECRET` | Bearer token para Atajos / email |
| `INGEST_USER_ID` | UUID de tu usuario en `auth.users` |
| `APP_BASE_URL` | URL pública usada en enlaces de confirmación |
| `AUTOMATION_TOKEN_PEPPER` | Secreto aleatorio para reforzar hashes de tokens |
| `AI_API_KEY`, `AI_MODEL`, `AI_PROVIDER` | Opcionales; la app funciona sin IA |
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

   Si ya creaste las tablas con el SQL original compartido, aplicá solamente:

   `supabase/migrations/20260726000000_align_existing_schema.sql`

3. En **Authentication → URL Configuration**, configurá la URL del sitio y agregá:
   - `http://localhost:3000/auth/callback`
   - `https://tu-dominio.vercel.app/auth/callback`

4. En **Authentication → Providers**, mantené habilitado **Email**. La app usa
   correo y contraseña, sin depender de enlaces mágicos.

5. Tras el primer login, copiá tu `user id` desde **Authentication → Users** y ponelo en `INGEST_USER_ID`.

El trigger `on_auth_user_created_seed_categories` crea 8 categorías por defecto al registrarse.

## Claves VAPID

```bash
npx web-push generate-vapid-keys
```

Pegá la clave pública en `VAPID_PUBLIC_KEY` y `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, y la privada en `VAPID_PRIVATE_KEY`.

## Siri y Apple Shortcuts

1. Abrí **Ajustes → Siri y automatizaciones** en la app.
2. Generá y copiá un token; se muestra completo una sola vez.
3. En Atajos, creá “Anotá un gasto” con la acción **Dictar texto**.
4. Agregá **Obtener contenido de URL**, método `POST`.
5. Usá `https://la-pesadilla-finanzas.vercel.app/api/parse-transaction`.
6. Agregá `Authorization: Bearer TU_TOKEN` y `Content-Type: application/json`.
7. Enviá:

```json
{
  "text": "[Texto dictado]",
  "source": "siri",
  "timezone": "America/Montevideo",
  "idempotencyKey": "[Identificador único]"
}
```

8. Mostrá o pronunciá el campo `message`. Si llega `confirmationUrl`, abrilo
   para revisar los datos ambiguos.

El token se almacena como hash, es revocable y no usa la cookie de la app.

## Atajos de iOS (endpoint antiguo)

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
| POST | `/api/transactions/quick` | Sesión o token |
| POST | `/api/parse-transaction` | Sesión o token |
| GET/POST | `/api/accounts`, `/api/cards`, `/api/goals`, `/api/recurring` | Sesión |
| GET/POST/DELETE | `/api/automations/tokens` | Sesión |
| GET/POST | `/api/automations/test` | Token |
| POST | `/api/import/csv` | Sesión |
| GET | `/api/budgets/summary?month=YYYY-MM` | Sesión |
| POST | `/api/push/subscribe`, `/api/push/unsubscribe` | Sesión |
| GET | `/api/export/csv` | Sesión |
| POST | `/api/ingest/shortcut`, `/api/ingest/email` | Bearer `INGEST_SECRET` |

## Extras incluidos

- Exportación CSV (`/api/export/csv` y enlace en Ajustes)
- Estados vacíos en inicio, movimientos y categorías
- Seed de 8 categorías al crear usuario
- Cola offline en `localStorage` si falla el POST al agregar un gasto
- Confirmaciones pendientes para frases ambiguas
- Exportación completa JSON sin tokens, hashes ni secretos

## Scripts

- `npm run dev` — desarrollo
- `npm run lint` — análisis estático
- `npm run typecheck` — comprobación TypeScript
- `npm test` — pruebas del parser y cálculos financieros
- `npm run build` — producción + PWA
- `npm run start` — servidor de producción
- `node scripts/generate-icons.mjs` — iconos PWA
