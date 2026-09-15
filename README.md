# Sistema de Gestión de Pedidos - Óptica

Aplicación web (Python + Flask + SQLite) construida a partir de:
- Diagrama de casos de uso
- Diagrama de actividades
- Wireframes (Catálogo, Carrito, Informe Tabular, Informe Consolidado)
- Diagrama entidad-relación

Solo se implementaron las funcionalidades presentes en esos diagramas.

## Funcionalidades

- **Consultar Catálogo**: búsqueda, filtro por precio y color, orden por precio/nombre.
- **Gestionar Pedido**:
  - Consultar Carrito
  - Añadir Producto (reserva inventario)
  - Quitar Producto (repone inventario)
  - Generar Pedido / Confirmar Compra (guarda la compra y su detalle)
  - Cancelar Pedido / Rechazar Compra (devuelve productos reservados)
- **Generar Informe**:
  - Informe Tabular (con filtros de precio y color, exportable a CSV)
  - Informe Consolidado y Gráfico (agrupado por color, con filtro de fecha y cliente, exportable a CSV)

## Estructura

```
optica_pedidos/
├── app.py                  # Backend Flask (rutas + API)
├── schema.sql               # Esquema SQL + datos de ejemplo
├── requirements.txt
├── static/
│   ├── css/style.css
│   └── js/                  # Lógica de cada vista
└── templates/                # Vistas HTML (una por wireframe)
```

## Base de datos

SQLite (`optica.db`), se crea automáticamente la primera vez que se ejecuta la
aplicación, usando `schema.sql` (incluye datos de ejemplo: 3 clientes,
6 productos y 3 compras históricas).

Tablas (según el diagrama entidad-relación):
`clientes`, `productos`, `compras`, `compras_detalle`, y `carrito_temp`
(tabla auxiliar para manejar el carrito/reservas mientras el cliente arma su pedido).

> Si prefieres usar MySQL/PostgreSQL en producción, solo hay que adaptar la
> conexión en `app.py` (actualmente usa `sqlite3`) — el esquema SQL es
> prácticamente el mismo.

## Instalación y ejecución

```bash
cd optica_pedidos
python3 -m venv venv
source venv/bin/activate        # En Windows: venv\Scripts\activate
pip install -r requirements.txt
python3 app.py
```

Abrir en el navegador: **http://localhost:5000**

Al entrar, el sistema pide identificarte como cliente (seleccionar uno
existente o registrarte) — no hay login/contraseña porque no aparece en los
diagramas, solo se necesita saber qué cliente está haciendo el pedido.

## Notas de implementación

- El "carrito" se maneja con reservas reales de inventario en la tabla
  `carrito_temp`: al añadir un producto se descuenta de
  `cantidad_disponible` y se suma a `cantidad_apartada`; al quitarlo se
  revierte — tal como lo muestra el diagrama de actividades.
- Al **confirmar** la compra se crea el registro en `compras` +
  `compras_detalle` y se limpia la reserva. Al **cancelar**, se devuelve
  todo el inventario reservado sin crear ninguna compra.
- El gráfico del Informe Consolidado usa Chart.js (cargado por CDN).
