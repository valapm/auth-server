import "reflect-metadata"

import { initApp } from "./api"
import dotenv from "dotenv"
import cron from "node-cron"

import { setupDatabase, getConnection } from "./db"
import { syncMauticContacts } from "./cron"

dotenv.config()

async function run() {
  await setupDatabase()
  const db = await getConnection()

  cron.schedule("*/10 * * * *", () => {
    syncMauticContacts(db)
  })

  await syncMauticContacts(db)

  const app = await initApp(db)

  app.listen(process.env.PORT, () => {
    console.log("Server has started!")
  })
}

run()
