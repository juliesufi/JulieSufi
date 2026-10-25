import nodemailer from "nodemailer";

/** Every public enquiry form notifies this mailbox. */
export const ENQUIRY_TO_EMAIL = "contact@juliesufi.com";

/** Loopback gateway inside GoDaddy Node.js Hosting. Outbound SMTP is blocked there. */
const EMAIL_GATEWAY_URL = "http://127.0.0.1:2525/api/email/send";

export type EnquiryEmail = {
  name: string;
  email: string;
  phone: string;
  message: string;
  kind: string;
  productUrl: string;
};

type EnquiryMessage = {
  to: string;
  replyTo: string;
  subject: string;
  text: string;
};

function oneLine(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function enquiryMessage(enquiry: EnquiryEmail): EnquiryMessage {
  const kind = oneLine(enquiry.kind) || "Enquiry";
  const name = oneLine(enquiry.name);
  const lines = [
    `Name: ${enquiry.name}`,
    `Email: ${enquiry.email}`,
    `Phone: ${enquiry.phone}`,
    `Enquiry type: ${enquiry.kind}`,
  ];
  if (enquiry.productUrl) lines.push(`Gown link: ${enquiry.productUrl}`);
  lines.push("", enquiry.message);
  return {
    to: ENQUIRY_TO_EMAIL,
    replyTo: oneLine(enquiry.email),
    subject: `New ${kind} from ${name}`.slice(0, 200),
    text: lines.join("\n"),
  };
}

type GatewayResponse = {
  success?: boolean;
  messageId?: string;
  error?: string;
};

async function sendViaGateway(message: EnquiryMessage) {
  let response: Response;
  try {
    response = await fetch(EMAIL_GATEWAY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: [message.to],
        subject: message.subject,
        text: message.text,
        replyTo: message.replyTo,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`email gateway unreachable: ${reason}`);
  }
  let body: GatewayResponse;
  try {
    body = (await response.json()) as GatewayResponse;
  } catch {
    body = { success: false, error: `non-JSON response (HTTP ${response.status})` };
  }
  if (!response.ok || !body.success || !body.messageId) {
    throw new Error(`email send failed: ${body.error ?? `HTTP ${response.status}`}`);
  }
}

async function sendViaSmtp(message: EnquiryMessage) {
  const pass = process.env.SMTP_PASSWORD?.replace(/\s/g, "");
  if (!pass) {
    console.error(
      "Enquiry saved without email: set SMTP_PASSWORD so messages can be sent to " +
        ENQUIRY_TO_EMAIL,
    );
    return;
  }
  const user = process.env.SMTP_USER || ENQUIRY_TO_EMAIL;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || "465");
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  await transport.sendMail({
    from: user,
    to: message.to,
    replyTo: message.replyTo,
    subject: message.subject,
    text: message.text,
  });
}

export async function sendEnquiryEmail(enquiry: EnquiryEmail) {
  const message = enquiryMessage(enquiry);
  // Hosted apps always have PORT. That container cannot open Gmail's SMTP ports.
  if (process.env.PORT) {
    try {
      await sendViaGateway(message);
      return;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("email gateway unreachable:")) throw error;
      console.error(error);
    }
  }
  await sendViaSmtp(message);
}
