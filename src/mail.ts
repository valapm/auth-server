import nodemailer from "nodemailer"
import dotenv from "dotenv"

dotenv.config()

export default nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || ""),
  secure: false
})
