"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
// Default Mailtrap configuration (token provided for testing).
const MAILTRAP_TOKEN = process.env.MAILTRAP_TOKEN || "260fdef4ed451e4b8a2037ebf7e3b562";
const DEFAULT_MAILTRAP_CONFIG = {
    host: "live.smtp.mailtrap.io",
    port: 587,
    auth: { user: "api", pass: MAILTRAP_TOKEN },
};
// Support both SMTP_* and EMAIL_* environment naming, falling back to Mailtrap.
const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || DEFAULT_MAILTRAP_CONFIG.host;
const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || DEFAULT_MAILTRAP_CONFIG.port;
const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || DEFAULT_MAILTRAP_CONFIG.auth.user;
const smtpPass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD || DEFAULT_MAILTRAP_CONFIG.auth.pass;
// Prefer explicit FROM; fall back to a sensible default rather than the auth user.
const fromAddress = process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    process.env.MAIL_FROM ||
    "support@mailtrap.io";
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
