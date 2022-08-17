import { Entity, PrimaryColumn, Column } from "typeorm"
import dotenv from "dotenv"

dotenv.config()
@Entity()
export class User {
  @PrimaryColumn()
  pubKey!: string

  @Column("int", { array: true })
  passwordFile!: number[]

  @Column()
  wallet!: string

  @Column()
  salt!: string
}
