export function normalizePhone(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function isValidPhone(value) {
  return /^\d{6,15}$/.test(normalizePhone(value));
}
