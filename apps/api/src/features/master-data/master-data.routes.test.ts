import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../app.js';
import type { AuthService, PublicUser } from '../auth/auth.types.js';
import { createMasterDataService } from './master-data.service.js';
import type {
  MasterDataRepository,
  MasterDataSuggestion,
  NormalizedMasterDataSuggestionQuery,
} from './master-data.types.js';

const USER: PublicUser = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'test-kullanicisi',
  displayName: 'Test Kullanıcısı',
  role: 'member',
  team: 'graphic',
};
const COOKIE = 'berecat_session=gecerli-session';
const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

class FakeMasterDataRepository implements MasterDataRepository {
  readonly listSuggestions = vi.fn(
    async (
      query: NormalizedMasterDataSuggestionQuery,
    ): Promise<MasterDataSuggestion[]> => {
      void query;
      return this.suggestions;
    },
  );

  constructor(public suggestions: MasterDataSuggestion[] = []) {}
}

function createTestApp(repository = new FakeMasterDataRepository()) {
  const authService: AuthService = {
    async login() {
      return null;
    },
    async getSession(token) {
      return token === 'gecerli-session' ? USER : null;
    },
    async logout() {},
  };
  const app = buildApp({
    authService,
    cookieSecure: false,
    homeService: {} as never,
    masterDataService: createMasterDataService(repository),
    workItemService: {} as never,
    logger: false,
  });
  openApps.push(app);
  return { app, repository };
}

async function requestSuggestions(app: FastifyInstance, url: string) {
  return app.inject({ method: 'GET', url, headers: { cookie: COOKIE } });
}

