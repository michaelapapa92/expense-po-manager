import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCODING: BufferEncoding = "base64";
const ENCRYPTED_PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const keySource = process.env.QBO_ENCRYPTION_KEY;
  if (!keySource) {
    throw new Error("QBO_ENCRYPTION_KEY environment variable is required for token encryption. Please set it to a random string of at least 32 characters.");
  }
  cachedKey = crypto.createHash("sha256").update(keySource).digest();
  return cachedKey;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, encrypted]);
  return ENCRYPTED_PREFIX + combined.toString(ENCODING);
}

export function decrypt(ciphertext: string): string {
  if (!isEncrypted(ciphertext)) {
    return ciphertext;
  }

  const key = getEncryptionKey();
  const payload = ciphertext.slice(ENCRYPTED_PREFIX.length);
  const combined = Buffer.from(payload, ENCODING);

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}
