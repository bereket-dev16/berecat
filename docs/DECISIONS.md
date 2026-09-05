# Teknik ve Ürün Kararları

Bu dosyadaki maddeler alınmış kararlardır. Aktif uygulama kapsamı yalnızca `CURRENT_PHASE.md` tarafından belirlenir.

## Teknoloji ve repo yapısı

- Frontend React, TypeScript ve Vite ile geliştirilecektir.
- Backend, TypeScript tabanlı bir API olacaktır.
- API framework'ü Fastify olacaktır.
- Veritabanı Supabase PostgreSQL olacaktır.
- Repo npm workspaces kullanır.
- İlk workspace'ler `apps/web` ve `apps/api`'dir.
- `packages/shared`, ilk gerçek ortak kod ihtiyacı oluşmadan oluşturulmaz.
- Desteklenen minimum Node.js sürümü 22.12.0'dır.
- Web stil altyapısı Tailwind CSS'in Vite entegrasyonunu kullanır.
- Web testleri Vitest ve React Testing Library ile yapılır.
- API testleri Vitest ve Fastify inject ile yapılır.
- Web ve API gelecekte Docker ile çalıştırılacaktır.
- Gelecekteki salt okunur mobil istemci aynı backend API'yi kullanacaktır.

## Veri erişimi

- Frontend veritabanına doğrudan erişmeyecektir.
- Bütün veri işlemleri backend API üzerinden yapılacaktır.
- API veri erişiminde Drizzle ORM kullanılır.
- PostgreSQL sürücüsü olarak node-postgres kullanılır.
- Veritabanı şeması ve migration dosyaları repo içinde tutulur.
- API bağlantılarında sınırlı connection pool kullanılır.

## Authentication ve oturum

- Supabase Auth kullanılmayacaktır.
- Kullanıcı adı ve şifre tabanlı özel authentication kullanılacaktır.
- Kullanıcı şifreleri `password_hash` alanında tutulur; düz metin şifre kolonu bulunmaz.
- Oturumlarda yalnızca session token hash'i saklanır; ham token veritabanına yazılmaz.
- Login ekranında e-posta kullanılmayacaktır.
- Kayıt olma, şifremi unuttum, sosyal medya ile giriş ve magic link bulunmayacaktır.
- Kullanıcı kendi hesabını oluşturamayacaktır; hesaplar gelecekte yalnızca admin panelinden oluşturulacaktır.
- Şifreler güvenli biçimde hash'lenerek saklanacak, düz metin olarak tutulmayacak ve sonradan okunamayacaktır.
- Admin yeni şifreyi girerken göster/gizle seçeneğini kullanabilir; bu, daha önce kaydedilmiş bir şifrenin görüntülenebileceği anlamına gelmez.
- Admin kaydedilmiş şifreyi görüntüleyemeyecek; gerektiğinde kullanıcıya yeni bir şifre tanımlayacaktır.
- Web oturumu güvenli bir HttpOnly cookie üzerinden yönetilecektir.
- Başarılı girişten sonra oturum hatırlanacak; kullanıcı her sayfa açılışında yeniden giriş yapmak zorunda kalmayacaktır.

## Arayüz

- Arayüz dili Türkçe olacaktır.
- Ana tema dark olacaktır.
- Light mode mevcut kapsamda olmayacaktır.
- Figma görselleri mevcut görsel dil ve yerleşim için ana referanstır.
- Figma kullanılabilirlik aleyhine piksel piksel kopyalanmayacaktır; çok küçük yazı, zayıf kontrast ve zor kullanılan alanlar iyileştirilebilir.
- Kullanıcı talebi olmadan yeni bölüm, kart, widget veya dekorasyon eklenmeyecektir.
