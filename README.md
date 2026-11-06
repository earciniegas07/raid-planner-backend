# RaidPlanner – Backend

API REST (Node.js, Express 5, MongoDB/Mongoose) para gestionar clanes, raids, asignación automática de roles tácticos y el "Fallómetro". Autenticación con JWT y permisos por rol.

## URLs públicas
| Recurso | URL |
|---|---|
| API (Render) | `https://raid-planner-backend.onrender.com` |
| Documentación Swagger | `https://raid-planner-backend.onrender.com/api-docs` |
| Frontend (Vercel) | `https://REEMPLAZAR-FRONT.vercel.app` |
| Repositorio frontend | `https://github.com/earciniegas07//raid-planner` |

> Render (plan gratuito) duerme el servicio tras un rato sin uso: la primera petición puede tardar ~30 s.

## Stack
Node.js · Express 5 · MongoDB Atlas + Mongoose · JWT (`jsonwebtoken`) · `bcryptjs` · Swagger (`swagger-jsdoc` + `swagger-ui-express`)

## Instalación local
1. `npm install`
2. Copiar `.env.example` a `.env` y completar los valores (ver tabla).
3. `npm run seed` – crea clanes, usuarios, raids y fallos de ejemplo (se puede repetir sin duplicar).
4. `npm run dev` → http://localhost:5000 (documentación en http://localhost:5000/api-docs)

Para producción: `npm start`.

## Variables de entorno
| Variable | Descripción |
|---|---|
| PORT | Puerto del servidor (Render lo asigna solo) |
| MONGO_URI | Cadena de conexión de MongoDB Atlas |
| JWT_SECRET | Secreto para firmar los JWT |
| FRONTEND_URL | Origen(es) permitidos por CORS, separados por coma (URL de Vercel) |

El archivo `.env` **no** se sube al repositorio (está en `.gitignore`).

## Credenciales de prueba
| Rol | Email | Contraseña |
|---|---|---|
| Administrador (Raid Leader) | admin@raidplanner.com | Test1234 |
| Administrador (Officer) | ironshield@raidplanner.com | Test1234 |
| Usuario estándar (Raider) | jugador@raidplanner.com | Test1234 |

Administrador = Raid Leader u Officer. Usuario estándar = Raider. Los demás usuarios del seed usan `<gamertag en minúsculas>@raidplanner.com` con la misma contraseña.

## Roles y permisos
| Acción | Quién puede |
|---|---|
| Ver clanes, raids y rankings | Público |
| Unirse a un clan, check-in / check-out | Cualquier usuario autenticado |
| Crear/editar clanes, crear/editar/eliminar raids, bloquear e iniciar raid, reasignar roles, registrar fallos | Raid Leader u Officer |
| Eliminar clanes, cerrar raid (Completed/Failed) | Solo Raid Leader |

## Lógica de negocio
- **Máquina de estados de la raid:** `Planning → Locked → InProgress → Completed | Failed`.
- **Al bloquear (`Locked`)** se asignan roles tácticos automáticamente: primero Officer/Raid Leader, luego mayor nivel; el resto va a `Bench`.
- **Fiabilidad:** Completed suma +10 a los asignados; Failed resta 5 (15 al Raid Leader).
- **Fallómetro:** severidades 1, 3 o 5. Si un jugador acumula ≥ 8 puntos en una raid pasa a `Bench` y pierde 10 de fiabilidad.
- **Check-out tardío** (con la raid `Locked`) genera un fallo de severidad 3.
- **Cupos por clase:** `roleLimits` del clan limita cuántos jugadores de una clase pueden unirse.

## Endpoints principales
| Método | Ruta | Acceso |
|---|---|---|
| POST | /api/auth/register | Público |
| POST | /api/auth/login | Público |
| GET | /api/auth/me | Autenticado |
| GET | /api/users | Autenticado |
| GET | /api/clans | Público |
| POST | /api/clans | Admin |
| PUT | /api/clans/:id | Admin |
| DELETE | /api/clans/:id | Raid Leader |
| POST | /api/clans/:id/join | Autenticado |
| GET | /api/clans/:id/rankings | Público |
| GET | /api/raids | Público |
| POST | /api/raids | Admin |
| PUT / DELETE | /api/raids/:id | Admin |
| PATCH | /api/raids/:id/state | Según transición (ver permisos) |
| PATCH | /api/raids/:id/assignments/:userId | Admin |
| POST | /api/raids/:id/failures | Admin |
| PATCH | /api/raids/:id/checkin | Autenticado (asignado) |
| PATCH | /api/raids/:id/checkout | Autenticado (asignado) |
| GET | /api/raids/rankings/all | Público |

Las rutas protegidas esperan la cabecera `Authorization: Bearer <token>`.

## Despliegue (Render)
- Build command: `npm install` · Start command: `npm start`
- Configurar las variables `MONGO_URI`, `JWT_SECRET` y `FRONTEND_URL` en el panel de Render.
- En MongoDB Atlas → *Network Access* permitir las IP de Render (`0.0.0.0/0`).
- Ejecutar `npm run seed` una vez con la `MONGO_URI` de Atlas para cargar los datos de prueba.
