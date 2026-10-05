import './globals.css';

export const metadata = {
  title: 'Sistema de pedidos · Óptica',
  description: 'Catálogo, pedidos e informes para óptica.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
