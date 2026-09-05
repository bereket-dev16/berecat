import { describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

describe('GET /api/health', () => {
  it('teknik sağlık durumunu döndürür', async () => {
    const app = buildApp();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: 'ok',
        service: 'berecat-api',
      });
    } finally {
      await app.close();
    }
  });
});
