# Nube Eventos

Aplicación Angular para la landing pública y el panel de administración de Nube Eventos.

## Empezar

1. Iniciá el backend Spring Boot en `http://localhost:8080`.
2. Desde esta carpeta, ejecutá `npm start`.
3. Abrí `http://localhost:4200/` para la landing o `http://localhost:4200/admin` para el panel.

El servidor de desarrollo reenvía las llamadas `/api` a Spring Boot mediante `src/proxy.conf.json`. Para producción, configurá el servidor web para que `/api` llegue al backend.

## Panel de administración

El login envía `username` y `password` a `POST /api/auth/login`. Si la respuesta contiene un JWT (`token`, `accessToken`, `access_token` o `jwt`), el panel lo manda como `Authorization: Bearer …`; también permite autenticación basada en cookie. La sesión del panel se mantiene en esta pestaña del navegador.

Desde el panel se pueden consultar solicitudes, tipos de evento, servicios y packs; crear tipos, servicios y packs; y agregar un servicio a un pack existente. Para agregarlo, la app envía `POST /api/packs/{packId}/services` con `{ "serviceId": "…" }`. Si tu controlador Spring espera otro formato para esa operación, ajustá el body en `src/app/admin/admin.ts`.

## Compilar

```bash
npm run build
```
