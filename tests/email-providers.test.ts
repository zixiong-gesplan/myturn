import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmailWithFallback } from "../src/server/email-providers.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fallback de proveedores de correo", () => {
  it("usa Brevo cuando Resend rechaza el mensaje", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("quota exceeded", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messageId: "brevo-id" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const attempts = await sendEmailWithFallback({
      resendApiKey: "resend-test",
      brevoApiKey: "brevo-test",
      from: "turnos@example.es",
      to: "cliente@example.es",
      subject: "Tu turno",
      text: "Acude al puesto",
      html: "<p>Acude al puesto</p>",
    });

    expect(attempts).toEqual([
      { provider: "resend", status: "failed", providerMessageId: null, errorCode: "provider_429" },
      { provider: "brevo", status: "accepted", providerMessageId: "brevo-id", errorCode: null },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.brevo.com/v3/smtp/email");
    const brevoRequest = fetchMock.mock.calls[1][1] as RequestInit;
    expect(new Headers(brevoRequest.headers).get("api-key")).toBe("brevo-test");
    expect(JSON.parse(String(brevoRequest.body))).toMatchObject({
      sender: { email: "turnos@example.es" },
      to: [{ email: "cliente@example.es" }],
      subject: "Tu turno",
    });
  });

  it("no intenta Brevo si Resend acepta el mensaje", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "resend-id" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const attempts = await sendEmailWithFallback({
      resendApiKey: "resend-test",
      brevoApiKey: "brevo-test",
      from: "turnos@example.es",
      to: "cliente@example.es",
      subject: "Tu turno",
      text: "Acude al puesto",
      html: "<p>Acude al puesto</p>",
    });

    expect(attempts).toEqual([
      { provider: "resend", status: "accepted", providerMessageId: "resend-id", errorCode: null },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("registra que no hay proveedor configurado", async () => {
    const attempts = await sendEmailWithFallback({
      from: "turnos@example.es",
      to: "cliente@example.es",
      subject: "Tu turno",
      text: "Acude al puesto",
      html: "<p>Acude al puesto</p>",
    });

    expect(attempts).toEqual([
      { provider: null, status: "skipped", providerMessageId: null, errorCode: "missing_provider_api_key" },
    ]);
  });
});
