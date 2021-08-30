import nodemailer from "nodemailer"
import dotenv from "dotenv"

dotenv.config()

export default nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PW
  }
})
