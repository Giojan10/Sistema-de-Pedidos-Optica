// Maneja el "cliente actual" en localStorage (no hay login en los diagramas,
// solo se identifica al Cliente para poder asociarlo a sus compras).

function obtenerClienteActual() {
    const id = localStorage.getItem("id_cliente");
    const nombre = localStorage.getItem("nombre_cliente");
    if (!id) return null;
    return { id_cliente: parseInt(id, 10), nombre };
}

function requerirCliente() {
    const cliente = obtenerClienteActual();
    if (!cliente) {
        window.location.href = "/";
        return null;
    }
    return cliente;
}

function pintarNavbar(paginaActiva) {
    const cliente = obtenerClienteActual();
    const nombre = cliente ? cliente.nombre : "";
    const nav = document.getElementById("navbar-container");
    if (!nav) return;

    const enlaces = [
        { href: "/catalogo", texto: "Catálogo", id: "catalogo" },
        { href: "/carrito", texto: "Carrito", id: "carrito" },
        { href: "/informe-tabular", texto: "Informe Tabular", id: "tabular" },
        { href: "/informe-consolidado", texto: "Informe Consolidado", id: "consolidado" },
    ];

    nav.innerHTML = `
        <div class="brand">Óptica · Sistema de Gestión de Pedidos</div>
        <nav>
            ${enlaces.map(e => `<a href="${e.href}" class="${e.id === paginaActiva ? "active" : ""}">${e.texto}</a>`).join("")}
        </nav>
        <div class="cliente-info">
            ${nombre ? `Cliente: <strong>${nombre}</strong> · <a href="/" style="color:#b3452f;">Cambiar</a>` : ""}
        </div>
    `;
}

async function apiFetch(url, options = {}) {
    const resp = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        throw new Error(data.error || "Ocurrió un error inesperado");
    }
    return data;
}
