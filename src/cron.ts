import { getConnection } from "./db"
import { User } from "./entities/User"
import dotenv from "dotenv"
import { Connection, IsNull, Not } from "typeorm"
import axios from "axios"

dotenv.config()

export async function syncMauticContacts(db: Connection) {
  console.log("Starting contact sync cron job")
  const userRepo = db.getRepository(User)

  const missingContacts = await userRepo.find({ syncedWithMautic: false, email: Not(IsNull()) })

  if (missingContacts.length) {
    console.log(`Found ${missingContacts.length} unsynced contacts`)

    let failed = 0
    let succeeded = 0

    for (const contact of missingContacts) {
      try {
        await syncMauticContact(contact)
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

export async function syncMauticContact(user: User) {
  if (!user.email) {
    console.error(`User ${user.username} has no email, skipping`)
    return user
  }

  console.log("Syncing " + user.email)

  if (!process.env.MAUTIC_USER || !process.env.MAUTIC_PW) {
    throw new Error("Missing mautic credentials")
  }

  if (!process.env.MAUTIC_HOST) {
    throw new Error("MAUTIC_HOST not defined")
  }

  const auth = "Basic " + Buffer.from(process.env.MAUTIC_USER + ":" + process.env.MAUTIC_PW).toString("base64")

  const res = await axios.post(
    "http://" + process.env.MAUTIC_HOST + "/api/contacts/new",
    {
      email: user.email
    },
    {
      headers: {
        Authorization: auth
      }
    }
  )

  if (!(res.data.contact && res.data.contact.id)) {
    console.error(res.data)
    throw new Error("Failed to save to mautic")
  }

  user.mauticUserId = res.data.contact.id

  // Save contact segment

  if (!process.env.WAITLIST_SEGMENT_ID) {
    console.error("Missing mautic waitlist segment id. Skipping..")
    return user.mauticUserId
  }

  const segmentAction = user.waitlist ? "add" : "remove"
  const res2 = await axios.post(
    "http://" +
      process.env.MAUTIC_HOST +
      `/api/segments/${process.env.WAITLIST_SEGMENT_ID}/contact/${user.mauticUserId}/${segmentAction}`,
    {},
    {
      headers: {
        Authorization: auth
      }
    }
  )

  if (!(res2.data.success === 1)) {
    console.error(res2.data)
    throw new Error("Failed to save contact segment")
  }

  user.syncedWithMautic = true
  return user
}
