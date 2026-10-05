export default function Notice({ searchParams }) {
  if (searchParams.error) return <p className="alerta error">{searchParams.error}</p>;
  if (searchParams.mensaje) return <p className="alerta">{searchParams.mensaje}</p>;
  return null;
}
