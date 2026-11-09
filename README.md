================================================================================
SISTEMA DE PEDIDOS — ÓPTICA
================================================================================

Aplicación web de gestión de pedidos e inventario de marcos para gafas, construida
con Next.js (App Router) y PostgreSQL (Supabase). Incluye catálogo, pedidos,
control de inventario, informes (tabular y consolidado) y una API REST externa.

Desplegada en Vercel con base de datos en Supabase.

================================================================================
1. FUNCIONALIDADES
================================================================================

1.1 AUTENTICACIÓN Y ROLES
-------------------------
- Login con usuario y contraseña (JWT en cookie HttpOnly).
- Registro público de clientes.
- Tres roles con permisos diferenciados:
  * Cliente:       catálogo, carrito, "Mis Pedidos".
  * Operario:      catálogo, pedidos, informes tabular y consolidado.
  * Administrador: todo lo anterior + gestión del maestro + exportación CSV.


1.2 CATÁLOGO
------------
- Búsqueda por nombre.
- Filtros por color y rango de precio.
- Ordenamiento por precio y nombre.
- Imagen por producto (URL externa o subida a Supabase Storage).
- Muestra stock disponible en tiempo real.


1.3 PEDIDOS
-----------
- Carrito con reserva de inventario al agregar.
- Ajuste de cantidades (+/-) con devolución automática al inventario.
- Confirmación y cancelación de pedidos con transiciones de estado controladas.
- Estados: Solicitándose, En edición, Realizado, Cancelado.
- Vista "Mis Pedidos" para clientes, con filtros y detalle expandible.


1.4 INFORMES
------------
- Tabular: detalle línea a línea de todas las compras, con filtros por usuario,
  fecha, color, estado y precio. Ordenable por cualquier columna.
- Consolidado: agrupado por color, con unidades vendidas, promedio de precio,
  ingresos totales e inventario disponible. Incluye gráfico de barras.
- Exportación a CSV (solo Administrador), respetando los filtros y el orden
  activos.


1.5 MAESTRO (SOLO ADMINISTRADOR)
--------------------------------
- Crear usuarios (Operario o Administrador).
- Activar/desactivar usuarios (soft delete).
- Crear productos con imagen (URL o archivo de hasta 2 MB).
- Editar productos (incluida la imagen).
- Eliminar productos (solo si no tienen ventas registradas).
- Activar/desactivar productos.


1.6 API EXTERNA
---------------
- API REST en /api/datos para integración con sistemas externos.
- Autenticación mediante API Key (Authorization: Bearer <token>).
- CRUD completo sobre usuarios, productos y compras.
- Documentación completa en app/api/datos/README.md


================================================================================
2. REQUISITOS
================================================================================

- Node.js 20.9 o posterior.
- PostgreSQL 13 o posterior (o una instancia de Supabase).
- Cuenta en Supabase para almacenamiento de imágenes.


================================================================================
3. CONFIGURACIÓN LOCAL
================================================================================

3.1 BASE DE DATOS
-----------------
Crea una base de datos en PostgreSQL o usa un proyecto de Supabase.
Ejecuta el SQL de creación de tablas (está en database/schema.sql o directamente
en el editor SQL de Supabase).


3.2 VARIABLES DE ENTORNO
------------------------
Copia .env.example como .env.local y completa:

    DATABASE_URL=postgres://usuario:clave@host:5432/dbname?sslmode=require
    SESSION_SECRET=<string aleatorio de al menos 32 caracteres>

    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

Genera el SESSION_SECRET con:

    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"


3.3 INSTALACIÓN
---------------
    npm install
    npm run dev

Abre http://localhost:3000


3.4 USUARIO ADMINISTRADOR INICIAL
---------------------------------
Crea manualmente un usuario "admin" con rol Administrador.
El hash de la contraseña se puede generar así:

    node -e "console.log(require('bcryptjs').hashSync('TU_CLAVE', 10))"

E insertarlo en Supabase:

    INSERT INTO usuarios (usuario, clave_hash, rol, nombre)
    VALUES ('admin', '$2b$10$...', 'Administrador', 'Administrador');


================================================================================
4. DESPLIEGUE EN PRODUCCIÓN (VERCEL + SUPABASE)
================================================================================

4.1 SUPABASE
------------
- Crear proyecto y obtener DATABASE_URL desde Settings -> Database.
- Crear un bucket público llamado "productos" en Storage para las imágenes.


4.2 VERCEL
----------
- Importar el repositorio.
- Añadir las variables de entorno del paso 3.2 (todas).
- Deploy automático.


4.3 STORAGE
-----------
Si usas imágenes subidas (no solo URLs externas), verifica que el bucket
"productos" tenga permisos de lectura públicos.


================================================================================
5. ESTRUCTURA DEL PROYECTO
================================================================================

