"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const mailtrap_1 = require("mailtrap");
const MAILTRAP_TOKEN = process.env.MAILTRAP_TOKEN || "260fdef4ed451e4b8a2037ebf7e3b562";
const MAILTRAP_ENDPOINT = "https://send.api.mailtrap.io";
const fromEmail = process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    process.env.MAIL_FROM ||
    "support@mailtrap.io";
const fromName = process.env.MAIL_FROM_NAME || "CareLink Support";
const mailtrapClient = new mailtrap_1.MailtrapClient({
    token: MAILTRAP_TOKEN,
    endpoint: MAILTRAP_ENDPOINT,
});
const sendEmail = async (to, subject, html) => {
    await mailtrapClient.send({
        from: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        subject,
        html,
    });
    console.log("EMAIL SENT VIA MAILTRAP TO", to);
};
exports.sendEmail = sendEmail;
