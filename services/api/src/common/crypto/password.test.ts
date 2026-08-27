import { describe, expect, it } from 'vitest';
import { hashPassword, needsRehash, PASSWORD_HASH_OPTIONS, verifyPassword } from './password.js';

describe('hashPassword', () => {
  it('produces an argon2id hash carrying the configured parameters', async () => {
    const hash = await hashPassword('barff-local-dev-2026');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).toContain(`m=${PASSWORD_HASH_OPTIONS.memoryCost}`);
    expect(hash).toContain(`t=${PASSWORD_HASH_OPTIONS.timeCost}`);
    expect(hash).toContain(`p=${PASSWORD_HASH_OPTIONS.parallelism}`);
  });

  it('never returns the plaintext', async () => {
    const plaintext = 'barff-local-dev-2026';
    expect(await hashPassword(plaintext)).not.toContain(plaintext);
  });

  it('salts, so the same password hashes differently every time', async () => {
    const [first, second] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(first).not.toBe(second);
  });

  it('does not truncate long passphrases the way bcrypt would at 72 bytes', async () => {
    const base = 'x'.repeat(72);
    const hash = await hashPassword(`${base}-tail-A`);
    expect(await verifyPassword(hash, `${base}-tail-B`)).toBe(false);
    expect(await verifyPassword(hash, `${base}-tail-A`)).toBe(true);
  });
});

describe('verifyPassword', () => {
  it('accepts the correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword(hash, 'Correct horse battery staple')).toBe(false);
    expect(await verifyPassword(hash, '')).toBe(false);
  });

  it('returns false rather than throwing on a corrupt hash', async () => {
    // A corrupt row must read as "wrong password", never as a 500 that tells an
    // attacker the account exists and is in an unusual state.
    for (const bad of ['', 'not-a-hash', '$argon2id$broken', '$2b$10$notargon']) {
      await expect(verifyPassword(bad, 'anything')).resolves.toBe(false);
    }
  });
});

describe('needsRehash', () => {
  it('is false for a hash made with the current parameters', async () => {
    expect(needsRehash(await hashPassword('whatever'))).toBe(false);
  });

  it('is true for a hash made with weaker parameters', async () => {
    // Simulates an older hash from before the baseline was raised.
    const weak = '$argon2id$v=19$m=4096,t=1,p=1$c29tZXNhbHR2YWx1ZQ$aGFzaGhhc2hoYXNoaGFzaGhhc2g';
    expect(needsRehash(weak)).toBe(true);
  });

  it('is true for anything unparseable, so a bad row gets replaced on next login', () => {
    expect(needsRehash('not-a-hash')).toBe(true);
  });
});
