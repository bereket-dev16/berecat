import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_ALGORITHM = 'scrypt';
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_LENGTH_BYTES = 16;
const DERIVED_KEY_LENGTH_BYTES = 64;
const SALT_HEX_LENGTH = SALT_LENGTH_BYTES * 2;
const DERIVED_KEY_HEX_LENGTH = DERIVED_KEY_LENGTH_BYTES * 2;
const HEX_PATTERN = /^[0-9a-f]+$/;
const SYNTHETIC_PASSWORD_HASH = [
  SCRYPT_ALGORITHM,
  SCRYPT_N,
  SCRYPT_R,
  SCRYPT_P,
  '0'.repeat(SALT_HEX_LENGTH),
  '0'.repeat(DERIVED_KEY_HEX_LENGTH),
].join('$');

function createRandomBytes(size: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    randomBytes(size, (error, buffer) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(buffer);
    });
  });
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      DERIVED_KEY_LENGTH_BYTES,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await createRandomBytes(SALT_LENGTH_BYTES);
  const derivedKey = await deriveKey(password, salt);

  return [
    SCRYPT_ALGORITHM,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('hex'),
    derivedKey.toString('hex'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split('$');

  if (parts.length !== 6) {
    return false;
  }

  const [algorithm, n, r, p, saltHex, derivedKeyHex] = parts;

  if (
    algorithm !== SCRYPT_ALGORITHM ||
    n !== String(SCRYPT_N) ||
    r !== String(SCRYPT_R) ||
    p !== String(SCRYPT_P) ||
    saltHex.length !== SALT_HEX_LENGTH ||
    derivedKeyHex.length !== DERIVED_KEY_HEX_LENGTH ||
    !HEX_PATTERN.test(saltHex) ||
    !HEX_PATTERN.test(derivedKeyHex)
  ) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expectedKey = Buffer.from(derivedKeyHex, 'hex');
  const actualKey = await deriveKey(password, salt);

  return (
    actualKey.length === expectedKey.length &&
    timingSafeEqual(actualKey, expectedKey)
  );
}

export async function verifyPasswordWithFallback(
  password: string,
  storedHash: string | undefined,
): Promise<boolean> {
  const passwordMatches = await verifyPassword(
    password,
    storedHash ?? SYNTHETIC_PASSWORD_HASH,
  );

  return storedHash !== undefined && passwordMatches;
}
