# MiTurno

Aplicación para emitir tickets numerados, seguir la posición en una cola y atenderlos desde un panel.

## Arquitectura

| Capa | Tecnología |
| --- | --- |
| Interfaz y endpoints | Next.js App Router, React, TypeScript |
| Gestor de paquetes | pnpm |
| Base de datos | Turso/libSQL con Drizzle ORM |
| Alojamiento | Vercel |
| Actualización de panel y pantalla | Sondeo con ETag cada 2,5 segundos |
| Avisos | Correo transaccional mediante Resend |

La lógica de tickets y sesiones se ejecuta en el servidor. La cola actual es la fuente de verdad: cada jornada abierta tiene su propia secuencia; abrir otra cancela los turnos activos de la anterior, archiva la cola anterior y conserva su historial. Solo se crea una cuenta de administrador, mediante un comando de instalación.

Las rutas de interfaz se encuentran en `src/app`; las pantallas reutilizadas están en `src/react-app`; los endpoints y el acceso a datos se encuentran en `src/server`. El antiguo esquema `migrations/0001_init.sql` se conserva únicamente como referencia de datos; no se ha migrado ningún dato de Cloudflare D1 ni se ha modificado esa base.

## Requisitos

- Node.js 22 o superior
- pnpm 10 o superior
- Cuenta Turso para producción (se puede usar SQLite local durante desarrollo)

## Desarrollo local con Git Bash

Desde la carpeta del proyecto:

```bash
pnpm install
cp .dev.vars.example .env.local
```

Edita `.env.local`; define valores largos y distintos para `EMAIL_PEPPER` y `CRON_SECRET`. Ajusta `BUSINESS_TIME_ZONE` a la zona del establecimiento. Para desarrollo local, conserva `TURSO_DATABASE_URL=file:local.db` y deja `TURSO_AUTH_TOKEN` vacío.

```bash
pnpm db:migrate
pnpm create-admin -- admin 'CambiaEstaClave123'
pnpm dev
```

Abre `http://localhost:3000/turno`. El panel está en `/admin/login`; desde el panel, el administrador debe abrir una cola antes de admitir tickets.

Las pruebas y comprobaciones disponibles:

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Turso y Vercel

1. Crea una base de datos en Turso y obtén su URL y token.
2. Verifica un dominio de envío en Resend.
3. Configura en local o en Vercel `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `EMAIL_PEPPER`, `APP_BASE_URL`, `CRON_SECRET`, `RESEND_API_KEY` y `EMAIL_FROM`. Usa como `EMAIL_FROM` una dirección del dominio verificado.
4. Ejecuta `pnpm db:migrate` una vez contra la base Turso prevista. El comando aplica las migraciones versionadas de esta app; **no importa D1**.
5. Crea el único administrador con `pnpm create-admin -- <usuario> <contraseña>` en un entorno con esas variables.
6. Despliega el proyecto en Vercel. El archivo `vercel.json` configura la tarea diaria de anonimización; Vercel debe tener `CRON_SECRET`.

No migres usuarios ni turnos existentes hasta confirmar si D1 contiene datos que deban conservarse. La migración de esos datos es una operación separada, con exportación y comprobación previas.

## Avisos por correo

Se solicita el correo al crear el turno y se envían dos mensajes operativos: la confirmación con número/enlace de seguimiento y, cuando se finaliza, cancela o marca ausente al turno actual, un aviso al siguiente cliente de la cola. El formulario no acepta turnos si el correo es inválido.

- `RESEND_API_KEY`: clave privada de la API; solo servidor.
- `EMAIL_FROM`: remitente en un dominio verificado en Resend.

Si Resend no está configurado o rechaza un mensaje, el turno se mantiene registrado y la pantalla lo indica; el intento queda anotado. El plan gratuito de Resend publica límites que pueden cambiar, así que comprueba sus [precios y límites actuales](https://resend.com/pricing). No uses el servicio para publicidad: los mensajes son solo relativos a la gestión solicitada.

## Rutas principales

- `/turno`: solicitud de ticket
- `/seguimiento/:token`: seguimiento privado
- `/pantalla`: pantalla pública de turnos
- `/admin/login` y `/admin`: acceso y gestión de la cola
- `/admin/qr`: QR de solicitud
- `/admin/ajustes`: identidad del establecimiento y privacidad

El proceso de anonimización elimina nombre, correo, hash de búsqueda, enlaces de seguimiento y consentimientos tras el período de retención configurado. No sustituye una revisión legal de los textos ni de las obligaciones aplicables.
