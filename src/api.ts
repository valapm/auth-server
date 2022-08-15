import { HandleRegistration, HandleLogin } from "../opaque-wasm"
import { getConnection } from "./db"
import { EMAIL_REGEX } from "./utils"
import { sendVerificationEmail, sendRecoveryEmail } from "./mail"
import { Connection } from "typeorm"
import { BadRequest, Unauthorized, Forbidden, NotFound } from "./errors"
import { syncMauticContact } from "./cron"

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
    reset?: boolean
  }
} = {}

const loginRequests: {
  [hexPath: string]: {
    login: HandleLogin
    email: string
  }
} = {}

function getResponse(func: (req: express.Request) => any): express.RequestHandler {
  return async (req: express.Request, res: express.Response) => {
    let result
    try {
      result = await func(req)
    } catch (error) {
      if (!error.statusCode || error.statusCode === 500) {
        console.error(error)
        return res.status(500).send({
          error: "Internal Server Error"
        })
      }

      return res.status(error.statusCode).send({
        error: error.message
      })
    }

    return res.status(200).send(result)
  }
}

function getRegistrationError(user?: User): void | Error {
  if (process.env.WAITLIST === "true") {
    if (!user) {
      return new Forbidden("Email not on waitlist")
    } else if (user.waitlist) {
      return new Forbidden("Registration not open for this email")
    }
  }
}

