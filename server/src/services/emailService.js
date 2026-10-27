require('dotenv').config();
const nodemailer = require('nodemailer');

const getBrevoKey = () => process.env.BREVO_API_KEY;
const SMTP_USER = process.env.SMTP_USER;
const EMAIL_FROM = process.env.EMAIL_FROM || 'VorldX Attendance <vorldxdesign@gmail.com>';

const getEmailSender = () => {
  const match = EMAIL_FROM.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match
    ? { name: match[1] || 'VorldX Attendance System', email: match[2] }
    : { name: 'VorldX Attendance System', email: EMAIL_FROM.trim() };
};

/**
 * Send Email via Brevo API / SMTP
 */
const sendOtpEmail = async (toEmail, otp, purpose = 'Verification') => {
  if (!toEmail) return false;
  const key = getBrevoKey();
  if (!key) {
    console.error('[Email Error] BREVO_API_KEY must be configured to send email.');
    return false;
  }

  // 1. Try Brevo REST API first
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': key,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: getEmailSender(),
        to: [{ email: toEmail }],
        subject: `[VorldX] Your ${purpose} One-Time Password (OTP): ${otp}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; rounded-2xl; background-color: #0f172a; color: #ffffff; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #38bdf8; margin: 0; font-size: 24px; letter-spacing: 1px;">VORLDX</h2>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 4px;">Employee Attendance System</p>
            </div>
            <div style="background-color: #1e293b; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #334155;">
              <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 12px;">Use the following One-Time Password (OTP) for <strong>${purpose}</strong>:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #38bdf8; padding: 12px; background-color: #0f172a; border-radius: 8px; display: inline-block; font-family: monospace;">
                ${otp}
              </div>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 14px;">This code is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
            </div>
            <p style="color: #64748b; font-size: 11px; text-align: center; margin-top: 20px;">
              &copy; ${new Date().getFullYear()} VorldX Industries Private Limited. All rights reserved.
            </p>
          </div>
        `,
      }),
    });

    if (res.ok) {
      console.log(`[Email] OTP successfully sent to ${toEmail} via Brevo API`);
      return true;
    } else {
      const errText = await res.text();
      console.warn(`[Brevo API Error] ${errText}`);
    }
  } catch (apiErr) {
    console.warn('[Brevo API Call Failed, trying SMTP fallback]', apiErr.message);
  }

  // 2. Fallback to Nodemailer SMTP
  if (!SMTP_USER) {
    console.error('[Email Error] SMTP_USER must be configured to use the SMTP fallback.');
    return false;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: SMTP_USER,
        pass: key,
      },
    });

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: toEmail,
      subject: `[VorldX] Your ${purpose} OTP: ${otp}`,
      html: `<h2>Your VorldX OTP is: <strong>${otp}</strong></h2><p>Valid for 10 minutes.</p>`,
    });

    console.log(`[Email] OTP sent to ${toEmail} via SMTP`);
    return true;
  } catch (smtpErr) {
    console.error(`[SMTP Error] Failed to send email to ${toEmail}:`, smtpErr.message);
    return false;
  }
};

const sendAdminInviteEmail = async ({ toEmail, name, inviterName }) => {
  if (!toEmail) return false;
  const key = getBrevoKey();
  if (!key) {
    console.error('[Email Error] BREVO_API_KEY must be configured to send email.');
    return false;
  }

  const escapeHtml = (value) =>
    String(value || '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': key,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: getEmailSender(),
        to: [{ email: toEmail }],
        subject: '[VorldX] You have been invited as an administrator',
        htmlContent: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;background:#0f172a;color:#fff;border-radius:16px">
            <h1 style="color:#38bdf8;margin:0 0 18px">VORLDX</h1>
            <p>Hello ${escapeHtml(name)},</p>
            <p>${escapeHtml(inviterName || 'A Super Admin')} invited you to access the VorldX Attendance Admin Portal.</p>
            <p>Sign in using this email address and the password provided to you by your Super Admin.</p>
            <p style="margin-top:24px"><a href="${escapeHtml(process.env.CLIENT_URL || 'http://localhost:5173')}/login" style="color:#38bdf8">Open the sign-in page</a></p>
            <p style="color:#94a3b8;font-size:12px">If you were not expecting this invitation, contact your organization administrator.</p>
          </div>
        `
      })
    });

    if (!response.ok) {
      console.error('[Brevo API Error] Failed to send administrator invitation:', await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('[Email Error] Failed to send administrator invitation:', error.message);
    return false;
  }
};

module.exports = {
  sendOtpEmail,
  sendAdminInviteEmail
};
