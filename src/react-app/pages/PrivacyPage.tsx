"use client";

import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { PublicLayout } from "../components/PublicLayout.tsx";

export function PrivacyPage() {
  const [controller, setController] = useState({ name: "", email: "", address: "", version: "1.0" });
  useEffect(() => {
    api.publicConfig().then((r) => {
      setController({
        name: r.data.dataControllerName,
        email: r.data.contactEmail,
        address: r.data.contactPostalAddress,
        version: r.data.privacyPolicyVersion,
      });
    });
  }, []);

  return (
    <PublicLayout title="Política de privacidad">
      <article className="prose max-w-3xl space-y-4 text-sm leading-6">
        <p>Versión {controller.version}. Esta política describe el tratamiento de datos para la gestión de turnos.</p>
        <h2 className="text-lg font-semibold text-navy">Responsable</h2>
        {controller.name && controller.email ? (
          <p>
            {controller.name}. Contacto: {controller.email}
            {controller.address ? `. Dirección: ${controller.address}` : ""}
          </p>
        ) : (
          <p className="rounded bg-amber-50 p-3">
            El responsable del tratamiento aún no ha sido configurado por el establecimiento. No se inventa aquí una
            identidad. Complétalo en Administración → Ajustes antes de poner el servicio en producción.
          </p>
        )}
        <h2 className="text-lg font-semibold text-navy">Datos y finalidad</h2>
        <p>
          Tratamos nombre y teléfono para asignar un turno, permitir su seguimiento privado y, solo si lo autorizas y
          el canal está realmente habilitado, enviarte un aviso por la API oficial de WhatsApp Business de Meta.
        </p>
        <h2 className="text-lg font-semibold text-navy">Base jurídica</h2>
        <p>
          La gestión del turno se basa en la ejecución de una solicitud que tú inicias. El envío por WhatsApp, si llega
          a activarse, se basa en tu consentimiento, que está desmarcado por defecto.
        </p>
        <h2 className="text-lg font-semibold text-navy">Conservación</h2>
        <p>
          Los datos personales se eliminan o anonimizan a los 7 días desde la finalización del turno (atendido, ausente
          o cancelado). El número de turno se conserva de forma anónima para no reutilizar numeración.
        </p>
        <h2 className="text-lg font-semibold text-navy">Destinatarios</h2>
        <p>
          El personal autorizado del establecimiento. Si WhatsApp está activo, Meta trata el número y el contenido del
          mensaje según sus condiciones. El alojamiento previsto es Vercel y la base de datos se aloja en Turso.
        </p>
        <h2 className="text-lg font-semibold text-navy">Derechos</h2>
        <p>
          Puedes solicitar acceso, rectificación, supresión, limitación, oposición y portabilidad ante el responsable,
          y reclamar ante la Agencia Española de Protección de Datos.
        </p>
        <h2 className="text-lg font-semibold text-navy">Revisión jurídica pendiente</h2>
        <p>
          Este texto es una base técnica. Antes de producción debe revisarlo un profesional: registro de actividades,
          encargos de tratamiento con Vercel, Turso y Meta, evaluación de bases jurídicas, textos de capa informativa y
          cláusulas contractuales.
        </p>
      </article>
    </PublicLayout>
  );
}
