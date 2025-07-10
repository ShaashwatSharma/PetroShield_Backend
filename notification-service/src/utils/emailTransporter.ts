import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export function createTransporter() {
  if (process.env.USE_MAILHOG === "true") {
    console.log("🚀 Using MailHog for local email testing (inside Docker).");
    return nodemailer.createTransport({
      host: "mailhog", // ⚡ Service name in docker-compose
      port: 1025,
      secure: false,
    });
  }

  console.log("🚀 Using SMTP transporter (e.g., AWS SES).");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}