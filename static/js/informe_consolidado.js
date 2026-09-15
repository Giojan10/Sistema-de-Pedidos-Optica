requerirCliente();
pintarNavbar("consolidado");

let ultimosDatos = [];
let grafico = null;

const COLOR_HEX = {
    "Rojo": "#c0392b", "Verde": "#27ae60", "Azul": "#2980b9",
    "Metálico": "#95a5a6", "Negro": "#2c3e50"
};

async function cargarClientesFiltro() {
    const select = document.getElementById("f-cliente");
    try {
        const clientes = await apiFetch("/api/clientes");
        clientes.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id_cliente;
            opt.textContent = c.nombre;
            select.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

function construirQuery() {
    const params = new URLSearchParams();
    const inicio = document.getElementById("f-inicio").value;
    const final = document.getElementById("f-final").value;
    const clienteId = document.getElementById("f-cliente").value;

    if (inicio) params.set("fecha_inicio", inicio);
    if (final) params.set("fecha_final", final);
    if (clienteId) params.set("id_cliente", clienteId);
    return params.toString();
}

async function cargarInforme() {
    const cuerpo = document.getElementById("tabla-body");
    const vacio = document.getElementById("mensaje-vacio");
    cuerpo.innerHTML = "";

    const selectCliente = document.getElementById("f-cliente");
    const nombreCliente = selectCliente.value
        ? selectCliente.options[selectCliente.selectedIndex].textContent
        : "Todos";
    document.getElementById("cliente-label").textContent = `Cliente: ${nombreCliente}`;

    try {
        const filas = await apiFetch("/api/informes/consolidado?" + construirQuery());
        ultimosDatos = filas;
        vacio.style.display = filas.length ? "none" : "block";

        filas.forEach(f => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${f.color}</td>
                <td>${f.total_productos_vendidos}</td>
                <td>$${f.promedio_precio.toFixed(2)}</td>
                <td>$${f.ingresos_totales.toFixed(2)}</td>
                <td>${f.productos_en_inventario}</td>
            `;
            cuerpo.appendChild(tr);
        });

        dibujarGrafico(filas);
    } catch (e) {
        alert(e.message);
    }
}

function dibujarGrafico(filas) {
    const ctx = document.getElementById("grafico-colores");
    const etiquetas = filas.map(f => f.color);
    const valores = filas.map(f => f.total_productos_vendidos);
    const colores = etiquetas.map(c => COLOR_HEX[c] || "#7f8c8d");

    if (grafico) grafico.destroy();
    grafico = new Chart(ctx, {
        type: "bar",
        data: {
            labels: etiquetas,
            datasets: [{ label: "Total Productos Vendidos", data: valores, backgroundColor: colores }],
        },
        options: {
            indexAxis: "y",
            responsive: true,
            plugins: { legend: { display: true } },
            scales: { x: { beginAtZero: true } },
        },
    });
}

function exportarCSV() {
    if (!ultimosDatos.length) { alert("No hay datos para exportar."); return; }
    const encabezados = ["Color","Total Productos Vendidos","Promedio Precio","Ingresos Totales","Productos en Inventario"];
    const filas = ultimosDatos.map(f => [
        f.color, f.total_productos_vendidos, f.promedio_precio.toFixed(2),
        f.ingresos_totales.toFixed(2), f.productos_en_inventario
    ]);
    const csv = [encabezados, ...filas].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "informe_consolidado_ventas.csv";
    a.click();
    URL.revokeObjectURL(url);
}

document.getElementById("btn-filtrar").addEventListener("click", cargarInforme);
document.getElementById("btn-exportar").addEventListener("click", exportarCSV);

cargarClientesFiltro().then(cargarInforme);
