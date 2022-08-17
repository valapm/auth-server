import { HandleRegistration, HandleLogin } from "../opaque-wasm"
import { DataSource } from "typeorm"
import { BadRequest, Unauthorized, Forbidden, NotFound } from "./errors"

import { User } from "./entities/User"

import express from "express"
import dotenv from "dotenv"
import util from "util"
import cors from "cors"
import crypto from "crypto"
import bsv from "bsv-wasm"

dotenv.config()

const server_privatekey = process.env.SERVER_PRIVATEKEY
const encodedServerPrivkey = new util.TextEncoder().encode(server_privatekey)

const registrationRequests: {
  [hexPath: string]: {
    registration: HandleRegistration
    pubKey: string
    wallet: string
    salt: string
    reset?: boolean
    sigChallenge: Uint8Array
  }
} = {}

const loginRequests: {
  [hexPath: string]: {
    login: HandleLogin
    pubKey: string
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

export async function initApp(db: DataSource) {
  const userRepo = db.getRepository(User)

  const app = express()

  app.use([
    cors({
      origin: "*"
    }),
    express.json({ limit: "1mb" })
  ])

  app.get("/test", async (req, res) => {
    return res.status(200).json({ test: "test" })
  })

  app.post(
    "/register",
    getResponse(async req => {
      const { request: registrationRequest, wallet, salt, pubKey, reset } = req.body

      try {
        bsv.PublicKey.fromHex(pubKey)
      } catch (e) {
        throw new BadRequest("Must be a valid public key")
      }

      if (!registrationRequest || !Array.isArray(registrationRequest)) {
        throw new BadRequest("Must include valid OPAQUE registration request")
      }

      if (!salt) {
        throw new BadRequest("No salt value provided")
      }

      const regTxArray = new Uint8Array(registrationRequest)

      const registration = new HandleRegistration()

      let registrationResponse: Uint8Array
      try {
        registrationResponse = registration.start(regTxArray, encodedServerPrivkey)
      } catch (e) {
        console.error("Failed OPAQUE registration in first step")
        console.error(e)
        throw new BadRequest("Must include valid OPAQUE registration request")
      }

      const responseArray = Array.from(registrationResponse)
      const hexPath = responseArray.map(n => n.toString(16)).join("")
      const sigChallenge = crypto.randomBytes(64)

      registrationRequests[hexPath] = {
        registration,
        wallet,
        salt,
        pubKey,
        sigChallenge: sigChallenge,
        reset
      }

      return { key: responseArray, sigChallenge: bsv.Hash.sha256(sigChallenge).toHex() }
    })
  )

  app.post(
    "/register/:key",
    getResponse(async req => {
      const { key: registrationKey, signature } = req.body

      const registration = registrationRequests[req.params.key]
      // TODO: encrypted key file should be uploaded as well

      if (!registration) throw new NotFound("Registration does not exist")

      const publicKey = bsv.PublicKey.fromHex(registration.pubKey)

      try {
        const parsedSig = bsv.Signature.fromHexDER(signature)
        bsv.ECDSA.verify(registration.sigChallenge, publicKey, parsedSig, 0)
      } catch (e) {
        console.log(e)
        throw new BadRequest("Invalid Signature")
      }

      let passwordFile
      try {
        passwordFile = registration.registration.finish(registrationKey)
      } catch (e) {
        console.error("Failed OPAQUE registration in second step")
        console.error(e)
        throw new BadRequest("Invalid registration key")
      }

      const existingUser = await userRepo.findOneBy({ pubKey: registration.pubKey })

      if (existingUser && !registration.reset) {
        throw new BadRequest("Wallet already registered. Pass 'reset' do reset password.")
      }

      const userSave = existingUser ? existingUser : new User()

      userSave.passwordFile = Array.from(passwordFile)
      userSave.wallet = registration.wallet
      userSave.salt = registration.salt
      userSave.pubKey = registration.pubKey

      await userRepo.save(userSave)

      delete registrationRequests[req.params.key]

      return { success: true }
    })
  )

  app.post(
    "/login",
    getResponse(async req => {
      const pubKey = req.body.pubKey
      const credentialRequest = req.body.request

      if (typeof pubKey !== "string") {
        throw new BadRequest("Must be a valid public key")
      }

      if (!credentialRequest || !Array.isArray(credentialRequest)) {
        throw new BadRequest("Must include valid OPAQUE credential request")
      }
      const credentialRequestArray = new Uint8Array(credentialRequest)

      // TODO: Return bogus answer is user is not registered
      const existingUser = await userRepo.findOneBy({ pubKey })
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
        pubKey
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

      // console.debug(sessionKey)

      const user = await userRepo.findOneBy({ pubKey: login.pubKey })
      if (!user) {
        throw new NotFound("User does not exist")
      }

      // TODO: Encrypt wallet and salt with sessionKey before sending (probably not important, tls is fine)

      delete loginRequests[req.params.key]
      return { wallet: user.wallet, salt: user.salt } // TODO: Return encrypted key file
    })
  )

  return app
}
