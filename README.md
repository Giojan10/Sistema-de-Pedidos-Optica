# Sistema de pedidos para óptica

Aplicación web de **Next.js (App Router) y PostgreSQL**. Las páginas consultan la base de datos en el servidor y los formularios usan Server Actions de Next.js. No requiere un backend Express ni una API JSON separada.

## Funcionalidades

- Identificación de clientes existentes y registro sencillo.
- Catálogo con búsqueda, filtros por precio y color y ordenamiento.
- Carrito que reserva inventario, permite ajustar cantidades, confirmar compras y cancelar pedidos.
- Informes tabular y consolidado por color, con filtros, gráfico y exportación CSV.

## Requisitos

- Node.js 20.9 o posterior
- PostgreSQL 13 o posterior

## Configuración local

1. Crea en PostgreSQL la base de datos `optica_pedidos`.
2. Copia `.env.example` como `.env` y configura `DATABASE_URL` con el usuario y contraseña PostgreSQL. Cambia también `SESSION_SECRET`.
3. Instala dependencias y ejecuta el servidor de desarrollo:

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. En su primera conexión, la aplicación crea las tablas y añade información de ejemplo si están vacías.

Para compilar y ejecutar en producción:

```bash
npm run build
npm start
```

## Estructura

```text
app/                  Páginas Next.js, Server Actions y descargas CSV
src/db.js             Conexión e inicialización de PostgreSQL
src/data.js           Consultas de catálogo, carrito e informes
database/schema.sql   Esquema PostgreSQL y datos de ejemplo
public/               Archivos estáticos
```

El cliente seleccionado se conserva en una cookie HttpOnly. Las operaciones del carrito que cambian el inventario se ejecutan dentro de transacciones PostgreSQL.
