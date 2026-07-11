import nodemailer from "nodemailer";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const secure = process.env.SMTP_SECURE === "true";
    transporter = nodemailer.createTransport({
      host: requireEnv("SMTP_HOST"),
      port: Number(process.env.SMTP_PORT ?? 587),
      secure,
      // On the non-secure port (587), require the STARTTLS upgrade rather
      // than silently falling back to plaintext if the server doesn't offer it.
      requireTLS: !secure,
      auth: {
        user: requireEnv("SMTP_USER"),
        pass: requireEnv("SMTP_PASS"),
      },
    });
  }
  return transporter;
}

export async function sendOtpEmail(email: string, code: string) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@synchub.app";

  await getTransporter().sendMail({
    from,
    to: email,
    subject: "Your SyncHub verification code",
    text: `Your verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`,
    html: `<p>Your verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p><p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
  });
}
