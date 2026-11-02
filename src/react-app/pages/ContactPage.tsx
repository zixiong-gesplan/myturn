"use client";

import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { PublicLayout } from "../components/PublicLayout.tsx";

export function ContactPage() {
  const [info, setInfo] = useState({ name: "", email: "", address: "" });
  useEffect(() => {
    api.publicConfig().then((r) =>
      setInfo({
        name: r.data.dataControllerName,
        email: r.data.contactEmail,
        address: r.data.contactPostalAddress,
      }),
    );
  }, []);

  return (
    <PublicLayout title="Contacto del responsable">
      {info.email ? (
        <div className="max-w-xl rounded-xl bg-white p-5 text-sm shadow-sm">
          <p>
            <strong>{info.name || "Responsable del tratamiento"}</strong>
          </p>
          <p className="mt-2">
            Correo: <a className="underline" href={`mailto:${info.email}`}>{info.email}</a>
          </p>
          {info.address ? <p className="mt-2">Dirección: {info.address}</p> : null}
        </div>
      ) : (
        <p className="rounded-xl bg-amber-50 p-4 text-sm">
          El establecimiento aún no ha publicado un contacto del responsable. Configúralo en el panel de
          administración antes de tratar datos de clientes en producción.
        </p>
      )}
    </PublicLayout>
  );
}
