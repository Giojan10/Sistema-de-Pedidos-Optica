-- ============================================================
-- Esquema de Base de Datos - Sistema de Gestión de Pedidos Óptica
-- Basado en el diagrama entidad-relación del proyecto
-- ============================================================

DROP TABLE IF EXISTS carrito_temp;
DROP TABLE IF EXISTS compras_detalle;
DROP TABLE IF EXISTS compras;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS clientes;

CREATE TABLE clientes (
    id_cliente        INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre            TEXT NOT NULL,
    fecha_nacimiento  TEXT,
    email             TEXT,
    telefono          TEXT
);

CREATE TABLE productos (
    id_producto          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre               TEXT NOT NULL,
    descripcion          TEXT,
    color                TEXT NOT NULL,          -- Verde / Rojo / Azul
    cantidad_disponible  INTEGER NOT NULL DEFAULT 0,
    cantidad_apartada    INTEGER NOT NULL DEFAULT 0,
    precio_unitario      REAL NOT NULL
);

CREATE TABLE compras (
    id_compra   INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cliente  INTEGER NOT NULL,
    fecha       TEXT NOT NULL,
    hora        TEXT NOT NULL,
    estado      TEXT NOT NULL DEFAULT 'Pendiente',  -- Pendiente / Realizado
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
);

-- Tabla de asociación Compras <-> Productos (Compras_Detalle)
CREATE TABLE compras_detalle (
    id_compra       INTEGER NOT NULL,
    id_producto     INTEGER NOT NULL,
    cantidad        INTEGER NOT NULL,
    precio_unitario REAL NOT NULL,
    PRIMARY KEY (id_compra, id_producto),
    FOREIGN KEY (id_compra)   REFERENCES compras(id_compra),
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
);

-- Carrito temporal: productos "apartados" mientras el cliente arma su pedido
-- (ver diagrama de actividades: Agregar Producto -> Reserva producto en inventario)
CREATE TABLE carrito_temp (
    id_cliente   INTEGER NOT NULL,
    id_producto  INTEGER NOT NULL,
    cantidad     INTEGER NOT NULL,
    PRIMARY KEY (id_cliente, id_producto),
    FOREIGN KEY (id_cliente)  REFERENCES clientes(id_cliente),
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
);

-- ============================================================
-- DATOS DE EJEMPLO
-- ============================================================

INSERT INTO clientes (nombre, fecha_nacimiento, email, telefono) VALUES
('Carlos Ruiz',   '1990-02-15', 'carlos.ruiz@correo.com',  '3001234567'),
('Lucía Méndez',  '1985-07-22', 'lucia.mendez@correo.com', '3007654321'),
('Jorge Silva',   '1998-11-03', 'jorge.silva@correo.com',  '3009988776');

INSERT INTO productos (nombre, descripcion, color, cantidad_disponible, cantidad_apartada, precio_unitario) VALUES
('Marco Aviador',      'Marco metálico estilo aviador, liviano y resistente', 'Metálico', 48, 2, 60.00),
('Marco Cat-Eye',      'Marco estilizado de línea alta, ideal para uso diario', 'Rojo',     19,  1, 85.00),
('Marco Rectangular',  'Marco rectangular clásico en acetato',                'Negro',    77,  3, 20.00),
('Marco Redondo',      'Marco redondo minimalista tipo retro',                'Verde',    60,  0, 45.00),
('Marco Deportivo',    'Marco deportivo resistente a impactos',               'Azul',     30,  0, 55.00),
('Marco Infantil',     'Marco liviano y flexible para niños',                 'Verde',    40,  0, 30.00);

INSERT INTO compras (id_cliente, fecha, hora, estado) VALUES
(1, '2026-08-25', '10:15:00', 'Pendiente'),
(2, '2026-08-26', '11:40:00', 'Pendiente'),
(3, '2026-08-27', '09:05:00', 'Realizado');

INSERT INTO compras_detalle (id_compra, id_producto, cantidad, precio_unitario) VALUES
(1, 1, 2, 120.00),
(2, 2, 1, 85.00),
(3, 3, 3, 60.00);
