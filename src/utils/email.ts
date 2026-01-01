import nodemailer from "nodemailer";

// Support both SMTP_* and EMAIL_* environment naming.
const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
const smtpPort =
  Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 587;
const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
const smtpPass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD;

// Prefer explicit FROM, fall back to the authenticated user.
const fromAddress =
  process.env.SMTP_FROM || process.env.EMAIL_FROM || smtpUser || "";

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465, // common TLS port
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  await transporter.sendMail({
    from: `"CareLink Support" <${fromAddress}>`,
    to,
    subject,
    html,
  });
  console.log("EMAIL SENT TO", to);
};
