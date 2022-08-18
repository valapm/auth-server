import { Entity, PrimaryColumn, Column } from "typeorm"
import dotenv from "dotenv"

dotenv.config()
@Entity()
export class User {
  @PrimaryColumn()
  pubKeyHashId!: string // First 4 bytes of hash160(pubKey)

  @Column()
  pubKey!: string

  @Column("int", { array: true })
  passwordFile!: number[]

  @Column()
  wallet!: string

  @Column()
  salt!: string
}
