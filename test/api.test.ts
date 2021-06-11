import app from "../src/api"
import request from "supertest"
import { Registration, Login, HandleRegistration, HandleLogin } from "../opaque-wasm"
import { Server } from "http"

const password = "SomePassword"
const username = "SomeUser"

test("Registration and Login", async () => {
  // Registration

  const registration = new Registration()
  const registrationRequest = registration.start(password)

  const payload = { request: Array.from(registrationRequest), username }

  const response = await request(app).post("/register").send(payload).set("Accept", "application/json")

  expect(response.headers["content-type"]).toMatch(/json/)
  expect(response.status).toEqual(200)

  // Registration Step 2

  const { key: serverRegistrationKey }: { key: number[] } = response.body

  const parsedKey = new Uint8Array(serverRegistrationKey)

  const registrationKey = registration.finish(parsedKey)

  const registrationKeyPath = serverRegistrationKey.map(n => n.toString(16)).join("")

  const payload2 = {
    key: Array.from(registrationKey)
  }
  const response2 = await request(app)
    .post("/register/" + registrationKeyPath)
    .send(payload2)
    .set("Accept", "application/json")

  console.log(response2.body)

  expect(response2.headers["content-type"]).toMatch(/json/)
  expect(response2.status).toEqual(200)

  // Login

  const login = new Login()
  const loginRequest = login.start(password)

  const payload3 = {
    username,
    request: Array.from(loginRequest)
  }

  const response3 = await request(app).post("/login").send(payload3).set("Accept", "application/json")

  expect(response3.headers["content-type"]).toMatch(/json/)
  expect(response3.status).toEqual(200)

  // Login Step 2

  const { key: serverLoginKey }: { key: number[] } = response3.body

  const loginKey = login.finish(new Uint8Array(serverLoginKey))

  console.log(login.getSessionKey())

  const loginKeyPath = serverLoginKey.map(n => n.toString(16)).join("")

  const payload4 = {
    key: Array.from(loginKey)
  }

  const response4 = await request(app)
    .post("/login/" + loginKeyPath)
    .send(payload4)
    .set("Accept", "application/json")

  expect(response4.headers["content-type"]).toMatch(/json/)
  expect(response4.status).toEqual(200)
})
