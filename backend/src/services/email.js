import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter;

function getTransporter() {
  if (!config.smtpUrl || !config.emailFrom) return null;
  if (!transporter) transporter = nodemailer.createTransport(config.smtpUrl);
  return transporter;
}

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

export async function sendEmail({ to, subject, text, html }) {
  const mailer = getTransporter();
  if (!mailer) {
    const error = new Error('Email delivery is not configured.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }
  await mailer.sendMail({ from: config.emailFrom, to, subject, text, html });
}

export async function sendVerificationEmail({ to, name, token }) {
  const url = `${config.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    subject: 'Verify your FaithHaven email address',
    text: `Hello ${name}, verify your FaithHaven account: ${url}`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>Please <a href="${url}">verify your FaithHaven account</a>. This link expires in 24 hours.</p>`,
  });
}

export async function sendPasswordResetEmail({ to, name, token }) {
  const url = `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    subject: 'Reset your FaithHaven password',
    text: `Hello ${name}, reset your FaithHaven password: ${url}`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>Use this <a href="${url}">secure password reset link</a> within 30 minutes. If you did not request it, you may ignore this message.</p>`,
  });
}

export async function sendWelcomeEmail({ to, name }) {
  return sendEmail({
    to,
    subject: 'Welcome to FaithHaven',
    text: `Welcome to FaithHaven, ${name}.`,
    html: `<p>Welcome to FaithHaven, ${escapeHtml(name)}.</p><p>Thank you for joining our community.</p>`,
  });
}
