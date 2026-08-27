import argon2 from 'argon2';

/**
 * Password hashing.
 *
 * Lives in one file because two callers must agree exactly: the seed
 * (`prisma/seed.ts`) writes the first admin's hash, and the auth service (S04)
 * verifies it. If they drifted apart on algorithm or parameters, the seeded
 * admin simply could not log in — and the failure would look like a wrong
 * password rather than a configuration bug.
 *
 * Argon2id: resistant to both GPU and side-channel attack, and the variant
 * OWASP recommends for password storage. Not bcrypt — bcrypt silently
 * truncates at 72 bytes, which turns a long passphrase into a shorter secret
 * than the user believes they chose.
 */

/**
 * OWASP's recommended argon2id baseline: 19 MiB memory, 2 iterations,
 * 1 degree of parallelism.
 *
 * Raising these later is safe — the parameters are encoded in the hash string,
 * so existing hashes keep verifying and can be re-hashed on next login.
 */
export const PASSWORD_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, PASSWORD_HASH_OPTIONS);
}

/**
 * Verifies a password against a stored hash.
 *
 * Returns `false` rather than throwing on a malformed hash: a corrupt row must
 * read as "wrong password", never as a 500 that tells an attacker the account
 * exists and is in an unusual state.
 */
export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

/**
 * True when a hash was made with weaker parameters than the current baseline,
 * so S04 can transparently re-hash on a successful login.
 */
export function needsRehash(hash: string): boolean {
  try {
    return argon2.needsRehash(hash, PASSWORD_HASH_OPTIONS);
  } catch {
    return true;
  }
}
