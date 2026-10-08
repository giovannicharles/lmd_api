import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { query } from "../config/db.js";
import { env } from "../config/env.js";
import { isValidPhone, normalizePhone } from "../utils/phone.js";

const loginSchema = z.object({
  identifier: z.string().trim().min(1).optional(),
  email: z.string().trim().min(1).optional(),
  password: z.string().min(1),
});

const passwordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8, "8 caracteres minimum").max(100),
});

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z
    .string()
    .trim()
    .refine(isValidPhone, "Numero invalide (6 a 15 chiffres, indicatif pays inclus)")
    .optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
});

const publicAdmin = (a) => ({ id: a.id, name: a.name, phone: a.phone, email: a.email });

function sign(admin) {
  return jwt.sign({ id: admin.id, name: admin.name }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    const identifier = parsed.success ? parsed.data.identifier ?? parsed.data.email : null;
    if (!parsed.success || !identifier) {
      return res.status(400).json({ error: "Numero de telephone et mot de passe requis" });
    }

    const isEmail = identifier.includes("@");
    const { rows } = isEmail
      ? await query("SELECT * FROM admins WHERE email = $1", [identifier])
      : await query("SELECT * FROM admins WHERE phone = $1", [normalizePhone(identifier)]);

    const admin = rows[0];
    const valid = admin ? await bcrypt.compare(parsed.data.password, admin.password) : false;
    if (!valid) {
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    res.json({ data: { token: sign(admin), admin: publicAdmin(admin) } });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const { rows } = await query("SELECT id, name, phone, email FROM admins WHERE id = $1", [req.admin.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Admin not found" });
    }
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const d = parsed.data;
    const fields = [];
    const params = [];
    let idx = 1;
    if (d.name !== undefined) { fields.push(`name = $${idx++}`); params.push(d.name); }
    if (d.phone !== undefined) { fields.push(`phone = $${idx++}`); params.push(normalizePhone(d.phone)); }
    if (d.email !== undefined) { fields.push(`email = $${idx++}`); params.push(d.email || null); }
    if (fields.length === 0) {
      return res.status(400).json({ error: "Rien a modifier" });
    }
    params.push(req.admin.id);
    try {
      const { rows } = await query(
        `UPDATE admins SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, name, phone, email`,
        params
      );
      res.json({ data: rows[0] });
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ error: "Ce numero ou cet email est deja utilise" });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { rows } = await query("SELECT * FROM admins WHERE id = $1", [req.admin.id]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(parsed.data.current_password, admin.password))) {
      return res.status(401).json({ error: "Mot de passe actuel incorrect" });
    }
    const hash = await bcrypt.hash(parsed.data.new_password, 12);
    await query("UPDATE admins SET password = $1 WHERE id = $2", [hash, admin.id]);
    res.json({ data: { updated: true } });
  } catch (err) {
    next(err);
  }
}
