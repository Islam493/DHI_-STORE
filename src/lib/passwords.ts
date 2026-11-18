// تشفير كلمات السر تاع الفريق (scrypt) — السيرفر برك
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";

function scrypt(pw: string, salt: Buffer, len: number): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(pw, salt, len, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 32);
  return ["scrypt", salt.toString("hex"), h.toString("hex")].join(":");
}

export async function verifyPassword(pw: string, stored: string) {
  const [alg, salt, hash] = stored.split(":");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const h = await scrypt(pw, Buffer.from(salt, "hex"), 32);
  const want = Buffer.from(hash, "hex");
  return want.length === h.length && timingSafeEqual(h, want);
}
