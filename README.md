# BereCat

Bereket İlaç grafik ve dijital ekibi için geliştirilen şirket içi iş takip uygulaması.

## Gereksinimler

- Node.js 22.12 veya üzeri
- npm

## Repo yapısı

```text
apps/
├── api/  # Fastify API
└── web/  # React ve Vite web uygulaması
docs/     # Kalıcı proje dokümantasyonu
```

## Kurulum

```bash
npm install
```

## Geliştirme

Web ve API geliştirme sunucularını birlikte çalıştırmak için:

```bash
npm run dev
```

Çalışma alanlarını ayrı ayrı çalıştırmak için:

```bash
npm run dev:web
npm run dev:api
```

- Web geliştirme adresi: `http://localhost:5173`
- API geliştirme adresi: `http://127.0.0.1:3001`
- Health endpoint: `http://127.0.0.1:3001/api/health`

## Kalite kontrolleri

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Veritabanı geliştirme komutları

`apps/api/.env` yerel ve gizli environment dosyasıdır. `apps/api/.env.example`
ise gerekli değişken biçimini gösteren, Git tarafından takip edilebilir şablondur.
Gerçek secret değerleri Git'e gönderilmemelidir.

```bash
npm run db:generate
npm run db:migrate
npm run db:check
```

Migration dosyaları `apps/api/drizzle` altında tutulur.

## Login geliştirme akışı

Web ve API geliştirme sunucuları birlikte başlatılır:

```bash
npm run dev
```

Admin paneli hazırlanana kadar kullanıcılar güvenli yerel CLI akışıyla oluşturulur:

```bash
npm run user:create
```

Kullanıcı şifreleri düz metin tutulmaz. Web oturumu, tarayıcı JavaScript'i
tarafından okunamayan `berecat_session` adlı HttpOnly cookie ile yönetilir.
HTTPS kullanılan ortamlarda `COOKIE_SECURE=true` olarak ayarlanmalıdır.
