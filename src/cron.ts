import { getConnection } from "./db"
import { User } from "./entities/User"
import dotenv from "dotenv"
import { Connection } from "typeorm"

dotenv.config()

export async function syncMauticContacts(db: Connection) {
  console.log("Starting contact sync cron job")
  const userRepo = db.getRepository(User)

  const missingContacts = await userRepo.find({ syncedWithMautic: false })

  if (missingContacts.length) {
    console.log(`Found ${missingContacts.length} unsynced contacts`)

    let failed = 0
    let succeeded = 0

    for (const contact of missingContacts) {
      try {
        await contact.syncMauticContact()
        await userRepo.save(contact)
        succeeded += 1
      } catch (e) {
        console.error(e.message)
        failed += 1
      }
    }

    console.log(`Sync finished. Succeeded: ${succeeded}. Failed: ${failed}.`)
  }
}
