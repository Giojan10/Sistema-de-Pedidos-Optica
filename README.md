# 👓 Sistema de Pedidos — Óptica

> Aplicación web moderna de gestión de pedidos e inventario de marcos para gafas, construida con **Next.js (App Router)**, **PostgreSQL** y **Supabase**, e implementada con arquitectura full-stack (Server Actions y API REST externa).

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13%2B-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Storage%20%26%20DB-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployment-black?style=flat-square&logo=vercel)

---

## 📋 Tabla de Contenidos
1. [Funcionalidades Principales](#-funcionalidades-principales)
2. [Modelo de Datos & Reglas de Negocio](#-modelo-de-datos--reglas-de-negocio)
3. [Tecnologías Utilizadas](#-tecnologías-utilizadas)
4. [Estructura del Proyecto](#-estructura-del-proyecto)
5. [Requisitos Previos](#-requisitos-previos)
6. [Configuración Local](#-configuración-local)
7. [Despliegue en Producción (Vercel + Supabase)](#-despliegue-en-producción-vercel--supabase)
8. [Seguridad](#-seguridad)

---

## 🚀 Funcionalidades Principales

### 1. Autenticación y Roles
* **Autenticación Segura:** Inicio de sesión con usuario y contraseña (tokens JWT almacenados en cookies `HttpOnly`).
* **Registro Público:** Creación de cuentas independientes para nuevos clientes.
* **Roles Diferenciados:**
  * 👤 **Cliente:** Acceso al catálogo, carrito de compras y seguimiento en *"Mis Pedidos"*.
  * 🛠️ **Operario:** Gestión de catálogo, supervisión de pedidos e informes (tabular y consolidado).
  * 🛡️ **Administrador:** Control total (gestión de usuarios/maestro, productos y exportación de reportes a CSV).

### 2. Catálogo Interactivo
* Búsqueda en tiempo real por nombre.
* Filtros avanzados por color y rangos de precio.
* Ordenamiento dinámico.
* Soporte para imágenes de productos (vía URL externa o subida directa a **Supabase Storage**).
* Control de stock disponible en tiempo real.

### 3. Gestión de Pedidos y Carrito
* **Reserva automática:** El inventario se aparta en cuanto se agrega un producto al carrito.
* Ajuste flexible de cantidades con devolución automática de stock si se eliminan ítems.
* Transiciones de estado controladas: *Solicitándose* ➔ *En edición* ➔ *Realizado* / *Cancelado*.

### 4. Informes y Analítica
* **Informe Tabular:** Detalle línea a línea de transacciones con filtros cruzados por usuario, fecha, color, estado y precio; ordenable por cualquier columna.
* **Informe Consolidado:** Métricas agrupadas por color (unidades vendidas, precio promedio, ingresos totales e inventario disponible) con representación gráfica en barras.
* **Exportación CSV:** Descarga directa respetando los filtros activos (exclusivo para Administradores).

### 5. API REST Externa
* Endpoints seguros en `/api/datos` para integraciones de terceros.
* Autenticación mediante **API Key** (`Authorization: Bearer <token>`).
* Operaciones CRUD completas sobre usuarios, productos y compras.

---

## 🗄️ Modelo de Datos & Reglas de Negocio

| Tabla | Descripción Principal |
| :--- | :--- |
| **`usuarios`** | Cuentas de usuario con roles (Cliente, Operario, Administrador) y datos de contacto. |
| **`productos`** | Marcos para gafas, gestionando inventario disponible/apartado, precios e imágenes. |
| **`compras`** | Cabecera de pedidos asociados a un usuario con control de estado y marca de tiempo. |
| **`compras_detalle`** | Líneas individuales de cada pedido (con precio unitario congelado al momento de la compra). |
| **`api_keys`** | Tokens de acceso autorizados para la API externa. |

> 💡 **Reglas de Negocio Clave:**
> 1. Un usuario solo puede tener **un pedido abierto** (`Solicitándose` o `En edición`) de forma simultánea.
> 2. Los estados `Realizado` y `Cancelado` son definitivos (inmutables).
> 3. Los productos y usuarios con historial transaccional **no se eliminan físicamente**, se gestionan mediante *soft delete* (desactivación).

---

## 🛠️ Tecnologías Utilizadas

* **Framework:** [Next.js 16](https://nextjs.org/) (App Router + Server Actions)
* **UI Library:** [React 19](https://react.dev/)
* **Base de Datos & Almacenamiento:** [PostgreSQL](https://www.postgresql.org/) & [Supabase](https://supabase.com/)
* **Seguridad:** `bcryptjs` (hasheo) & `jsonwebtoken` (sesiones)
* **Hosting:** [Vercel](https://vercel.com/)
* **Estilos:** CSS Puro modular

---

## 📂 Estructura del Proyecto

```text
app/
├── actions.js                  # Server Actions (Auth, Carrito, Maestro)
├── layout.jsx                  # Layout raíz y metadatos
├── globals.css                 # Estilos globales de la aplicación
├── page.jsx                    # Redirección inteligente según sesión
├── api/datos/                  # API REST externa (CRUD completo)
├── catalogo/                   # Vista de catálogo y filtros
├── pedido/                     # Carrito de compras activo
├── mis-pedidos/                # Historial de compras (Cliente)
├── informe-tabular/            # Reporte detallado (Operario / Admin)
├── informe-consolidado/        # Reporte métrico y gráfico (Operario / Admin)
├── maestro/                    # Panel de administración de usuarios y productos
├── login/ & registro/          # Vistas de autenticación
└── components/                 # Componentes reutilizables (Navbar, Notice, etc.)

src/
├── db.js                       # Pool de conexiones a PostgreSQL
├── data.js                     # Consultas SQL optimizadas
├── session.js                  # Lógica de sesiones y Guards por rol
├── supabase.js                 # Cliente de Supabase Storage
├── apiAuth.js & apiHelpers.js  # Utilidades para la API REST
└── ...

database/
└── schema.sql                  # Esquema DDL de la base de datos y datos iniciales