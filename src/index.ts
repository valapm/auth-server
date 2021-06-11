import app from "./api"
import dotenv from "dotenv"

dotenv.config()

app.listen(process.env.PORT, () => {
  console.log("Server has started!")
})
