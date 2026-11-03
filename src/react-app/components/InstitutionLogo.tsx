import Image from "next/image";

export function InstitutionLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-gobierno-canarias.png"
      alt="Gobierno de Canarias — Consejería de Transición Ecológica y Energía"
      width={519}
      height={105}
      priority
      className={className ?? "mx-auto mb-6 h-auto w-full max-w-[420px]"}
    />
  );
}
