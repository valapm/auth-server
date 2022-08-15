import nodemailer from "nodemailer"
import dotenv from "dotenv"

dotenv.config()

export const emailService = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || ""),
  secure: false
})

export async function sendVerificationEmail(email: string, activationCode: string) {
  const data = {
    from: process.env.REGISTRATION_EMAIL_FROM,
    to: email,
    subject: `Your Activation Link for ${process.env.APP_NAME}`,
    text: `Please use the following link to activate your account on ${process.env.APP_NAME}: ${process.env.DOMAIN}/verification/${activationCode}`,
    html: `<p>Please use the following link to activate your account on ${process.env.APP_NAME}: <strong><a href="${process.env.DOMAIN}/verification/${activationCode}" target="_blank">Verify Email</a></strong></p>`
  }

  return await emailService.sendMail(data)
}

export async function sendRecoveryEmail(email: string, recoveryCode: string) {
  const data = {
    from: process.env.REGISTRATION_EMAIL_FROM,
    to: email,
    subject: `Your Recovery Link for ${process.env.APP_NAME}`,
    text: `Please use the following link to reset your password on ${process.env.APP_NAME}: ${process.env.DOMAIN}/recovery/${recoveryCode}`,
    html: `<p>Please use the following link to reset your password on ${process.env.APP_NAME}: <strong><a href="${process.env.DOMAIN}/recovery/${recoveryCode}" target="_blank">Verify Email</a></strong></p>`
  }

  return await emailService.sendMail(data)
}
