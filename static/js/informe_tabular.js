requerirCliente();
pintarNavbar("tabular");

let ultimosDatos = [];

function construirQuery() {
    const params = new URLSearchParams();
    const desde = document.getElementById("f-desde").value;
    const hasta = document.getElementById("f-hasta").value;
    const color = document.querySelector('input[name="f-color"]:checked').value;

    if (desde) params.set("precio_desde", desde);
    if (hasta) params.set("precio_hasta", hasta);
    if (color) params.set("color", color);
    return params.toString();
}

async function cargarInforme() {
    const cuerpo = document.getElementById("tabla-body");
    const vacio = document.getElementById("mensaje-vacio");
    cuerpo.innerHTML = "";

    try {
        const filas = await apiFetch("/api/informes/tabular?" + construirQuery());
        ultimosDatos = filas;
        vacio.style.display = filas.length ? "none" : "block";

        filas.forEach(f => {
            const tr = document.createElement("tr");
            const claseEstado = f.estado_compra === "Realizado" ? "estado-realizado" : "estado-pendiente";
            tr.innerHTML = `
                <td>${f.id_compra}</td>
                <td>${f.fecha_compra}</td>
                <td>${f.comprador_nombre}</td>
                <td>${f.producto}</td>
                <td>${f.color}</td>
                <td>${f.cantidad}</td>
                <td>$${f.precio_compra.toFixed(2)}</td>
                <td class="${claseEstado}">${f.estado_compra}</td>
            `;
            cuerpo.appendChild(tr);
        });
    } catch (e) {
        alert(e.message);
    }
}

function exportarCSV() {
    if (!ultimosDatos.length) { alert("No hay datos para exportar."); return; }
    const encabezados = ["Id Compra","Fecha Compra","Comprador","Producto","Color","Cantidad","Precio Compra","Estado"];
    const filas = ultimosDatos.map(f => [
        f.id_compra, f.fecha_compra, f.comprador_nombre, f.producto,
        f.color, f.cantidad, f.precio_compra.toFixed(2), f.estado_compra
    ]);
    const csv = [encabezados, ...filas].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "informe_tabular_ventas.csv";
    a.click();
    URL.revokeObjectURL(url);
}

document.getElementById("btn-filtrar").addEventListener("click", cargarInforme);
document.getElementById("btn-exportar").addEventListener("click", exportarCSV);

cargarInforme();
