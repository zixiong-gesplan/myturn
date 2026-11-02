"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicConfig, PublicQueue } from "../../shared/types.ts";
import { api } from "../api.ts";

export function PantallaPage() {
  const [queue, setQueue] = useState<PublicQueue | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [sound, setSound] = useState(false);
  const [flash, setFlash] = useState(false);
  const etag = useRef<string | undefined>(undefined);
  const previous = useRef<string | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  useEffect(() => {
    api.publicConfig().then((r) => setConfig(r.data));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await api.publicQueue(etag.current);
      if (cancelled) return;
      etag.current = result.etag;
      if (result.notModified || !result.data) return;
      const next = result.data;
      if (previous.current && next.currentDisplayNumber && previous.current !== next.currentDisplayNumber) {
        setFlash(true);
        window.setTimeout(() => setFlash(false), 1600);
        if (sound) playTone();
      }
      previous.current = next.currentDisplayNumber;
      setQueue(next);
    }
    void load();
    const id = window.setInterval(load, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sound]);

  function playTone() {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx.current ??= new Ctx();
    const ctx = audioCtx.current;
    void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  }

  return (
    <div
      className={`flex min-h-screen flex-col bg-navy-dark text-white ${flash ? "ring-8 ring-amber-300" : ""}`}
    >
      <div className="flex items-center justify-between px-6 py-4 text-lg">
        <p className="font-semibold">{config?.establishmentName || "MiTurno"}</p>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            className="rounded border border-white/30 px-3 py-1"
            onClick={() => {
              setSound((v) => !v);
              playTone();
            }}
          >
            Sonido: {sound ? "activado" : "desactivado"}
          </button>
          <button type="button" className="rounded border border-white/30 px-3 py-1" onClick={toggleFullscreen}>
            Pantalla completa
          </button>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-2xl tracking-[0.3em] text-white/70 sm:text-4xl">TURNO ACTUAL</p>
        <p className="mt-4 font-bold tabular-nums" style={{ fontSize: "clamp(4rem, 18vw, 14rem)", lineHeight: 1 }}>
          {queue?.currentDisplayNumber ?? "—"}
        </p>
        <p className="mt-10 text-xl tracking-[0.25em] text-white/70 sm:text-3xl">SIGUIENTE EN ESPERA</p>
        <p className="mt-3 font-semibold tabular-nums text-emerald-300" style={{ fontSize: "clamp(2rem, 8vw, 6rem)" }}>
          {queue?.nextDisplayNumber ?? "—"}
        </p>
        {queue?.isPaused ? <p className="mt-8 text-amber-200">Cola en pausa operativa</p> : null}
      </div>
    </div>
  );
}
