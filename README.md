# Sistema de pedidos para óptica

Aplicación web construida con **Node.js, Express, EJS y PostgreSQL**. El servidor entrega las páginas HTML y procesa directamente los formularios; la aplicación no necesita una API JSON ni un backend en otro lenguaje.

## Funcionalidades

- Identificación de un cliente existente o registro sencillo de uno nuevo.
- Catálogo con búsqueda, filtros por precio y color, y orden por precio o nombre.
- Carrito con reserva de inventario, ajuste de cantidades, confirmación de compra y cancelación.
- Informe de ventas tabular con filtros y descarga CSV.
- Informe consolidado por color con filtros de fecha/cliente, gráfico y descarga CSV.

## Requisitos

- Node.js 20 o posterior
- PostgreSQL 13 o posterior

## Configuración

1. Crea una base de datos PostgreSQL, por ejemplo `optica_pedidos`.
2. Copia `.env.example` como `.env` y ajusta `DATABASE_URL` a las credenciales de tu instancia. Cambia también `SESSION_SECRET`.
3. Instala las dependencias e inicia el servidor:

```bash
npm install
npm start
```

La primera ejecución crea las tablas y carga datos de ejemplo cuando las tablas están vacías. Después abre <http://localhost:3000>.

Para desarrollo con reinicio al cambiar archivos: `npm run dev`.

## Estructura

```text
src/server.js       Rutas web, reglas de negocio y renderizado
src/db.js           Conexión e inicialización de PostgreSQL
database/schema.sql Tablas e información inicial idempotente
views/              Plantillas EJS renderizadas por Express
static/css/         Estilos
images/             Recursos gráficos
```

La sesión del navegador mantiene el cliente seleccionado. Las operaciones de carrito que actualizan inventario se ejecutan dentro de transacciones PostgreSQL.
