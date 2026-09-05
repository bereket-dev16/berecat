import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { closeDatabase, db } from '../db/client.js';
import { createAuthRepository } from '../features/auth/auth.repository.js';
import type {
  UserRole,
  UserTeam,
} from '../features/auth/auth.types.js';
import { hashPassword } from '../features/auth/password.js';
import {
  isValidUsername,
  normalizeUsername,
} from '../features/auth/username.js';

class UserInputError extends Error {}

function parseRole(value: string): UserRole {
  const role = value.trim().toLowerCase();

  if (role !== 'admin' && role !== 'member') {
    throw new UserInputError('Rol admin veya member olmalıdır.');
  }

  return role;
}

function parseTeam(value: string): UserTeam {
  const team = value.trim().toLowerCase();

  if (team !== 'graphic' && team !== 'digital') {
    throw new UserInputError('Ekip graphic veya digital olmalıdır.');
  }

  return team;
}

async function runCreateUser(): Promise<void> {
  const terminal = createInterface({ input, output });
  const repository = createAuthRepository(db);
  let userCreated = false;
  let operationFailed = false;

  try {
    const username = normalizeUsername(
      await terminal.question('Kullanıcı adı: '),
    );
    const displayName = (await terminal.question('Görünen ad: ')).trim();
    const password = await terminal.question('Şifre: ');
    const role = parseRole(await terminal.question('Rol (admin/member): '));
    const team = parseTeam(
      await terminal.question('Ekip (graphic/digital): '),
    );

    if (!isValidUsername(username)) {
      throw new UserInputError(
        'Kullanıcı adı 1 ile 50 karakter arasında olmalıdır.',
      );
    }

    if (displayName.length < 1 || displayName.length > 100) {
      throw new UserInputError(
        'Görünen ad 1 ile 100 karakter arasında olmalıdır.',
      );
    }

    if (password.length === 0) {
      throw new UserInputError('Şifre boş olamaz.');
    }

    const passwordHash = await hashPassword(password);
    userCreated = await repository.createUser({
      username,
      displayName,
      passwordHash,
      role,
      team,
    });

    if (!userCreated) {
      throw new UserInputError('Bu kullanıcı adı zaten kullanılıyor.');
    }
  } catch (error) {
    operationFailed = true;
    const message =
      error instanceof UserInputError
        ? error.message
        : 'Kullanıcı oluşturulamadı.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  } finally {
    terminal.close();

    try {
      await closeDatabase();
    } catch {
      operationFailed = true;
      process.stderr.write('Veritabanı bağlantı havuzu kapatılamadı.\n');
      process.exitCode = 1;
    }
  }

  if (userCreated && !operationFailed) {
    process.stdout.write('Kullanıcı başarıyla oluşturuldu.\n');
  }
}

await runCreateUser();
