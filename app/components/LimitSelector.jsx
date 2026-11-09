'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

/**
 * Selector de "filas por página" que recarga la URL al cambiar.
 *
 * - Es un Client Component porque necesita `useRouter` para navegar.
 * - Al cambiar el select, copia los searchParams actuales, actualiza
 *   `param` con el nuevo valor y hace un `router.push` con la nueva URL.
 * - El cambio de página se resetea a 1 (porque el tamaño cambió).
 */
export default function LimitSelector({
  param,          // nombre del query param (ej. "limit", "limitU", "limitP")
  pageParam,      // nombre del query param de página (ej. "pagina")
  options,        // array de números [10, 25, 50]
  defaultValue,
  label = 'Por página:',
  id,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (e) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(param, e.target.value);
    // Al cambiar el tamaño, volvemos a la primera página
    if (pageParam) params.delete(pageParam);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="limit-selector">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name={param}
        defaultValue={defaultValue}
        onChange={handleChange}
      >
        {options.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}