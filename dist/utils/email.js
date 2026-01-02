"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
// Support both SMTP_* and EMAIL_* environment naming.
const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 587;
const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
const smtpPass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD;
// Prefer explicit FROM, fall back to the authenticated user.
const fromAddress = process.env.SMTP_FROM || process.env.EMAIL_FROM || smtpUser || "";
const transporter = nodemailer_1.default.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // common TLS port
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
});
const sendEmail = async (to, subject, html) => {
    await transporter.sendMail({
        from: `"CareLink Support" <${fromAddress}>`,
        to,
        subject,
        html,
    });
    console.log("EMAIL SENT TO", to);
};
exports.sendEmail = sendEmail;
