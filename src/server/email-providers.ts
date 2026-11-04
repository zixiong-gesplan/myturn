export type EmailProviderAttempt = {
  provider: "resend" | "brevo" | null;
  status: "accepted" | "failed" | "skipped";
  providerMessageId: string | null;
  errorCode: string | null;
};

type SendEmailInput = {
  resendApiKey?: string;
  brevoApiKey?: string;
  from?: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

async function attemptProvider(
  provider: "resend" | "brevo",
  apiKey: string,
  input: SendEmailInput,
): Promise<EmailProviderAttempt> {
  const isResend = provider === "resend";
  try {
    const response = await fetch(
      isResend ? "https://api.resend.com/emails" : "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: isResend
          ? {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            }
          : {
              "api-key": apiKey,
              "Content-Type": "application/json",
            },
        body: JSON.stringify(isResend
          ? {
              from: input.from,
              to: [input.to],
              subject: input.subject,
              text: input.text,
              html: input.html,
            }
          : {
              sender: { email: input.from },
              to: [{ email: input.to }],
              subject: input.subject,
              textContent: input.text,
              htmlContent: input.html,
            }),
        signal: AbortSignal.timeout(8000),
      },
    );
    const responseText = await response.text();
    let messageId: string | null = null;
    if (responseText) {
      try {
        const payload = JSON.parse(responseText) as { id?: string; messageId?: string };
        messageId = (isResend ? payload.id : payload.messageId) ?? null;
      } catch {
        messageId = null;
      }
    }
    if (response.ok && messageId) {
      return { provider, status: "accepted", providerMessageId: messageId, errorCode: null };
    }
    return {
      provider,
      status: "failed",
      providerMessageId: messageId,
      errorCode: response.ok ? "invalid_provider_response" : `provider_${response.status}`,
    };
  } catch (cause) {
    return {
      provider,
      status: "failed",
      providerMessageId: null,
      errorCode: cause instanceof Error && cause.name === "TimeoutError" ? "timeout" : "network",
    };
  }
}

export async function sendEmailWithFallback(input: SendEmailInput): Promise<EmailProviderAttempt[]> {
  const attempts: EmailProviderAttempt[] = [];
  if (!input.from) {
    return [{
      provider: null,
      status: "skipped",
      providerMessageId: null,
      errorCode: "missing_sender",
    }];
  }

  if (input.resendApiKey) {
    const attempt = await attemptProvider("resend", input.resendApiKey, input);
    attempts.push(attempt);
    if (attempt.status === "accepted") return attempts;
  }

  if (input.brevoApiKey) {
    const attempt = await attemptProvider("brevo", input.brevoApiKey, input);
    attempts.push(attempt);
    if (attempt.status === "accepted") return attempts;
  }

  if (!attempts.length) {
    attempts.push({
      provider: null,
      status: "skipped",
      providerMessageId: null,
      errorCode: "missing_provider_api_key",
    });
  }
  return attempts;
}
