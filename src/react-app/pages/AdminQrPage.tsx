"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "../api.ts";
import { AdminShell } from "../components/AdminShell.tsx";

export function AdminQrPage() {
  const [url, setUrl] = useState("/turno");
  const [png, setPng] = useState<string>("");
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    setUrl(`${window.location.origin}/turno`);
    api
      .settings()
      .then((r) => {
        const configured = String(r.data.settings.publicBaseUrl || "").replace(/\/$/, "");
        if (configured) setUrl(`${configured}/turno`);
      })
      .catch(() => {
        /* operators can still generate with the current origin */
      });
  }, []);

  useEffect(() => {
    void QRCode.toDataURL(url, { width: 512, margin: 1 }).then(setPng);
    void QRCode.toString(url, { type: "svg", margin: 1 }).then(setSvg);
  }, [url]);

  function download(filename: string, href: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
  }

  return (
    <AdminShell title="Código QR">
      <p className="text-muted">
        El QR apunta a la solicitud pública de turno. No incluye datos personales ni credenciales.
      </p>
      <label className="mt-4 block text-sm">
        URL pública
        <input className="mt-1 w-full max-w-xl rounded border px-3 py-2" value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          {png ? <img src={png} alt="Código QR para solicitar turno" className="mx-auto h-64 w-64" /> : <p>Generando…</p>}
          <div className="mt-4 flex gap-2">
            <button className="rounded bg-navy px-3 py-2 text-white" onClick={() => download("miturno-turno.png", png)}>
              Descargar PNG
            </button>
            <button
              className="rounded border px-3 py-2"
              onClick={() =>
                download("miturno-turno.svg", `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
              }
            >
              Descargar SVG
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center" id="print-qr">
          <p className="text-2xl font-bold tracking-wide text-navy">SOLICITA TU TURNO</p>
          {png ? <img src={png} alt="" className="mx-auto my-6 h-56 w-56" /> : null}
          <p>Escanea este código QR con tu móvil.</p>
          <p className="mt-2">Introduce tu nombre y correo y recibirás tu número de turno.</p>
          <button className="mt-6 rounded border px-3 py-2" onClick={() => window.print()}>
            Imprimir plantilla
          </button>
        </div>
      </div>
    </AdminShell>
  );
}
