import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({
    nullable: true
  })
  username?: string // TODO: Remove. Only kept for compatibility reasons

  @Column({ default: "" })
  email!: string

  @Column({ nullable: true })
  pubKey?: string

  @Column("int", { array: true })
  passwordFile!: number[]

  @Column()
  wallet!: string

  @Column()
  salt!: string

  @Column()
  activated!: boolean

  @Column()
  activationCode?: string
}
