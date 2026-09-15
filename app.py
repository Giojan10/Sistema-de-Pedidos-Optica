"""
Sistema de Gestión de Pedidos - Óptica
Backend Flask + SQLite

Implementa únicamente las funcionalidades del diagrama de casos de uso:
  - Consultar Catálogo
  - Gestionar Pedido (Consultar Carrito, Añadir Producto, Quitar Producto,
                       Generar Pedido, Cancelar Pedido)
  - Generar Informe (Tabular, Consolidado y Gráfico)
"""

import os
import sqlite3
from datetime import datetime

from flask import Flask, g, jsonify, render_template, request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "optica.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")

app = Flask(__name__)


# ------------------------------------------------------------------
# Conexión a la base de datos
# ------------------------------------------------------------------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """Crea la base de datos con el esquema y datos de ejemplo si no existe."""
    if not os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        conn.commit()
        conn.close()


# ------------------------------------------------------------------
# Vistas (páginas HTML)
# ------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("identificarse.html")


@app.route("/catalogo")
def vista_catalogo():
    return render_template("catalogo.html")


@app.route("/carrito")
def vista_carrito():
    return render_template("carrito.html")


@app.route("/informe-tabular")
def vista_informe_tabular():
    return render_template("informe_tabular.html")


@app.route("/informe-consolidado")
def vista_informe_consolidado():
    return render_template("informe_consolidado.html")


# ------------------------------------------------------------------
# API - Clientes (identificación simple del cliente, sin login)
# ------------------------------------------------------------------
@app.route("/api/clientes", methods=["GET"])
def api_listar_clientes():
    db = get_db()
    filas = db.execute(
        "SELECT id_cliente, nombre, email FROM clientes ORDER BY nombre"
    ).fetchall()
    return jsonify([dict(f) for f in filas])


@app.route("/api/clientes", methods=["POST"])
def api_crear_cliente():
    data = request.get_json(force=True)
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return jsonify({"error": "El nombre es obligatorio"}), 400
    db = get_db()
    cur = db.execute(
        "INSERT INTO clientes (nombre, fecha_nacimiento, email, telefono) "
        "VALUES (?, ?, ?, ?)",
        (nombre, data.get("fecha_nacimiento"), data.get("email"), data.get("telefono")),
    )
    db.commit()
    return jsonify({"id_cliente": cur.lastrowid, "nombre": nombre}), 201


# ------------------------------------------------------------------
# API - Consultar Catálogo
# ------------------------------------------------------------------
@app.route("/api/productos", methods=["GET"])
def api_consultar_catalogo():
    db = get_db()

    buscar = request.args.get("buscar", "").strip()
    color = request.args.get("color", "Todos")
    precio_desde = request.args.get("precio_desde", type=float)
    precio_hasta = request.args.get("precio_hasta", type=float)
    orden = request.args.get("orden", "precio_desc")

    sql = "SELECT * FROM productos WHERE 1=1"
    params = []

    if buscar:
        sql += " AND nombre LIKE ?"
        params.append(f"%{buscar}%")

    if color and color != "Todos":
        sql += " AND color = ?"
        params.append(color)

    if precio_desde is not None:
        sql += " AND precio_unitario >= ?"
        params.append(precio_desde)

    if precio_hasta is not None:
        sql += " AND precio_unitario <= ?"
        params.append(precio_hasta)

    orden_map = {
        "precio_asc": "precio_unitario ASC",
        "precio_desc": "precio_unitario DESC",
        "nombre_asc": "nombre ASC",
    }
    sql += " ORDER BY " + orden_map.get(orden, "precio_unitario DESC")

    filas = db.execute(sql, params).fetchall()
    return jsonify([dict(f) for f in filas])


# ------------------------------------------------------------------
# API - Gestionar Pedido (Carrito)
# ------------------------------------------------------------------
@app.route("/api/carrito", methods=["GET"])
def api_consultar_carrito():
    id_cliente = request.args.get("id_cliente", type=int)
    if not id_cliente:
        return jsonify({"error": "id_cliente requerido"}), 400

    db = get_db()
    filas = db.execute(
        """
        SELECT p.id_producto, p.nombre, p.descripcion, p.color,
               p.precio_unitario, c.cantidad
        FROM carrito_temp c
        JOIN productos p ON p.id_producto = c.id_producto
        WHERE c.id_cliente = ?
        """,
        (id_cliente,),
    ).fetchall()

    items = [dict(f) for f in filas]
    total = sum(i["precio_unitario"] * i["cantidad"] for i in items)
    return jsonify({"items": items, "precio_total": round(total, 2)})


