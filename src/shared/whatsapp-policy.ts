export type WhatsAppFlags = {
  enabled: boolean;
  paidMessagesAllowed: boolean;
  accessTokenConfigured: boolean;
  phoneNumberIdConfigured: boolean;
  templateName: string;
};

export function parseBoolFlag(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function isWhatsAppSendingAllowed(flags: WhatsAppFlags): boolean {
  return (
    flags.enabled &&
    flags.paidMessagesAllowed &&
    flags.accessTokenConfigured &&
    flags.phoneNumberIdConfigured &&
    flags.templateName.length > 0
  );
}

export function whatsappSkipReason(flags: WhatsAppFlags): string | null {
  if (!flags.enabled) return "disabled";
  if (!flags.paidMessagesAllowed) return "paid_not_allowed";
  if (!flags.accessTokenConfigured || !flags.phoneNumberIdConfigured) return "not_configured";
  if (!flags.templateName) return "missing_template";
  return null;
}
