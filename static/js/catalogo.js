const cliente = requerirCliente();
pintarNavbar("catalogo");

function construirQuery() {
    const params = new URLSearchParams();
    const buscar = document.getElementById("f-buscar").value.trim();
    const desde = document.getElementById("f-desde").value;
    const hasta = document.getElementById("f-hasta").value;
    const color = document.querySelector('input[name="f-color"]:checked').value;
    const orden = document.getElementById("f-orden").value;

    if (buscar) params.set("buscar", buscar);
    if (desde) params.set("precio_desde", desde);
    if (hasta) params.set("precio_hasta", hasta);
    if (color) params.set("color", color);
    if (orden) params.set("orden", orden);
    return params.toString();
}

async function cargarCatalogo() {
    const grid = document.getElementById("productos-grid");
    const vacio = document.getElementById("mensaje-vacio");
    grid.innerHTML = "";

    try {
        const productos = await apiFetch("/api/productos?" + construirQuery());
        vacio.style.display = productos.length ? "none" : "block";

        productos.forEach(p => {
            const disponible = p.cantidad_disponible;
            const card = document.createElement("div");
            card.className = "producto-card";
            card.innerHTML = `
                <div class="producto-imagen"></div>
                <div class="producto-precio">$${p.precio_unitario.toFixed(2)}</div>
                <div class="producto-nombre">${p.nombre}</div>
                <div class="producto-desc">${p.descripcion || ""} · Color: ${p.color}</div>
                <div class="producto-desc">Disponibles: ${disponible}</div>
                <button class="btn btn-block" ${disponible <= 0 ? "disabled" : ""} data-id="${p.id_producto}">
                    ${disponible <= 0 ? "Sin stock" : "Agregar al Carrito"}
                </button>
            `;
            card.querySelector("button").addEventListener("click", () => agregarAlCarrito(p.id_producto));
            grid.appendChild(card);
        });
    } catch (e) {
        alert(e.message);
    }
}

async function agregarAlCarrito(id_producto) {
    try {
        await apiFetch("/api/carrito/agregar", {
            method: "POST",
            body: JSON.stringify({ id_cliente: cliente.id_cliente, id_producto, cantidad: 1 }),
        });
        cargarCatalogo();
    } catch (e) {
        alert(e.message);
    }
}

document.getElementById("btn-filtrar").addEventListener("click", cargarCatalogo);
document.getElementById("btn-buscar").addEventListener("click", cargarCatalogo);

cargarCatalogo();
