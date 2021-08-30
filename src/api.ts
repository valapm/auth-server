import { HandleRegistration, HandleLogin } from "../opaque-wasm"
import { setupDatabase, getConnection } from "./db"
import { EMAIL_REGEX } from "./utils"
import emailService from "./mail"

import { User } from "./entities/User"

import express from "express"
import dotenv from "dotenv"
import util from "util"
import cors from "cors"
import crypto from "crypto"

dotenv.config()

const server_privatekey = process.env.SERVER_PRIVATEKEY
const encodedServerPrivkey = new util.TextEncoder().encode(server_privatekey)

const registrationRequests: {
  [hexPath: string]: {
    registration: HandleRegistration
    email: string
    wallet: string
    salt: string
    pubKey?: string
  }
} = {}

const loginRequests: {
  [hexPath: string]: {
    login: HandleLogin
    email: string
  }
} = {}

// const users: {
//   [email: string]: {
//     passwordFile: Uint8Array
//     wallet: string
//     salt: string
//   }
// } = {}

export async function initApp() {
  await setupDatabase()

  const db = await getConnection()
  const userRepo = db.getRepository(User)

  const app = express()

  app.use([
    cors({
      origin: "*"
    }),
    express.json({ limit: "10mb" })
  ])

  app.get("/test", async (req, res) => {
    return res.status(200).json({ test: "test" })
  })

  app.post("/register", async (req, res) => {
    const registrationRequest = req.body.request
    const email = req.body.email // TODO: Email instead?
    const wallet = req.body.wallet
    const salt = req.body.salt
    const pubKey = req.body.pubKey

    if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
      return res.status(500).json({ message: "Must be a valid email" })
    }

    const existingUser = await userRepo.findOne({ email })
    if (existingUser) {
      return res.status(500).json({ message: "Email already taken" })
    }

    if (!registrationRequest || !Array.isArray(registrationRequest)) {
      console.error(req.body)
      return res.status(500).json({ message: "Must include valid OPAQUE registration request" })
    }

    if (!salt) {
      console.log(req.body)
      return res.status(500).json({ message: "No salt value provided" })
    }

    // console.log(registration_tx)
    const regTxArray = new Uint8Array(registrationRequest)

    const registration = new HandleRegistration()

    let registrationResponse
    try {
      registrationResponse = registration.start(regTxArray, encodedServerPrivkey)
    } catch (e) {
      console.error(e)
      return res.status(500).json({ message: "Must include valid OPAQUE registration request" })
    }

    const responseArray = Array.from(registrationResponse)
    const hexPath = responseArray.map(n => n.toString(16)).join("")

    registrationRequests[hexPath] = {
      registration,
      email,
      wallet,
      salt,
      pubKey
    }

    // console.log(registrationResponse)

    return res.status(200).json({ key: responseArray })
  })

  app.post("/register/:key", async (req, res) => {
    const registrationKey = req.body.key
    const registration = registrationRequests[req.params.key]
    // TODO: encrypted key file should be uploaded as well

    if (!registration) return res.status(404).json({ message: "Registration does not exist" })

    let passwordFile
    try {
      // console.log(registrationKey)
      passwordFile = registration.registration.finish(registrationKey)
    } catch (e) {
      return res.status(500).json({ message: "Invalid registration key" })
    }

    // console.log(passwordFile)
    // TODO: Save passwordFile to DB

    console.log(registration)

    const activationCode = crypto.randomBytes(64).toString("hex")

    await userRepo.save({
      email: registration.email,
      passwordFile: Array.from(passwordFile),
      wallet: registration.wallet,
      salt: registration.salt,
      pubKey: registration.pubKey,
      activated: false,
      activationCode
    })

    const data = {
      from: process.env.REGISTRATION_EMAIL_FROM,
      to: registration.email,
      subject: `Your Activation Link for ${process.env.APP_NAME}`,
      text: `Please use the following link to activate your account on ${process.env.APP_NAME}: ${process.env.DOMAIN}/api/auth/verification/verify-account/${activationCode}`,
      html: `<p>Please use the following link to activate your account on ${process.env.APP_NAME}: <strong><a href="${process.env.DOMAIN}/api/auth/verification/verify-account/${activationCode}" target="_blank">Verify Email</a></strong></p>`
    }

    await emailService.sendMail(data)

    // users[registration.email] = {
    //   passwordFile,
    //   wallet: registration.wallet,
    //   salt: registration.salt
    // }

    delete registrationRequests[req.params.key]

    return res.status(200).json({ success: true })
  })

  app.get("/verification/:activationCode", async (req, res) => {
    try {
      const user = await userRepo.findOne({ activationCode: req.params.activationCode })

      if (!user) {
        res.sendStatus(401)
      } else {
        user.activated = true
        user.activationCode = undefined

        await userRepo.save(user)

        res.send("Email verified.")
      }
    } catch (err) {
      console.log("Error on email verification: ", err)
      res.sendStatus(500)
    }
  })

  app.post("/login", async (req, res) => {
    const email = req.body.email
    const credentialRequest = req.body.request

    if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
      console.log(email)
      return res.status(500).json({ message: "Must be a valid email" })
    }

    if (!credentialRequest || !Array.isArray(credentialRequest)) {
      console.error(req.body)
      return res.status(500).json({ message: "Must include valid OPAQUE credential request" })
    }
    const credentialRequestArray = new Uint8Array(credentialRequest)

    // TODO: Return bogus answer is user is not registered
    const existingUser = await userRepo.findOne({ email })
    if (!existingUser) {
      return res.status(500).json({ message: "User not found" })
    }
    const passwordFile = new Uint8Array(existingUser.passwordFile)

    const login = new HandleLogin()

    let loginResponse
    try {
      loginResponse = login.start(passwordFile, credentialRequestArray, encodedServerPrivkey)
    } catch (e) {
      console.error(e)
      return res.status(500).json({ message: "Must include valid OPAQUE credential request" })
    }

    const responseArray = Array.from(loginResponse)
    const hexPath = responseArray.map(n => n.toString(16)).join("")

    loginRequests[hexPath] = {
      login,
      email
    }

    return res.status(200).json({ key: responseArray })
  })

  app.post("/login/:key", async (req, res) => {
    const loginKey = req.body.key
    const login = loginRequests[req.params.key]

    if (!login) return res.status(404).json({ message: "Login does not exist" })

    let sessionKey
    try {
      sessionKey = login.login.finish(loginKey)
    } catch (e) {
      return res.status(500).json({ message: "Invalid login key" })
    }

    console.log(sessionKey)

    const user = await userRepo.findOne({ email: login.email })
    if (!user) {
      return res.status(500).json({ message: "User does not exist" })
    }

    // TODO: Encrypt wallet and salt with sessionKey before sending (probably not important, tls is fine)

    delete loginRequests[req.params.key]
    return res.status(200).json({ wallet: user.wallet, salt: user.salt }) // TODO: Return encrypted key file
  })

  return app
}
