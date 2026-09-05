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
