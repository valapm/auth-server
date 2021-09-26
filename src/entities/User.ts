import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"
import axios from "axios"
import dotenv from "dotenv"

dotenv.config()
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({
    nullable: true
  })
  username?: string // TODO: Remove. Only kept for compatibility reasons

  @Column()
  email!: string

  @Column({ nullable: true })
  pubKey?: string

  @Column("int", { array: true, nullable: true })
  passwordFile?: number[]

  @Column({ nullable: true })
  wallet?: string

  @Column({ nullable: true })
  salt?: string

  @Column({
    default: false
  })
  activated!: boolean

  @Column("text", {
    nullable: true
  })
  activationCode?: string | null

  // Users on the waitlist can not register an account yet.
  @Column({ default: true })
  waitlist!: boolean

  @Column({ nullable: true, unique: true })
  mauticUserId?: number

  @Column({ default: false })
  syncedWithMautic!: boolean

  async syncMauticContact() {
    if (!this.email) {
      console.error(`User ${this.username} has no email, skipping`)
      return
    }

    console.log("Syncing " + this.email)

    if (!process.env.MAUTIC_USER || !process.env.MAUTIC_PW) {
      throw new Error("Missing mautic credentials")
    }

    if (!process.env.MAUTIC_HOST) {
      throw new Error("MAUTIC_HOST not defined")
    }

    console.log([
      process.env.MAUTIC_USER,
      process.env.MAUTIC_PW,
      process.env.MAUTIC_HOST,
      process.env.WAITLIST_SEGMENT_ID
    ])

    const auth = Buffer.from(process.env.MAUTIC_USER + ":" + process.env.MAUTIC_PW).toString("base64")

    const res = await axios.post(
      process.env.MAUTIC_HOST + "/api/contacts/new",
      {
        email: this.email
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

    this.mauticUserId = res.data.contact.id

    // Save contact segment

    if (!process.env.WAITLIST_SEGMENT_ID) {
      console.error("Missing mautic waitlist segment id. Skipping..")
      return this.mauticUserId
    }

    const segmentAction = this.waitlist ? "add" : "remove"
    const res2 = await axios.post(
      process.env.MAUTIC_HOST +
        `/api/segments/${process.env.WAITLIST_SEGMENT_ID}/contact/${this.mauticUserId}/${segmentAction}`,
      {},
      {
        headers: {
          Authorization: auth
        }
      }
    )

    if (!(res2.data.success === true)) {
      console.error(res.data)
      throw new Error("Failed to save contact segment")
    }

    this.syncedWithMautic = true
    return this.mauticUserId
  }
}
