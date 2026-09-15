async function cargarClientes() {
    const select = document.getElementById("select-cliente");
    try {
        const clientes = await apiFetch("/api/clientes");
        clientes.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id_cliente;
            opt.textContent = `${c.nombre} (${c.email || "sin correo"})`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error(e);
    }
}

function irACatalogo(id_cliente, nombre) {
    localStorage.setItem("id_cliente", id_cliente);
    localStorage.setItem("nombre_cliente", nombre);
    window.location.href = "/catalogo";
}

document.getElementById("btn-continuar").addEventListener("click", () => {
    const select = document.getElementById("select-cliente");
    if (!select.value) {
        document.getElementById("mensaje-error").textContent = "Selecciona un cliente.";
        return;
    }
    irACatalogo(select.value, select.options[select.selectedIndex].textContent);
});

document.getElementById("btn-crear").addEventListener("click", async () => {
    const nombre = document.getElementById("nuevo-nombre").value.trim();
    const email = document.getElementById("nuevo-email").value.trim();
    const mensaje = document.getElementById("mensaje-error");
    if (!nombre) {
        mensaje.textContent = "El nombre es obligatorio.";
        return;
    }
    try {
        const cliente = await apiFetch("/api/clientes", {
            method: "POST",
            body: JSON.stringify({ nombre, email }),
        });
        irACatalogo(cliente.id_cliente, cliente.nombre);
    } catch (e) {
        mensaje.textContent = e.message;
    }
});

cargarClientes();
