import nodemailer from "nodemailer";
// Mailtrap SDK is optional—loaded dynamically to allow environments where the
// dependency is installed manually.
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-var-requires
let MailtrapClient: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  MailtrapClient = require("mailtrap").MailtrapClient;
} catch {
  MailtrapClient = null;
}

const MAILTRAP_TOKEN =
  process.env.MAILTRAP_TOKEN || "260fdef4ed451e4b8a2037ebf7e3b562";
const MAILTRAP_ENDPOINT = "https://send.api.mailtrap.io";

// Support both SMTP_* and EMAIL_* environment naming for optional overrides.
const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 587;
const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
const smtpPass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD;

const fromEmail =
  process.env.SMTP_FROM ||
  process.env.EMAIL_FROM ||
  process.env.MAIL_FROM ||
  "support@mailtrap.io";
const fromName = process.env.MAIL_FROM_NAME || "CareLink Support";

const mailtrapClient =
  MAILTRAP_TOKEN && MailtrapClient
    ? new MailtrapClient({ token: MAILTRAP_TOKEN, endpoint: MAILTRAP_ENDPOINT })
    : null;

const transporter =
  smtpHost || smtpUser || smtpPass
    ? nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // common TLS port
        auth:
          smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      })
    : null;

export const sendEmail = async (to: string, subject: string, html: string) => {
  if (mailtrapClient) {
    await mailtrapClient.send({
      from: { email: fromEmail, name: fromName },
      to: [{ email: to }],
      subject,
      html,
    });
    console.log("EMAIL SENT VIA MAILTRAP TO", to);
    return;
  }

  if (!transporter) {
    throw new Error("Email transport is not configured.");
  }

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
  });
  console.log("EMAIL SENT VIA SMTP TO", to);
};
