# Eden Captación

Formularios propios de Eden para las campañas de Meta Ads. Sustituye la parte de formularios de Chronos Dock.

- Formulario público, una pregunta por pantalla: `https://formulario.edenperformance.net/<direccion>`
- Panel: `https://formulario.edenperformance.net/admin`
- Cada lead se guarda en Supabase, se envía a Meta por la Conversions API (y por el Pixel si acepta las cookies, con el mismo ID de evento) y se avisa por e-mail.

## Piezas

| Pieza | Para qué |
|---|---|
| Vercel (equipo EDEN, región Frankfurt) | Aloja la web. Cada cambio subido a GitHub se publica solo. |
| Supabase (región UE) | Base de datos: formularios, leads, métricas y actividad. |
| Google Workspace (SMTP) | Envía los avisos desde samu@edenperformance.net. |
| Meta | Conversions API: ID del píxel y token por formulario, en Ajustes. |

## Puesta en marcha

1. **Supabase**: crear proyecto en región UE (Frankfurt). En *SQL Editor* pegar `supabase/schema.sql` y ejecutar.
2. **Vercel**: importar este repositorio en el equipo EDEN y añadir las variables de `.env.example`:
   - `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: Supabase > Project Settings > API (la clave *service_role*, nunca la compartas).
   - `ADMIN_PASSWORD`: contraseña del panel.
   - `SESSION_SECRET`: texto aleatorio largo (32+ caracteres).
   - `SMTP_*` y `MAIL_FROM`: cuenta de Google Workspace con una contraseña de aplicación.
   - `PUBLIC_BASE_URL`: `https://formulario.edenperformance.net`
3. **Dominio**: en Vercel > Settings > Domains añadir `formulario.edenperformance.net` y crear en el DNS el registro CNAME que indique Vercel.
4. **Meta**: en el panel, Ajustes de cada formulario: ID del píxel, token de la Conversions API y, para probar, el código de *Probar eventos*.

## Desarrollo

```
npm install
cp .env.example .env.local   # rellenar
npm run dev
```
