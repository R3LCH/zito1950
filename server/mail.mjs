import nodemailer from 'nodemailer'

/**
 * SMTP mailer from env. Without SMTP_HOST it is not configured and every send resolves { skipped: true },
 * so a shop without mail settings still sells and logs each attempt as skipped.
 */
export function createMailer(env = process.env) {
  const from = env.MAIL_FROM || 'ZITO1950® <customer@zito1950.it>'
  const owner = env.OWNER_EMAIL || 'customer@zito1950.it'
  const configured = !!env.SMTP_HOST
  const transport = configured
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT || 465),
        secure: env.SMTP_SECURE !== 'false',
        ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } } : {}),
        connectionTimeout: 20000,
        greetingTimeout: 20000,
        socketTimeout: 30000,
      })
    : null
  return {
    configured,
    from,
    owner,
    async send({ to, subject, html, text }) {
      if (!transport) return { skipped: true }
      await transport.sendMail({ from, to, subject, html, text })
      return { skipped: false }
    },
  }
}
