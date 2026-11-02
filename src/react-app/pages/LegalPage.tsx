import { PublicLayout } from "../components/PublicLayout.tsx";

export function LegalPage() {
  return (
    <PublicLayout title="Aviso legal">
      <article className="max-w-3xl space-y-4 text-sm leading-6">
        <p>
          MiTurno es una aplicación de gestión de turnos. La identidad del titular del servicio debe configurarse en
          los ajustes del establecimiento. Esta página no inventa un nombre comercial, NIF ni domicilio.
        </p>
        <p>
          El uso del panel de administración queda reservado al personal autorizado. Queda prohibido el acceso no
          autorizado, la enumeración de turnos ajenos y cualquier uso contrario a la ley.
        </p>
        <p>
          Aspectos que requieren revisión jurídica antes de producción: condiciones de uso, encargos de tratamiento,
          cláusula de limitación de responsabilidad y, si se usa un dominio propio, datos de inscripción y
          identificadores fiscales.
        </p>
      </article>
    </PublicLayout>
  );
}
