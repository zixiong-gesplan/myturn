import type { Metadata } from "next";
import "../react-app/index.css";

export const metadata: Metadata = {
  title: "MiTurno",
  description: "Gestión de turnos y cola de atención",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
