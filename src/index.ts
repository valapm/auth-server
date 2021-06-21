import "reflect-metadata"

import { initApp } from "./api"
import dotenv from "dotenv"

dotenv.config()

async function run() {
  const app = await initApp()

  app.listen(process.env.PORT, () => {
    console.log("Server has started!")
  })
}

run()
