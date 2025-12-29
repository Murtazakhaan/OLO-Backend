import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 587;
const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
const smtpPass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD;
const smtpFrom = process.env.SMTP_FROM || process.env.EMAIL_FROM || smtpUser;

const isEmailConfigured = Boolean(smtpHost && smtpUser && smtpPass);

const transporter = isEmailConfigured
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })
  : null;

export const sendEmail = async (to: string, subject: string, html: string) => {
  if (!transporter) {
    console.warn("Email transport not configured; skipping send", {
      to,
      subject,
    });
    return;
  }

  try {
    await transporter.sendMail({
      from: `"CareLink Support" <${smtpFrom}>`,
      to,
      subject,
      html,
    });
    console.log("EMAIL SENT TO", to);
  } catch (error) {
    console.error("Failed to send email", error);
    throw error;
  }
};
