import { MailtrapClient } from "mailtrap";

const MAILTRAP_TOKEN =
  process.env.MAILTRAP_TOKEN || "260fdef4ed451e4b8a2037ebf7e3b562";
const MAILTRAP_ENDPOINT = "https://send.api.mailtrap.io";

const fromEmail =
  process.env.SMTP_FROM ||
  process.env.EMAIL_FROM ||
  process.env.MAIL_FROM ||
  "support@mailtrap.io";
const fromName = process.env.MAIL_FROM_NAME || "CareLink Support";

const mailtrapClient = new MailtrapClient({
  token: MAILTRAP_TOKEN,
  endpoint: MAILTRAP_ENDPOINT,
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  await mailtrapClient.send({
    from: { email: fromEmail, name: fromName },
    to: [{ email: to }],
    subject,
    html,
  });
  console.log("EMAIL SENT VIA MAILTRAP TO", to);
};