@app.route("/api/carrito/agregar", methods=["POST"])
def api_agregar_producto():
    """Caso de uso: Añadir Producto -> reserva el producto en el inventario."""
    data = request.get_json(force=True)
    id_cliente = data.get("id_cliente")
    id_producto = data.get("id_producto")
    cantidad = int(data.get("cantidad", 1))

    if not id_cliente or not id_producto or cantidad <= 0:
        return jsonify({"error": "Datos inválidos"}), 400

    db = get_db()
    producto = db.execute(
        "SELECT * FROM productos WHERE id_producto = ?", (id_producto,)
    ).fetchone()
    if producto is None:
        return jsonify({"error": "Producto no encontrado"}), 404
    if producto["cantidad_disponible"] < cantidad:
        return jsonify({"error": "No hay suficiente inventario disponible"}), 400

    existente = db.execute(
        "SELECT * FROM carrito_temp WHERE id_cliente = ? AND id_producto = ?",
        (id_cliente, id_producto),
    ).fetchone()

    if existente:
        db.execute(
            "UPDATE carrito_temp SET cantidad = cantidad + ? "
            "WHERE id_cliente = ? AND id_producto = ?",
            (cantidad, id_cliente, id_producto),
        )
    else:
        db.execute(
            "INSERT INTO carrito_temp (id_cliente, id_producto, cantidad) "
            "VALUES (?, ?, ?)",
            (id_cliente, id_producto, cantidad),
        )

    # Reserva el producto en el inventario
    db.execute(
        "UPDATE productos SET cantidad_disponible = cantidad_disponible - ?, "
        "cantidad_apartada = cantidad_apartada + ? WHERE id_producto = ?",
        (cantidad, cantidad, id_producto),
    )
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/carrito/quitar", methods=["POST"])
def api_quitar_producto():
    """Caso de uso: Quitar Producto -> repone el producto en el inventario."""
    data = request.get_json(force=True)
    id_cliente = data.get("id_cliente")
    id_producto = data.get("id_producto")
    cantidad = int(data.get("cantidad", 1))

    if not id_cliente or not id_producto or cantidad <= 0:
        return jsonify({"error": "Datos inválidos"}), 400

    db = get_db()
    item = db.execute(
        "SELECT * FROM carrito_temp WHERE id_cliente = ? AND id_producto = ?",
        (id_cliente, id_producto),
    ).fetchone()
    if item is None:
        return jsonify({"error": "El producto no está en el carrito"}), 404

    cantidad_a_quitar = min(cantidad, item["cantidad"])
    nueva_cantidad = item["cantidad"] - cantidad_a_quitar

    if nueva_cantidad <= 0:
        db.execute(
            "DELETE FROM carrito_temp WHERE id_cliente = ? AND id_producto = ?",
            (id_cliente, id_producto),
        )
    else:
        db.execute(
            "UPDATE carrito_temp SET cantidad = ? "
            "WHERE id_cliente = ? AND id_producto = ?",
            (nueva_cantidad, id_cliente, id_producto),
        )

    # Repone el producto en el inventario
    db.execute(
        "UPDATE productos SET cantidad_disponible = cantidad_disponible + ?, "
        "cantidad_apartada = cantidad_apartada - ? WHERE id_producto = ?",
        (cantidad_a_quitar, cantidad_a_quitar, id_producto),
    )
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/carrito/confirmar", methods=["POST"])
def api_confirmar_compra():
    """Caso de uso: Generar Pedido -> quita productos reservados y guarda la compra."""
    data = request.get_json(force=True)
    id_cliente = data.get("id_cliente")
    if not id_cliente:
        return jsonify({"error": "id_cliente requerido"}), 400

    db = get_db()
    items = db.execute(
        "SELECT * FROM carrito_temp WHERE id_cliente = ?", (id_cliente,)
    ).fetchall()
    if not items:
        return jsonify({"error": "El carrito está vacío"}), 400

    now = datetime.now()
    cur = db.execute(
        "INSERT INTO compras (id_cliente, fecha, hora, estado) VALUES (?, ?, ?, ?)",
        (id_cliente, now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S"), "Realizado"),
    )
    id_compra = cur.lastrowid

    for item in items:
        producto = db.execute(
            "SELECT precio_unitario FROM productos WHERE id_producto = ?",
            (item["id_producto"],),
        ).fetchone()
        db.execute(
            "INSERT INTO compras_detalle (id_compra, id_producto, cantidad, precio_unitario) "
            "VALUES (?, ?, ?, ?)",
            (id_compra, item["id_producto"], item["cantidad"], producto["precio_unitario"]),
        )
        # Los productos ya estaban reservados (cantidad_apartada); al confirmarse
        # la compra dejan de estar "apartados" (ya se vendieron).
        db.execute(
            "UPDATE productos SET cantidad_apartada = cantidad_apartada - ? "
            "WHERE id_producto = ?",
            (item["cantidad"], item["id_producto"]),
        )

    db.execute("DELETE FROM carrito_temp WHERE id_cliente = ?", (id_cliente,))
    db.commit()
    return jsonify({"ok": True, "id_compra": id_compra})


@app.route("/api/carrito/cancelar", methods=["POST"])
def api_cancelar_compra():
    """Caso de uso: Cancelar Pedido -> devuelve los productos reservados."""
    data = request.get_json(force=True)
    id_cliente = data.get("id_cliente")
    if not id_cliente:
        return jsonify({"error": "id_cliente requerido"}), 400

    db = get_db()
    items = db.execute(
        "SELECT * FROM carrito_temp WHERE id_cliente = ?", (id_cliente,)
    ).fetchall()

    for item in items:
        db.execute(
            "UPDATE productos SET cantidad_disponible = cantidad_disponible + ?, "
            "cantidad_apartada = cantidad_apartada - ? WHERE id_producto = ?",
            (item["cantidad"], item["cantidad"], item["id_producto"]),
        )

    db.execute("DELETE FROM carrito_temp WHERE id_cliente = ?", (id_cliente,))
    db.commit()
    return jsonify({"ok": True})


# ------------------------------------------------------------------
# API - Generar Informe
# ------------------------------------------------------------------
@app.route("/api/informes/tabular", methods=["GET"])
def api_informe_tabular():
    db = get_db()

    precio_desde = request.args.get("precio_desde", type=float)
    precio_hasta = request.args.get("precio_hasta", type=float)
    color = request.args.get("color", "Todos")

    sql = """
        SELECT co.id_compra, co.fecha AS fecha_compra, cl.nombre AS comprador_nombre,
               p.nombre AS producto, p.color, cd.cantidad,
               (cd.cantidad * cd.precio_unitario) AS precio_compra, co.estado AS estado_compra
        FROM compras_detalle cd
        JOIN compras co ON co.id_compra = cd.id_compra
        JOIN clientes cl ON cl.id_cliente = co.id_cliente
        JOIN productos p ON p.id_producto = cd.id_producto
        WHERE 1=1
    """
    params = []

    if color and color != "Todos":
        sql += " AND p.color = ?"
        params.append(color)
    if precio_desde is not None:
        sql += " AND (cd.cantidad * cd.precio_unitario) >= ?"
        params.append(precio_desde)
    if precio_hasta is not None:
        sql += " AND (cd.cantidad * cd.precio_unitario) <= ?"
        params.append(precio_hasta)

    sql += " ORDER BY co.fecha DESC, co.id_compra DESC"

    filas = db.execute(sql, params).fetchall()
    return jsonify([dict(f) for f in filas])


@app.route("/api/informes/consolidado", methods=["GET"])
def api_informe_consolidado():
    db = get_db()

    fecha_inicio = request.args.get("fecha_inicio")
    fecha_final = request.args.get("fecha_final")
    id_cliente = request.args.get("id_cliente", type=int)

    sql = """
        SELECT p.color,
               SUM(cd.cantidad) AS total_productos_vendidos,
               AVG(cd.precio_unitario) AS promedio_precio,
               SUM(cd.cantidad * cd.precio_unitario) AS ingresos_totales
        FROM compras_detalle cd
        JOIN compras co ON co.id_compra = cd.id_compra
        JOIN productos p ON p.id_producto = cd.id_producto
        WHERE 1=1
    """
    params = []
    if fecha_inicio:
        sql += " AND co.fecha >= ?"
        params.append(fecha_inicio)
    if fecha_final:
        sql += " AND co.fecha <= ?"
        params.append(fecha_final)
    if id_cliente:
        sql += " AND co.id_cliente = ?"
        params.append(id_cliente)

    sql += " GROUP BY p.color ORDER BY total_productos_vendidos DESC"

    filas = [dict(f) for f in db.execute(sql, params).fetchall()]

    # Añadir el inventario actual disponible por color
    inventario = {
        r["color"]: r["total"]
        for r in db.execute(
            "SELECT color, SUM(cantidad_disponible) AS total FROM productos GROUP BY color"
        ).fetchall()
    }
    for fila in filas:
        fila["productos_en_inventario"] = inventario.get(fila["color"], 0)
        fila["promedio_precio"] = round(fila["promedio_precio"], 2)
        fila["ingresos_totales"] = round(fila["ingresos_totales"], 2)

    return jsonify(filas)


if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
