#!/usr/bin/env node
// ============================================================
// Suite de pruebas end-to-end para la API /api/datos
//
// Uso:
//   BASE_URL=http://localhost:3000 TOKEN=sk_live_xxx node scripts/test-api.mjs
//   BASE_URL=https://sistema-de-pedidos-optica.vercel.app TOKEN=sk_live_xxx node scripts/test-api.mjs
//
// Requiere Node 20+ (usa fetch nativo).
// ============================================================

const BASE_URL = process.env.BASE_URL || 'https://sistema-de-pedidos-optica.vercel.app';
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error('Falta variable de entorno TOKEN=sk_live_...');
  process.exit(1);
}

const API = `${BASE_URL}/api/datos`;

/* ---------------- Colores ---------------- */
const c = {
  green: s => `\x1b[32m${s}\x1b[0m`,
  red:   s => `\x1b[31m${s}\x1b[0m`,
  yellow:s => `\x1b[33m${s}\x1b[0m`,
  cyan:  s => `\x1b[36m${s}\x1b[0m`,
  gray:  s => `\x1b[90m${s}\x1b[0m`,
  bold:  s => `\x1b[1m${s}\x1b[0m`,
};

/* ---------------- Contadores ---------------- */
let paso = 0;
let exitos = 0;
let fallos = 0;

const step    = (msg) => console.log(c.yellow(`\n▶ Paso ${++paso} — ${msg}`));
const ok      = (msg) => { exitos++; console.log(c.green(`  ✔ ${msg}`)); };
const fail    = (msg) => { fallos++; console.log(c.red(`  ✘ ${msg}`)); };
const info    = (msg) => console.log(c.cyan(`    ${msg}`));
const warn    = (msg) => console.log(c.gray(`    ${msg}`));

/* ---------------- Recursos creados (para cleanup) ---------------- */
const cleanup = {
  usuarios: [],
  productos: [],
  compras: [],
};

