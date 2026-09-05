import { createHash, randomBytes } from 'node:crypto';

const SESSION_TOKEN_LENGTH_BYTES = 32;
const SESSION_TOKEN_BASE64URL_LENGTH = 43;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

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

export function hashSessionToken(sessionToken: string): string {
  return createHash('sha256').update(sessionToken).digest('hex');
}

export function isValidSessionToken(sessionToken: string): boolean {
  return (
    sessionToken.length === SESSION_TOKEN_BASE64URL_LENGTH &&
    SESSION_TOKEN_PATTERN.test(sessionToken)
  );
}

export async function createSessionToken(): Promise<{
  rawToken: string;
  tokenHash: string;
}> {
  const rawToken = (await createRandomBytes(SESSION_TOKEN_LENGTH_BYTES)).toString(
    'base64url',
  );

  return {
    rawToken,
    tokenHash: hashSessionToken(rawToken),
  };
}
