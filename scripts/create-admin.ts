import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import { hashPassword, isPasswordStrong } from "../src/shared/password";

dotenv.config({ path: ".env.local" });
const [usernameInput, password] = process.argv.slice(2).filter((argument) => argument !== "--");
const username = usernameInput?.trim().toLowerCase();
if (!username || !/^[a-z0-9._-]{3,50}$/.test(username) || !password) {
  throw new Error("Uso: pnpm create-admin -- <usuario> <contraseña>");
}
if (!isPasswordStrong(password)) {
  throw new Error("La contraseña debe tener 12+ caracteres, letras y números; evita palabras comunes.");
}
const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("Define TURSO_DATABASE_URL en .env.local antes de crear el administrador");

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
const existing = await client.execute("SELECT id FROM users LIMIT 1");
if (existing.rows.length) {
  client.close();
  throw new Error("Ya existe una cuenta. La aplicación está configurada para un único administrador.");
}
await client.execute({
  sql: "INSERT INTO users (id, username, password_hash, active, created_at) VALUES (?, ?, ?, 1, ?)",
  args: [crypto.randomUUID(), username, await hashPassword(password), Math.floor(Date.now() / 1000)],
});
console.log(`Administrador ${username} creado.`);
client.close();
