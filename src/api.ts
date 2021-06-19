import { Registration, Login, HandleRegistration, HandleLogin } from "../opaque-wasm"
// import { Registration, Login, HandleRegistration, HandleLogin } from "opaque-wasm"

import express from "express"
// import dotenv from "dotenv"
import util from "util"
import cors from "cors"

// dotenv.config()

const server_privatekey = "c95843d9c67f7ba7f1231af10e1a88dc" // XXX: must be 32 chars long
const encodedServerPrivkey = new util.TextEncoder().encode(server_privatekey)

const registrationRequests: {
  [hexPath: string]: {
    registration: HandleRegistration
    username: string
    wallet: string
    salt: string
  }
} = {}

const loginRequests: {
  [hexPath: string]: {
    login: HandleLogin
    username: string
  }
} = {}

const users: {
  [username: string]: {
    passwordFile: Uint8Array
    wallet: string
    salt: string
  }
} = {}

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
  const username = req.body.username // TODO: Email instead?
  const wallet = req.body.wallet
  const salt = req.body.salt

  if (typeof username !== "string") {
    return res.status(500).json({ message: "Must be a valid username" })
  }

  // TODO: Check that username is not registered yet.

  if (!registrationRequest || !Array.isArray(registrationRequest)) {
    console.error(req.body)
    return res.status(500).json({ message: "Must include valid OPAQUE registration request" })
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
    username,
    wallet,
    salt
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
  users[registration.username] = {
    passwordFile,
    wallet: registration.wallet,
    salt: registration.salt
  }

  delete registrationRequests[req.params.key]

  return res.status(200).json({ success: true })
})

app.post("/login", async (req, res) => {
  const username = req.body.username
  const credentialRequest = req.body.request

  if (typeof username !== "string") {
    return res.status(500).json({ message: "Must be a valid username" })
  }

  if (!credentialRequest || !Array.isArray(credentialRequest)) {
    console.error(req.body)
    return res.status(500).json({ message: "Must include valid OPAQUE credential request" })
  }
  const credentialRequestArray = new Uint8Array(credentialRequest)

  // TODO: Return bogus answer is user is not registered
  // TODO: Load passwordFile from DB
  const passwordFile = users[username].passwordFile

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
    username
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
  // TODO: Save passwordFile to DB

  const user = users[login.username]

  // TODO: Encrypt wallet and salt with sessionKey before sending

  delete loginRequests[req.params.key]
  return res.status(200).json({ wallet: user.wallet, salt: user.salt }) // TODO: Return encrypted key file
})

export default app
