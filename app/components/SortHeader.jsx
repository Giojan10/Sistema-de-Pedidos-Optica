import Link from 'next/link';

/**
 * Encabezado de tabla clickeable.
 *
 * Props:
 * - `column`   : clave interna del orden (ej. "fecha")
 * - `label`    : texto visible
 * - `current`  : { orden, direccion } actuales
 * - `baseQuery`: objeto con el resto de los filtros (se preservan)
 * - `basePath` : ruta base (ej. "/informe-tabular")
 */
export default function SortHeader({ column, label, current, baseQuery, basePath }) {
  const isActive = current.orden === column;
  const nextDir = isActive && current.direccion === 'asc' ? 'desc' : 'asc';

  const params = new URLSearchParams(
    Object.entries({ ...baseQuery, orden: column, direccion: nextDir })
      .filter(([, v]) => v !== '' && v != null && v !== 'Todos')
  );

  const arrow = isActive
    ? (current.direccion === 'asc' ? ' ▲' : ' ▼')
    : '';

  return (
    <th>
      <Link
        href={`${basePath}?${params.toString()}`}
        className={`sort-link${isActive ? ' active' : ''}`}
        title={isActive ? `Cambiar a ${nextDir}` : 'Ordenar por esta columna'}
      >
        {label}{arrow}
      </Link>
    </th>
  );
}