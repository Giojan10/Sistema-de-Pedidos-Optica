const cliente = requerirCliente();
pintarNavbar("carrito");

async function cargarCarrito() {
    const grid = document.getElementById("productos-grid");
    const vacio = document.getElementById("mensaje-vacio");
    grid.innerHTML = "";

    try {
        const data = await apiFetch(`/api/carrito?id_cliente=${cliente.id_cliente}`);
        vacio.style.display = data.items.length ? "none" : "block";
        document.getElementById("precio-total").textContent = `$${data.precio_total.toFixed(2)}`;

        data.items.forEach(p => {
            const card = document.createElement("div");
            card.className = "producto-card";
            card.innerHTML = `
                <div class="producto-imagen"></div>
                <div class="producto-precio">$${(p.precio_unitario * p.cantidad).toFixed(2)}</div>
                <div class="producto-nombre">${p.nombre}</div>
                <div class="producto-desc">${p.descripcion || ""} · Color: ${p.color}</div>
                <div class="cantidad-control">
                    Cantidad:
                    <button data-accion="restar">-</button>
                    <span>${p.cantidad}</span>
                    <button data-accion="sumar">+</button>
                </div>
            `;
            card.querySelector('[data-accion="sumar"]').addEventListener("click", () => agregar(p.id_producto));
            card.querySelector('[data-accion="restar"]').addEventListener("click", () => quitar(p.id_producto));
            grid.appendChild(card);
        });
    } catch (e) {
        alert(e.message);
    }
}

async function agregar(id_producto) {
    try {
        await apiFetch("/api/carrito/agregar", {
            method: "POST",
            body: JSON.stringify({ id_cliente: cliente.id_cliente, id_producto, cantidad: 1 }),
        });
        cargarCarrito();
    } catch (e) {
        alert(e.message);
    }
}

async function quitar(id_producto) {
    try {
        await apiFetch("/api/carrito/quitar", {
            method: "POST",
            body: JSON.stringify({ id_cliente: cliente.id_cliente, id_producto, cantidad: 1 }),
        });
        cargarCarrito();
    } catch (e) {
        alert(e.message);
    }
}

document.getElementById("btn-confirmar").addEventListener("click", async () => {
    const mensaje = document.getElementById("mensaje-estado");
    try {
        const res = await apiFetch("/api/carrito/confirmar", {
            method: "POST",
            body: JSON.stringify({ id_cliente: cliente.id_cliente }),
        });
        mensaje.style.color = "#2b7a3f";
        mensaje.textContent = `¡Pedido #${res.id_compra} generado con éxito!`;
        cargarCarrito();
    } catch (e) {
        mensaje.style.color = "#b3452f";
        mensaje.textContent = e.message;
    }
});

document.getElementById("btn-cancelar").addEventListener("click", async () => {
    const mensaje = document.getElementById("mensaje-estado");
    try {
        await apiFetch("/api/carrito/cancelar", {
            method: "POST",
            body: JSON.stringify({ id_cliente: cliente.id_cliente }),
        });
        mensaje.style.color = "#b3452f";
        mensaje.textContent = "Compra cancelada. Los productos volvieron al inventario.";
        cargarCarrito();
    } catch (e) {
        mensaje.style.color = "#b3452f";
        mensaje.textContent = e.message;
    }
});

cargarCarrito();
