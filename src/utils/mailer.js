const nodemailer = require("nodemailer");
const env = require("../config/env");

let transporter;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
    logger: env.nodeEnv !== 'production',
    debug: env.nodeEnv !== 'production',
  });

  // Verify transporter connectivity and log status to assist debugging
  transporter.verify()
    .then(() => {
      console.log('[mailer] SMTP transporter verified');
    })
    .catch((err) => {
      console.error('[mailer] SMTP transporter verification failed:', err && err.message ? err.message : err);
    });

  return transporter;
}

async function sendOtpEmail({ to, firstName, code, purposeLabel = "verification" }) {
  if (!env.smtpUser || !env.smtpPass || !env.smtpFrom) {
    throw new Error("SMTP configuration is incomplete. Please set SMTP_USER, SMTP_PASS, and SMTP_FROM.");
  }

  const mailer = getTransporter();

  try {
    const info = await mailer.sendMail({
      from: env.smtpFrom,
      to,
      subject: `EthioCraft ${purposeLabel} code`,
      text: `Hi ${firstName || "there"}, your EthioCraft ${purposeLabel} OTP code is ${code}. It expires in ${env.otpTtlMinutes} minutes.`,
      html: `<p>Hi ${firstName || "there"},</p><p>Your EthioCraft ${purposeLabel} OTP code is: <strong>${code}</strong></p><p>This code expires in ${env.otpTtlMinutes} minutes.</p>`,
    });

    if (env.nodeEnv !== 'production') {
      console.log('[mailer] OTP email sent:', { to, messageId: info?.messageId, response: info?.response });
    }

    return info;
  } catch (err) {
    // Log error for diagnosis but rethrow to allow caller to handle if needed
    console.error('[mailer] Failed to send OTP email:', err && err.message ? err.message : err);
    throw err;
  }
}

module.exports = {
  sendOtpEmail,
};
