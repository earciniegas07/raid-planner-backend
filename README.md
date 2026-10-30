# RaidPlanner – Backend

API REST (Node.js, Express, MongoDB) para gestionar clanes, raids, asignación de roles tácticos y el "Fallómetro".

## URLs
- API (producción): _pegar URL de Render_
- Documentación Swagger: `<URL de la API>/api-docs`
- Frontend: _pegar URL de Vercel_

## Instalación local
1. `npm install`
2. Copiar `.env.example` a `.env` y completar los valores.
3. `npm run seed` (crea clan y usuarios de prueba)
4. `npm run dev` (http://localhost:5000)

## Variables de entorno
| Variable | Descripción |
|---|---|
| PORT | Puerto del servidor |
| MONGO_URI | Cadena de conexión a MongoDB Atlas |
| JWT_SECRET | Secreto para firmar los JWT |
| FRONTEND_URL | Origen(es) permitidos por CORS, separados por coma |

## Credenciales de prueba
| Rol | Email | Contraseña |
|---|---|---|
| Administrador (Raid Leader) | admin@raidplanner.com | Test1234 |
| Usuario estándar (Raider) | jugador@raidplanner.com | Test1234 |

Administrador = Raid Leader u Officer. Usuario estándar = Raider.

## Endpoints principales
| Método | Ruta | Acceso |
|---|---|---|
| POST | /api/auth/register | Público |
| POST | /api/auth/login | Público |
| GET | /api/auth/me | Autenticado |
| GET | /api/users | Autenticado |
| GET | /api/clans | Público |
| POST / PUT | /api/clans, /api/clans/:id | Admin |
| DELETE | /api/clans/:id | Raid Leader |
| POST | /api/clans/:id/join | Autenticado |
| GET | /api/clans/:id/rankings | Público |
| GET | /api/raids | Público |
| POST / PUT / DELETE | /api/raids, /api/raids/:id | Admin |
| PATCH | /api/raids/:id/state | Según transición (Leader/Officer) |
| PATCH | /api/raids/:id/assignments/:userId | Admin |
| POST | /api/raids/:id/failures | Admin |
| PATCH | /api/raids/:id/checkin, /checkout | Autenticado |
| GET | /api/raids/rankings/all | Público |