app/
├── actions.js                    Server Actions (auth, carrito, maestro)
├── layout.jsx                    Layout raíz con metadata
├── globals.css                   Estilos globales
├── page.jsx                      Redirige a /login o /catalogo según sesión
│
├── api/
│   └── datos/                    API REST externa (CRUD)
│       ├── route.js              Snapshot completo
│       ├── README.md             Documentación de la API
│       ├── usuarios/
│       ├── productos/
│       ├── compras/
│       └── compras-detalle/
│
├── catalogo/page.jsx             Catálogo con filtros
├── pedido/page.jsx               Pedido abierto (carrito)
├── mis-pedidos/                  Vista "Mis Pedidos" (solo Cliente)
│   ├── page.jsx
│   └── exportar/route.js         CSV de pedidos del cliente
│
├── informe-tabular/              Informe tabular (Operario/Admin)
│   ├── page.jsx
│   └── exportar/route.js
│
├── informe-consolidado/          Informe consolidado (Operario/Admin)
│   ├── page.jsx
│   └── exportar/route.js
│
├── maestro/page.jsx              Gestión de usuarios y productos (Admin)
├── login/page.jsx
├── registro/page.jsx
│
└── components/
    ├── Navbar.jsx                Navegación adaptada al rol
    ├── Notice.jsx                Alertas de éxito/error
    └── SortHeader.jsx            Encabezado clickeable para ordenar

src/
├── db.js                         Pool de conexiones PostgreSQL
├── data.js                       Consultas SQL (catálogo, pedidos, informes)
├── session.js                    Helpers de sesión y guards por rol
├── supabase.js                   Cliente admin de Supabase Storage
├── apiAuth.js                    Validación de API Key y paginación
└── apiHelpers.js                 Helpers de respuesta JSON y errores

scripts/
└── test-api.mjs                  Suite de pruebas end-to-end de la API

database/
└── schema.sql                    Esquema PostgreSQL y datos de ejemplo


================================================================================
6. MODELO DE DATOS
================================================================================

TABLA USUARIOS
--------------
Cuentas con rol (Cliente, Operario, Administrador).
Campos: id_usuario, usuario, clave_hash, rol, nombre, email, telefono,
        fecha_nacimiento, activo, creado_en.

TABLA PRODUCTOS
---------------
Marcos con inventario disponible/apartado, precio e imagen.
Campos: id_producto, nombre, descripcion, color, imagen_url,
        cantidad_disponible, cantidad_apartada, precio_unitario, activo.

TABLA COMPRAS
-------------
Pedidos con estado e id_usuario.
Campos: id_compra, id_usuario, fecha, hora, estado, actualizado_en.

TABLA COMPRAS_DETALLE
---------------------
Líneas de cada pedido (precio congelado al momento de la compra).
Campos: id_compra, id_producto, cantidad, precio_unitario.

TABLA API_KEYS
--------------
Tokens para la API externa.
Campos: id_key, nombre, token, activo, creado_en.


REGLAS DE NEGOCIO CLAVE
-----------------------
1. Un usuario solo puede tener un pedido abierto (Solicitándose o En edición)
   a la vez.
2. Al agregar un producto, se reserva inventario (disponible -> apartada).
3. Al confirmar, la reserva se consume (apartada -> vendida).
4. Al cancelar, el inventario vuelve (apartada -> disponible).
5. Realizado y Cancelado son estados finales (no se pueden cambiar).
6. Los pedidos Realizado no se pueden borrar (se cancelan primero).
7. El precio unitario se congela al crear la compra.
8. Los usuarios y productos con historial no se borran (se desactivan).


================================================================================
7. COMANDOS ÚTILES
================================================================================

    npm run dev          # Desarrollo
    npm run build        # Build de producción
    npm start            # Servir el build

    # Probar la API externa (requiere TOKEN)
    BASE_URL=http://localhost:3000 TOKEN=sk_live_xxx npm run test:api


================================================================================
8. SEGURIDAD
================================================================================

- Contraseñas hasheadas con bcrypt (10 rondas).
- Sesiones firmadas con JWT (8 horas de expiración).
- Cookies HttpOnly + Secure + SameSite=Lax en producción.
- Todas las queries usan parámetros posicionales ($1, $2), nunca concatenación.
- La API externa requiere API Key por header, con validación por tabla.
- Los endpoints sensibles (/maestro, exportaciones) validan el rol.


================================================================================
9. TECNOLOGÍAS
================================================================================

- Next.js 16 (App Router + Server Actions)
- React 19
- PostgreSQL (con pg)
- Supabase (base de datos + storage)
- bcryptjs (hasheo de contraseñas)
- jsonwebtoken (sesiones)
- Vercel (hosting)
- CSS puro (sin frameworks)


================================================================================
10. LICENCIA
================================================================================

Proyecto académico/privado. Todos los derechos reservados.

================================================================================
FIN DEL DOCUMENTO
================================================================================