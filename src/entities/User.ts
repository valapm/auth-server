import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"
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
}