export async function initApp(db: Connection) {
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

  app.post(
    "/register",
    getResponse(async req => {
      const { request: registrationRequest, email, wallet, salt, pubKey } = req.body

      if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
        throw new BadRequest("Must be a valid email")
      }

      const existingUser = await userRepo.findOne({ email })
      const registrationError = getRegistrationError(existingUser)
      if (registrationError) throw registrationError

      if (!registrationRequest || !Array.isArray(registrationRequest)) {
        throw new BadRequest("Must include valid OPAQUE registration request")
      }

      if (!salt) {
        throw new BadRequest("No salt value provided")
      }

      const regTxArray = new Uint8Array(registrationRequest)

      const registration = new HandleRegistration()

      let registrationResponse
      try {
        registrationResponse = registration.start(regTxArray, encodedServerPrivkey)
      } catch (e) {
        console.error("Failed OPAQUE registration in first step")
        console.error(e)
        throw new BadRequest("Must include valid OPAQUE registration request")
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

      return { key: responseArray }
    })
  )

  app.post(
    "/register/:key",
    getResponse(async req => {
      const registrationKey = req.body.key
      const registration = registrationRequests[req.params.key]
      // TODO: encrypted key file should be uploaded as well

      if (!registration) throw new NotFound("Registration does not exist")

      let passwordFile
      try {
        passwordFile = registration.registration.finish(registrationKey)
      } catch (e) {
        console.error("Failed OPAQUE registration in second step")
        console.error(e)
        throw new BadRequest("Invalid registration key")
      }

      // console.log(passwordFile)
      // TODO: Save passwordFile to DB

      console.log(registration)

      const existingUser = await userRepo.findOne({ email: registration.email })
      const registrationError = getRegistrationError(existingUser)
      if (registrationError) throw registrationError

      if (existingUser && existingUser.wallet && !registration.reset) return new BadRequest("Email already registered")

      const userSave = existingUser ? existingUser : new User()

      userSave.passwordFile = Array.from(passwordFile)
      userSave.wallet = registration.wallet
      userSave.salt = registration.salt

      if (!existingUser) {
        const activationCode = crypto.randomBytes(64).toString("hex")

        userSave.email = registration.email
        userSave.activated = false
        userSave.pubKey = registration.pubKey
        userSave.activationCode = activationCode

        await sendVerificationEmail(registration.email, activationCode)
      }

      await userRepo.save(userSave)

      delete registrationRequests[req.params.key]

      syncMauticContact(userSave)
        .then(res => console.log("Sucessfully created mautic user"))
        .catch(error => {
          console.error("Failed to create mautic user")
          console.error(error)
        })

      return { success: true }
    })
  )

  app.post(
    "/recover",
    getResponse(async req => {
      const { request: email } = req.body

      if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
        throw new BadRequest("Must be a valid email")
      }

      const existingUser = await userRepo.findOne({ email })

      if (existingUser) {
        const recoveryCode = crypto.randomBytes(64).toString("hex")
        existingUser.recoveryCode = recoveryCode
        await userRepo.save(existingUser)
        await sendRecoveryEmail(existingUser.email as string, recoveryCode)
      }

      // Return this in all cases to prevent email lookup
      return { success: true, sentRecoveryEmail: true }
    })
  )

  app.post(
    "/recover/:recoveryCode",
    getResponse(async req => {
      const { request: registrationRequest, email, wallet, salt, pubKey } = req.body

      if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
        throw new BadRequest("Must be a valid email")
      }

      const existingUser = await userRepo.findOne({ recoveryCode: req.params.recoveryCode })
      const registrationError = getRegistrationError(existingUser)
      if (registrationError) throw registrationError

      if (!existingUser) {
        return new BadRequest("Email not found")
      }

      if (!registrationRequest || !Array.isArray(registrationRequest)) {
        throw new BadRequest("Must include valid OPAQUE registration request")
      }

      if (!salt) {
        throw new BadRequest("No salt value provided")
      }

      const regTxArray = new Uint8Array(registrationRequest)

      const registration = new HandleRegistration()

      let registrationResponse
      try {
        registrationResponse = registration.start(regTxArray, encodedServerPrivkey)
      } catch (e) {
        console.error("Failed OPAQUE registration in first step")
        console.error(e)
        throw new BadRequest("Must include valid OPAQUE registration request")
      }

      const responseArray = Array.from(registrationResponse)
      const hexPath = responseArray.map(n => n.toString(16)).join("")

      registrationRequests[hexPath] = {
        registration,
        email,
        wallet,
        salt,
        pubKey,
        reset: true
      }

      return { key: responseArray }
    })
  )

  app.get(
    "/verification/:activationCode",
    getResponse(async req => {
      const user = await userRepo.findOne({ activationCode: req.params.activationCode })

      if (!user) {
        throw new NotFound("Verification code not found")
      } else {
        user.activated = true
        user.activationCode = null

        await userRepo.save(user)

        console.log("Verified email " + user.email)

        return "Email verified"
      }
    })
  )

  app.post(
    "/resend-email",
    getResponse(async req => {
      const user = await userRepo.findOne({ email: req.body.email })

      if (!user) throw new NotFound("No registered user with that email found")
      if (user.activated) throw new BadRequest("Email already verified")

      console.log("Generating new activate code for " + req.body.email)

      const activationCode = crypto.randomBytes(64).toString("hex")

      user.activationCode = activationCode
      await userRepo.save(user)

      await sendVerificationEmail(user.email as string, activationCode)

      return "Verification email send to " + req.body.email
    })
  )

  app.post(
    "/login",
    getResponse(async req => {
      const email = req.body.email
      const credentialRequest = req.body.request

      if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
        console.log(email)
        throw new BadRequest("Must be a valid email")
      }

      if (!credentialRequest || !Array.isArray(credentialRequest)) {
        throw new BadRequest("Must include valid OPAQUE credential request")
      }
      const credentialRequestArray = new Uint8Array(credentialRequest)

      // TODO: Return bogus answer is user is not registered
      const existingUser = await userRepo.findOne({ email })
      if (!existingUser || !existingUser.passwordFile) {
        throw new NotFound("User not found")
      }
      const passwordFile = new Uint8Array(existingUser.passwordFile)

      const login = new HandleLogin()

      let loginResponse
      try {
        loginResponse = login.start(passwordFile, credentialRequestArray, encodedServerPrivkey)
      } catch (e) {
        console.error("Failed OPAQUE login in first step")
        console.error(e)
        throw new BadRequest("Must include valid OPAQUE credential request")
      }

      const responseArray = Array.from(loginResponse)
      const hexPath = responseArray.map(n => n.toString(16)).join("")

      loginRequests[hexPath] = {
        login,
        email
      }

      return { key: responseArray }
    })
  )

  app.post(
    "/login/:key",
    getResponse(async req => {
      const loginKey = req.body.key
      const login = loginRequests[req.params.key]

      if (!login) throw new NotFound("Login does not exist")

      let sessionKey
      try {
        sessionKey = login.login.finish(loginKey)
      } catch (e) {
        console.error("Failed OPAQUE login in second step")
        console.error(e)
        throw new BadRequest("Invalid login key")
      }

      console.log(sessionKey)

      const user = await userRepo.findOne({ email: login.email })
      if (!user) {
        throw new NotFound("User does not exist")
      }

      // TODO: Encrypt wallet and salt with sessionKey before sending (probably not important, tls is fine)

      delete loginRequests[req.params.key]
      return { wallet: user.wallet, salt: user.salt, verified: user.activated } // TODO: Return encrypted key file
    })
  )

  app.post(
    "/waitlist",
    getResponse(async req => {
      const email = req.body.email
      console.log(email)

      if (!email) {
        throw new BadRequest("No email supplied")
      }

      const existingUser = await userRepo.findOne({ email })

      if (existingUser) {
        throw new BadRequest("User already registered")
      }

      const userSave = await userRepo.save({
        email,
        waitlist: true
      })

      await userRepo.save(userSave)

      // Sync user to mautic after returning response

      syncMauticContact(userSave)
        .then(user => {
          console.log(`New waitlist user ${userSave.email} synced to Mautic`)
          userRepo.save(userSave)
        })
        .catch(err => console.error(err))

      return { success: true }
    })
  )

  return app
}
