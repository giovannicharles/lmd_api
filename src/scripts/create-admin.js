import bcrypt from "bcryptjs";
import pool from "../config/db.js";
import { isValidPhone, normalizePhone } from "../utils/phone.js";

const [phoneArg, passwordArg, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim() || "Admin";

async function main() {
  if (!phoneArg || !passwordArg) {
    console.error("Usage: npm run admin:create -- <telephone> <mot_de_passe> [nom]");
    console.error("Exemple: npm run admin:create -- 237690000000 MonMotDePasse Dany");
    process.exit(1);
  }
  if (!isValidPhone(phoneArg)) {
    console.error("Numero invalide : 6 a 15 chiffres, indicatif pays inclus (ex. 237690000000).");
    process.exit(1);
  }
  if (passwordArg.length < 8) {
    console.error("Mot de passe trop court : 8 caracteres minimum.");
    process.exit(1);
  }

  const phone = normalizePhone(phoneArg);
  const hash = await bcrypt.hash(passwordArg, 12);
  const { rows } = await pool.query("SELECT id FROM admins WHERE phone = $1", [phone]);

  if (rows.length) {
    await pool.query("UPDATE admins SET password = $1, name = $2 WHERE id = $3", [hash, name, rows[0].id]);
    console.log(`  OK    Mot de passe mis a jour pour ${phone}`);
  } else {
    await pool.query("INSERT INTO admins (phone, password, name) VALUES ($1, $2, $3)", [phone, hash, name]);
    console.log(`  OK    Admin cree : ${phone}`);
  }
}

main()
  .catch((err) => {
    console.error("  FAIL  create-admin:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
