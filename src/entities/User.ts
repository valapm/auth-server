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

  async syncMauticContact() {
    const auth = new Buffer.from(process.env.MAUTIC_USER + ":" + process.env.MAUTIC_PW).toString("base64")

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
    return this.mauticUserId
  }
}
