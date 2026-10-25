import nodemailer from "nodemailer";

/** Every public enquiry form notifies this mailbox. */
export const ENQUIRY_TO_EMAIL = "contact@juliesufi.com";

export type EnquiryEmail = {
  name: string;
  email: string;
  phone: string;
  message: string;
  kind: string;
  productUrl: string;
};

function oneLine(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export async function sendEnquiryEmail(enquiry: EnquiryEmail) {
  const pass = process.env.SMTP_PASSWORD;
  if (!pass) {
    console.error(
      "Enquiry saved without email: set SMTP_PASSWORD so messages can be sent to " +
        ENQUIRY_TO_EMAIL,
    );
    return;
  }
  const user = process.env.SMTP_USER || ENQUIRY_TO_EMAIL;
  const host = process.env.SMTP_HOST || "smtpout.secureserver.net";
  const port = Number(process.env.SMTP_PORT || "465");
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
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
  await transport.sendMail({
    from: user,
    to: ENQUIRY_TO_EMAIL,
    replyTo: oneLine(enquiry.email),
    subject: `New ${kind} from ${name}`.slice(0, 200),
    text: lines.join("\n"),
  });
}