describe('GET /api/master-data/suggestions', () => {
  it('session olmadan HTTP 401 döndürür', async () => {
    const { app } = createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/master-data/suggestions?kind=company',
    });

    expect(response.statusCode).toBe(401);
  });

  it('geçerli kind değerini kabul eder', async () => {
    const { app } = createTestApp();
    const response = await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=company',
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ suggestions: [] });
  });

  it('geçersiz kind değerini reddeder', async () => {
    const { app, repository } = createTestApp();
    const response = await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=gecersiz',
    );

    expect(response.statusCode).toBe(400);
    expect(repository.listSuggestions).not.toHaveBeenCalled();
  });

  it('q değerini trim ederek repositoryye iletir', async () => {
    const { app, repository } = createTestApp();
    await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=product&q=%20%20Deneme%20%20',
    );

    expect(repository.listSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.objectContaining({
          displayValue: 'Deneme',
          normalizedKey: 'deneme',
          searchValue: 'deneme',
        }),
      }),
    );
  });

  it('q boşken en sık kullanılan sonuçların alınabilmesi için null query gönderir', async () => {
    const suggestions: MasterDataSuggestion[] = [
      { id: '10000000-0000-4000-8000-000000000001', kind: 'company', value: 'Sık Kullanılan' },
      { id: '10000000-0000-4000-8000-000000000002', kind: 'company', value: 'Diğer' },
    ];
    const { app, repository } = createTestApp(
      new FakeMasterDataRepository(suggestions),
    );
    const response = await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=company&q=',
    );

    expect(repository.listSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({ q: null }),
    );
    expect(response.json()).toEqual({ suggestions });
  });

  it('repository exact match sırasını response içinde korur', async () => {
    const suggestions: MasterDataSuggestion[] = [
      { id: '10000000-0000-4000-8000-000000000001', kind: 'product', value: 'Etiket' },
      { id: '10000000-0000-4000-8000-000000000002', kind: 'product', value: 'Etiket Ürünü' },
    ];
    const { app } = createTestApp(new FakeMasterDataRepository(suggestions));
    const response = await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=product&q=etiket',
    );

    expect(response.json<{ suggestions: MasterDataSuggestion[] }>().suggestions[0]?.value).toBe('Etiket');
  });

  it('repository prefix sonucunu substring sonucundan önce döndürebilir', async () => {
    const suggestions: MasterDataSuggestion[] = [
      { id: '10000000-0000-4000-8000-000000000001', kind: 'supplier', value: 'Pozitif Matbaa' },
      { id: '10000000-0000-4000-8000-000000000002', kind: 'supplier', value: 'Matbaa Pozitif' },
    ];
    const { app } = createTestApp(new FakeMasterDataRepository(suggestions));
    const response = await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=supplier&q=poz',
    );

    expect(response.json<{ suggestions: MasterDataSuggestion[] }>().suggestions.map((value) => value.value)).toEqual([
      'Pozitif Matbaa',
      'Matbaa Pozitif',
    ]);
  });

  it('ASCII sorguyu Türkçe karakterlerden arındırılmış searchValue yapar', async () => {
    const { app, repository } = createTestApp();
    await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=supplier&q=pozitif',
    );

    expect(repository.listSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.objectContaining({ searchValue: 'pozitif' }),
      }),
    );
  });

  it('company contextini product sıralaması için iletir', async () => {
    const { app, repository } = createTestApp();
    await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=product&company=Firma%20A',
    );

    expect(repository.listSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          relationType: 'company_product',
          contextKind: 'company',
          contextNormalizedKey: 'firma a',
          candidateDirection: 'to',
        },
      }),
    );
  });

  it('product contextini packaging_type sıralaması için iletir', async () => {
    const { app, repository } = createTestApp();
    await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=packaging_type&product=Ürün%20A',
    );

    expect(repository.listSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          relationType: 'product_packaging_type',
          contextNormalizedKey: 'urun a',
        }),
      }),
    );
  });

  it('packagingType contextini supplier sıralaması için iletir', async () => {
    const { app, repository } = createTestApp();
    await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=supplier&packagingType=Etiket',
    );

    expect(repository.listSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          relationType: 'packaging_type_supplier',
          contextNormalizedKey: 'etiket',
        }),
      }),
    );
  });

  it('packagingType contextini order_type sıralaması için iletir', async () => {
    const { app, repository } = createTestApp();
    await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=order_type&packagingType=Kutu',
    );

    expect(repository.listSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          relationType: 'packaging_type_order_type',
          contextNormalizedKey: 'kutu',
        }),
      }),
    );
  });

  it('context dışındaki önerileri response içinde tamamen gizlemez', async () => {
    const suggestions: MasterDataSuggestion[] = [
      { id: '10000000-0000-4000-8000-000000000001', kind: 'product', value: 'Bağlamlı Ürün' },
      { id: '10000000-0000-4000-8000-000000000002', kind: 'product', value: 'Global Ürün' },
    ];
    const { app } = createTestApp(new FakeMasterDataRepository(suggestions));
    const response = await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=product&company=Firma',
    );

    expect(response.json()).toEqual({ suggestions });
  });

  it('repositorynin pasif kayıtları dışarıda bırakan sonucunu döndürür', async () => {
    const active: MasterDataSuggestion = {
      id: '10000000-0000-4000-8000-000000000001',
      kind: 'company',
      value: 'Aktif Firma',
    };
    const { app } = createTestApp(new FakeMasterDataRepository([active]));
    const response = await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=company',
    );

    expect(response.json()).toEqual({ suggestions: [active] });
  });

  it('limit değerini en fazla 20 olarak kabul eder', async () => {
    const { app, repository } = createTestApp();
    const accepted = await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=company&limit=20',
    );
    const rejected = await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=company&limit=21',
    );

    expect(accepted.statusCode).toBe(200);
    expect(rejected.statusCode).toBe(400);
    expect(repository.listSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 }),
    );
  });

  it('response içinde internal normalized ve usage alanlarını göndermez', async () => {
    const unsafeSuggestion = {
      id: '10000000-0000-4000-8000-000000000001',
      kind: 'company' as const,
      value: 'Güvenli Görünüm',
      normalizedKey: 'gizli-internal-alan',
      searchValue: 'gizli-arama-alani',
      usageCount: 99,
    };
    const repository = new FakeMasterDataRepository([
      unsafeSuggestion as MasterDataSuggestion,
    ]);
    const { app } = createTestApp(repository);
    const response = await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=company',
    );

    expect(response.json()).toEqual({
      suggestions: [
        {
          id: unsafeSuggestion.id,
          kind: unsafeSuggestion.kind,
          value: unsafeSuggestion.value,
        },
      ],
    });
  });

  it('bir HTTP isteği için repositoryyi yalnız bir kez çağırır', async () => {
    const { app, repository } = createTestApp();
    await requestSuggestions(
      app,
      '/api/master-data/suggestions?kind=product&q=urun&company=firma',
    );

    expect(repository.listSuggestions).toHaveBeenCalledTimes(1);
  });
});
