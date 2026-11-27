# abWeb Gastro · web de venta y Chef-Portal (React)

Web pública de abWeb Gastro (sección de abwebsolutions.cloud) y demo del portal del jefe.
Diseño «Marca abWeb»: mismos colores, letras y logo que abwebsolutions.cloud.

## Cómo adaptarlo (sin tocar código)
| Quiero cambiar… | Archivo |
|---|---|
| Textos, precios, módulos, FAQ, contacto, SEO por página | `src/content/site.js` |
| Datos de ejemplo del portal y qué módulos tiene activos | `src/content/portal-demo.js` |
| Colores, letras y esquinas | bloque `:root` al principio de `src/styles.css` |
| Fotos | `public/img/` (webp, menos de 200 KB) |

Cada módulo funciona solo y aparece en el mismo portal. En `portal-demo.js`, `activeModules` decide qué ve el restaurante; lo que está en `false` sale como «Aktivieren».

## Comandos
```
npm install
npm run dev            # desarrollo
npm run build          # web final en dist/ (subir a Hostinger, incluye .htaccess)
npm run build:preview  # versión con #rutas para vista previa
npm run qa             # comprobación automática (necesita npm run preview en marcha)
```

## Formulario
Pon la dirección que recibe las solicitudes en `VITE_FORM_ENDPOINT` (archivo `.env`), por ejemplo un webhook de n8n que mande el aviso a info@abwebsolutions.cloud y la confirmación al cliente. Recibe un POST JSON con `name, restaurant, email, phone, paket, message, consent, quelle, zeit`. Sin endpoint, el formulario muestra teléfono y email.

## Pendiente antes de publicar
- Endpoint del formulario (n8n o Supabase) y prueba real de los dos emails.
- Datenschutz de abwebsolutions.cloud: añadir Supabase (Frankfurt), asistente de voz y el formulario de Gastro.
- Subdominio `gastro.abwebsolutions.cloud` (canonical, sitemap y robots ya lo usan).
