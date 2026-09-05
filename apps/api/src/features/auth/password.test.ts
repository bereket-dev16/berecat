import { describe, expect, it } from 'vitest';

import {
  hashPassword,
  verifyPassword,
  verifyPasswordWithFallback,
} from './password.js';

const TEST_PASSWORD = 'Sadece-Test-Icin-Parola!42';

describe('password', () => {
  it('hash çıktısında düz metin parolayı bulundurmaz', async () => {
    const storedHash = await hashPassword(TEST_PASSWORD);

    expect(storedHash).not.toContain(TEST_PASSWORD);
    expect(storedHash).toMatch(
      /^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/,
    );
  });

  it('doğru parolayı doğrular', async () => {
    const storedHash = await hashPassword(TEST_PASSWORD);

    await expect(verifyPassword(TEST_PASSWORD, storedHash)).resolves.toBe(true);
  });

  it('yanlış parolayı reddeder', async () => {
    const storedHash = await hashPassword(TEST_PASSWORD);

    await expect(
      verifyPassword('Yanlis-Test-Parolasi!', storedHash),
    ).resolves.toBe(false);
  });

  it('bozuk hash formatını hata vermeden reddeder', async () => {
    await expect(
      verifyPassword(TEST_PASSWORD, 'gecersiz-hash'),
    ).resolves.toBe(false);
  });

  it('kullanıcı bulunmadığında sentetik doğrulama sonucunu reddeder', async () => {
    await expect(
      verifyPasswordWithFallback(TEST_PASSWORD, undefined),
    ).resolves.toBe(false);
  });
});
