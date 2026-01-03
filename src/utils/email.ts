import nodemailer from "nodemailer";

const fromEmail =
  process.env.SMTP_FROM ||
  process.env.EMAIL_FROM ||
  process.env.MAIL_FROM ||
  "support@mailtrap.io";
const fromName = process.env.MAIL_FROM_NAME || "CareLink Support";

const smtpHost = process.env.MAILTRAP_SMTP_HOST || process.env.EMAIL_HOST;
const smtpPortRaw = process.env.MAILTRAP_SMTP_PORT || process.env.EMAIL_PORT || "587";
const smtpUser = process.env.MAILTRAP_SMTP_USER || process.env.EMAIL_USER;
const smtpPass = process.env.MAILTRAP_SMTP_PASS || process.env.EMAIL_PASSWORD;

if (!smtpHost || !smtpUser || !smtpPass) {
  throw new Error("SMTP credentials are required to send email.");
}

const smtpPort = Number(smtpPortRaw);
const smtpSecure = smtpPort === 465;

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  await transporter.sendMail({
    from: { name: fromName, address: fromEmail },
    to,
    subject,
    html,
  });
  console.log("EMAIL SENT VIA SMTP TO", to);
};
