import "reflect-metadata"

import { initApp } from "./api"
import dotenv from "dotenv"

import { setupDatabase, getConnection } from "./db"

dotenv.config()

async function run() {
  await setupDatabase()
  const db = await getConnection()
  const app = await initApp(db)

  app.listen(process.env.PORT, () => {
    console.log("Server has started!")
  })
}

run()
