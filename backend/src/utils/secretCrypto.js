'use strict';

/**
 * Secret encryption utility.
 * Uses AES-256-GCM: authenticated encryption (confidentiality + integrity).
 *
 * Encryption key: SECRET_ENCRYPTION_KEY env var (32-byte hex string = 64 hex chars).
 * Each encryption produces a unique IV — never reuse.
 *
 * Stored format (base64): iv(12B) + authTag(16B) + ciphertext
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // GCM recommended
const TAG_LENGTH = 16;

function getKey() {
  const hex = process.env.SECRET_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('[SecretCrypto] SECRET_ENCRYPTION_KEY must be a 64-char hex string (32 bytes).');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext string.
 * Returns a base64 string safe to store in DB.
 */
function encrypt(plaintext) {
  if (typeof plaintext !== 'string') throw new Error('encrypt: plaintext must be a string.');
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Layout: iv | tag | ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a base64 string produced by encrypt().
 * Throws if tampered (GCM auth tag mismatch).
 */
function decrypt(encoded) {
  if (typeof encoded !== 'string') throw new Error('decrypt: input must be a string.');
  const key = getKey();
  const buf = Buffer.from(encoded, 'base64');

  const iv         = buf.slice(0, IV_LENGTH);
  const tag        = buf.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.slice(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    // Don't leak internal error details
    throw new Error('Decryption failed: data may be tampered.');
  }
}

module.exports = { encrypt, decrypt };
