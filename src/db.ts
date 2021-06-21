import { createConnection, Connection } from "typeorm"
import dotenv from "dotenv"
import { Client } from "pg"

dotenv.config()

export async function setupDatabase() {
  const client = new Client({
    user: process.env.DB_USER,
    database: "postgres",
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
    host: process.env.DB_HOST
  })
  try {
    await client.connect()
    const existingDb = await client.query(`
      SELECT datname
      FROM pg_catalog.pg_database
      WHERE lower(datname) = lower('${process.env.DB_NAME}');
    `)

    if (existingDb.rowCount > 0) return

    await client.query(`CREATE DATABASE "${process.env.DB_NAME}";`)
  } catch (error) {
    throw error
  } finally {
    await client.end()
  }
}

export async function getConnection() {
  const connection = await createConnection({
    type: "postgres",
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: true,
    logging: false,
    entities: ["src/entities/*.ts"],
    migrations: ["src/migration/*.ts"],
    subscribers: ["src/subscriber/*.ts"],
    cli: {
      migrationsDir: "src/migration",
      subscribersDir: "src/subscriber"
    }
  })

  console.log("Connected successfully to database")

  return connection
}
