# abWeb Gastro

Plataforma multi-restaurante de **abWeb solutions**: carta digital por QR, pedidos desde la mesa, chat con el camarero, app de servicio y pantalla de cocina. Un solo código y una sola base de datos para todos los restaurantes.

## Partes

| Ruta | Para quién | Idioma |
|---|---|---|
| `/r/<restaurante>/mesa/<n>?k=<clave>` | Cliente (QR de la mesa): check-in, carta con fotos y alérgenos, pedido, chat, cuenta, planes cerca | DE, EN, ES, IT, FR, TR |
| `/r/<restaurante>` | Carta sin pedir (enlace web, plan Carta) | igual |
| `/app` | Personal: mesas, pedidos, cocina, agotados, QR de las mesas (PWA) | Alemán |
| `/app/verwaltung` | Dueño o encargado: carta (platos, precios, IVA, fotos, alérgenos, idiomas), restaurante y diseño, mesas, planes cercanos | Alemán |

Pendiente (siguientes fases): alta de personal desde el panel, panel admin de abWeb para dar de alta restaurantes, reservas, valoraciones por email.

## Cómo está hecho

- **Front:** Vite + React + TypeScript, una SPA estática. Se puede alojar en Vercel, Netlify, Cloudflare Pages o un servidor propio (Hetzner) sin servidor de aplicación.
- **Back:** Supabase (Postgres en Frankfurt, Auth y Realtime). Toda la lógica sensible está en funciones SQL (`supabase/migrations/`):
  - Los clientes no tienen cuenta: `guest_open` abre una visita con la **clave secreta del QR** de la mesa y devuelve un token. Con ese token llaman a `guest_state`, `guest_place_order`, `guest_send_message`, `guest_request_bill` y `guest_rate`. Los precios siempre se toman de la carta en el servidor.
  - El personal inicia sesión y solo ve su restaurante (RLS). Cambia estados con `staff_*` y recibe los cambios en tiempo real.
- **Sin pagos ni TSE en el piloto:** la app no cobra ni emite tickets; la cuenta es una vista previa y se cobra en la caja del restaurante.
- **DSGVO:** tipografías alojadas en la propia app (nada de Google Fonts), sin cookies ni seguimiento en la carta del cliente.

## Desarrollo

```bash
cp .env.example .env     # URL y clave publicable de Supabase
npm install
npm run dev              # http://localhost:5173
npm run build
npm run test:e2e         # prueba de la interfaz con un Supabase simulado (necesita `npm run preview` en marcha)
```

- Restaurante de ejemplo: **Casa Lucía** (`supabase/seed.sql`, generado con `scripts/make_seed.py`; fotos en `public/seed/casalucia/`, licencia Unsplash).
- Textos del cliente: `src/i18n/guest.ts`, generado con `npm run i18n`.

## Publicar en Vercel

1. Importar este repositorio en Vercel (framework: Vite).
2. Variables de entorno: `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` (las de `.env.example`).
3. `vercel.json` ya redirige todas las rutas a la SPA.
4. Imprimir los QR desde `/app/qr` (usuario con rol de dueño) **después** de publicar, porque el QR lleva el dominio.
