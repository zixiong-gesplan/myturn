import { describe, expect, it } from "vitest";
import { isWhatsAppSendingAllowed, whatsappSkipReason } from "../src/shared/whatsapp-policy.ts";

const off = {
  enabled: false,
  paidMessagesAllowed: false,
  accessTokenConfigured: false,
  phoneNumberIdConfigured: false,
  templateName: "turno_confirmado",
};

describe("política WhatsApp", () => {
  it("no envía cuando está desactivado", () => {
    expect(isWhatsAppSendingAllowed(off)).toBe(false);
    expect(whatsappSkipReason(off)).toBe("disabled");
  });
  it("no envía aunque esté enabled si no se permiten mensajes de pago", () => {
    const flags = { ...off, enabled: true, accessTokenConfigured: true, phoneNumberIdConfigured: true };
    expect(isWhatsAppSendingAllowed(flags)).toBe(false);
    expect(whatsappSkipReason(flags)).toBe("paid_not_allowed");
  });
  it("solo permite envío con flags explícitos y credenciales", () => {
    expect(
      isWhatsAppSendingAllowed({
        enabled: true,
        paidMessagesAllowed: true,
        accessTokenConfigured: true,
        phoneNumberIdConfigured: true,
        templateName: "turno_confirmado",
      }),
    ).toBe(true);
  });
});