/* ---------------- Petición genérica ---------------- */
async function req(method, path, body, expected = 200, { withAuth = true } = {}) {
  const headers = {};
  if (withAuth) headers['Authorization'] = `Bearer ${TOKEN}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (res.status !== expected) {
    throw new Error(
      `${method} ${path} → esperaba ${expected}, recibió ${res.status}\n` +
      `Respuesta: ${JSON.stringify(data, null, 2)}`
    );
  }
  return data;
}

/* ---------------- Wrapper para agrupar una prueba ---------------- */
async function test(nombre, fn) {
  step(nombre);
  try {
    await fn();
  } catch (error) {
    fail(error.message);
  }
}

/* ============================================================
   PRUEBAS
   ============================================================ */

async function main() {
  console.log(c.bold(c.cyan(`\n🧪  Probando API en: ${API}\n`)));

  const sufijo = Math.floor(Math.random() * 1e6);
  const usuarioNombre = `test_api_${sufijo}`;
  const emailUsuario = `test_api_${sufijo}@example.com`;
  let usrId, prodId, compraId;

  /* ---------- 1. Listado público con token ---------- */
  await test('GET /productos (listar)', async () => {
    const data = await req('GET', '/productos?limit=3');
    info(`${data.data?.length ?? 0} productos`);
    ok('Listado OK');
  });

  /* ---------- 2. Crear usuario ---------- */
  await test('POST /usuarios (crear Cliente)', async () => {
    const data = await req('POST', '/usuarios', {
      usuario: usuarioNombre,
      clave: 'prueba12345',
      rol: 'Cliente',
      nombre: 'Cliente de Prueba',
      email: emailUsuario,
    }, 201);
    usrId = data.data.id_usuario;
    cleanup.usuarios.push(usrId);
    info(`id_usuario = ${usrId}`);
    ok('Usuario creado');
  });

  /* ---------- 3. Verificar que aparece en el listado ---------- */
  if (usrId) {
    await test(`GET /usuarios/${usrId}`, async () => {
      const data = await req('GET', `/usuarios/${usrId}`);
      if (data.data.usuario !== usuarioNombre) {
        throw new Error('El usuario no coincide');
      }
      ok('Usuario recuperado');
    });
  }

  /* ---------- 4. Crear producto ---------- */
  await test('POST /productos (crear)', async () => {
    const data = await req('POST', '/productos', {
      nombre: `Producto de Prueba ${sufijo}`,
      descripcion: 'Creado por test-api.mjs',
      color: 'Negro',
      precio_unitario: 12.34,
      cantidad_disponible: 10,
    }, 201);
    prodId = data.data.id_producto;
    cleanup.productos.push(prodId);
    info(`id_producto = ${prodId}`);
    ok('Producto creado');
  });

  /* ---------- 5. Crear pedido en Solicitándose ---------- */
  if (usrId && prodId) {
    await test('POST /compras (crear en Solicitándose)', async () => {
      const data = await req('POST', '/compras', {
        id_usuario: usrId,
        estado: 'Solicitándose',
        items: [{ id_producto: prodId, cantidad: 2 }],
      }, 201);
      compraId = data.data.id_compra;
      cleanup.compras.push(compraId);
      info(`id_compra = ${compraId}`);
      ok('Compra creada');
    });
  }

  /* ---------- 6. Ver detalle ---------- */
  if (compraId) {
    await test(`GET /compras/${compraId} (con detalle)`, async () => {
      const data = await req('GET', `/compras/${compraId}`);
      if (!Array.isArray(data.data?.detalle)) {
        throw new Error('Falta el detalle');
      }
      info(`${data.data.detalle.length} línea(s)`);
      ok('Detalle OK');
    });
  }

  /* ---------- 7. Transición: Solicitándose → En edición ---------- */
  if (compraId) {
    await test(`PUT /compras/${compraId} (Solicitándose → En edición)`, async () => {
      const data = await req('PUT', `/compras/${compraId}`, { estado: 'En edición' });
      if (data.data.estado !== 'En edición') {
        throw new Error('El estado no se actualizó');
      }
      ok('Transición permitida');
    });
  }

  /* ---------- 8. Transición: En edición → Cancelado ---------- */
  if (compraId) {
    await test(`PUT /compras/${compraId} (En edición → Cancelado)`, async () => {
      const data = await req('PUT', `/compras/${compraId}`, { estado: 'Cancelado' });
      if (data.data.estado !== 'Cancelado') {
        throw new Error('El estado no se actualizó');
      }
      ok('Cancelación OK');
    });
  }

  /* ---------- 9. ERROR esperado: transición Cancelado → Realizado ---------- */
  if (compraId) {
    await test(`PUT /compras/${compraId} (Cancelado → Realizado debe fallar)`, async () => {
      try {
        await req('PUT', `/compras/${compraId}`, { estado: 'Realizado' }, 400);
        ok('Bloqueado con 400 como se esperaba');
      } catch (e) {
        throw new Error('La transición inválida NO fue bloqueada: ' + e.message);
      }
    });
  }

  /* ---------- 10. ERROR esperado: borrar producto con ventas ---------- */
  if (prodId && compraId) {
    await test(`DELETE /productos/${prodId} (debe fallar si tiene ventas)`, async () => {
      try {
        await req('DELETE', `/productos/${prodId}`, null, 400);
        ok('Bloqueado con 400 como se esperaba');
      } catch (e) {
        throw new Error('Se permitió borrar un producto con ventas: ' + e.message);
      }
    });
  }

  /* ---------- 11. ERROR esperado: borrar usuario con compras ---------- */
  if (usrId && compraId) {
    await test(`DELETE /usuarios/${usrId} (debe fallar si tiene compras)`, async () => {
      try {
        await req('DELETE', `/usuarios/${usrId}`, null, 400);
        ok('Bloqueado con 400 como se esperaba');
      } catch (e) {
        throw new Error('Se permitió borrar un usuario con compras: ' + e.message);
      }
    });
  }

  /* ---------- 12. DELETE compra Cancelada ---------- */
  if (compraId) {
    await test(`DELETE /compras/${compraId}`, async () => {
      await req('DELETE', `/compras/${compraId}`, undefined, 204);
      cleanup.compras = cleanup.compras.filter(id => id !== compraId);
      compraId = null;
      ok('Compra eliminada');
    });
  }

  /* ---------- 13. DELETE producto (ahora sin ventas) ---------- */
  if (prodId) {
    await test(`DELETE /productos/${prodId}`, async () => {
      await req('DELETE', `/productos/${prodId}`, undefined, 204);
      cleanup.productos = cleanup.productos.filter(id => id !== prodId);
      prodId = null;
      ok('Producto eliminado');
    });
  }

  /* ---------- 14. DELETE usuario (ahora sin compras) ---------- */
  if (usrId) {
    await test(`DELETE /usuarios/${usrId}`, async () => {
      await req('DELETE', `/usuarios/${usrId}`, undefined, 204);
      cleanup.usuarios = cleanup.usuarios.filter(id => id !== usrId);
      usrId = null;
      ok('Usuario eliminado');
    });
  }

  /* ---------- 15. ERROR: sin token ---------- */
  await test('GET /productos sin token → 401', async () => {
    const res = await fetch(`${API}/productos`);
    if (res.status !== 401) throw new Error(`Esperaba 401, llegó ${res.status}`);
    ok('Sin token → 401');
  });

  /* ---------- 16. ERROR: token inválido ---------- */
  await test('GET /productos con token falso → 403', async () => {
    const res = await fetch(`${API}/productos`, {
      headers: { 'Authorization': 'Bearer token-falso' },
    });
    if (res.status !== 403) throw new Error(`Esperaba 403, llegó ${res.status}`);
    ok('Token inválido → 403');
  });

  /* ---------- 17. ERROR: recurso inexistente ---------- */
  await test('GET /productos/99999999 → 404', async () => {
    const res = await fetch(`${API}/productos/99999999`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` },
    });
    if (res.status !== 404) throw new Error(`Esperaba 404, llegó ${res.status}`);
    ok('Recurso inexistente → 404');
  });

  /* ---------- 18. Paginación ---------- */
  await test('GET /productos?limit=1&offset=0', async () => {
    const data = await req('GET', '/productos?limit=1&offset=0');
    if (data.data.length > 1) throw new Error('No respetó el limit');
    if (data.paginacion?.limit !== 1) throw new Error('paginacion.limit incorrecto');
    ok('Paginación OK');
  });

  /* ---------------- Cleanup final ---------------- */
  await cleanupAll();
  reportar();
}

/* ============================================================
   CLEANUP — borra todo lo que quedó si algo falló
   ============================================================ */
async function cleanupAll() {
  for (const id of cleanup.compras) {
    try { await req('DELETE', `/compras/${id}`, undefined, 204); } catch {}
  }
  for (const id of cleanup.productos) {
    try { await req('DELETE', `/productos/${id}`, undefined, 204); } catch {}
  }
  for (const id of cleanup.usuarios) {
    try { await req('DELETE', `/usuarios/${id}`, undefined, 204); } catch {}
  }
}

/* ============================================================
   REPORTE FINAL
   ============================================================ */
function reportar() {
  console.log('\n' + c.bold('─'.repeat(50)));
  console.log(c.bold(`  Total pasos ejecutados: ${paso}`));
  console.log(c.bold(c.green(`  Exitosos: ${exitos}`)));
  if (fallos > 0) {
    console.log(c.bold(c.red(`  Fallos:   ${fallos}`)));
    console.log(c.bold('─'.repeat(50)));
    process.exit(1);
  }
  console.log(c.bold('─'.repeat(50)));
  console.log(c.bold(c.green('\n  ✔ TODAS LAS PRUEBAS PASARON\n')));
}

/* ---------------- Ejecutar ---------------- */
main().catch((error) => {
  console.error(c.red('\n💥 Error inesperado en el runner:'));
  console.error(error);
  process.exit(1);
});