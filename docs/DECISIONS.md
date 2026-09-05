# Teknik ve Ürün Kararları

Bu dosyadaki maddeler alınmış kararlardır. Aktif uygulama kapsamı yalnızca `CURRENT_PHASE.md` tarafından belirlenir.

## Teknoloji ve repo yapısı

- Frontend React, TypeScript ve Vite ile geliştirilecektir.
- Backend, TypeScript tabanlı bir API olacaktır.
- API framework'ü Fastify olacaktır.
- Veritabanı Supabase PostgreSQL olacaktır.
- Repo ileride npm workspaces yapısına dönüştürülecektir.
- Planlanan repo yapısı `apps/web`, `apps/api` ve `packages/shared` olacaktır. Bu klasörler ilk dokümantasyon checkpoint'inde oluşturulmayacaktır.
- Web ve API gelecekte Docker ile çalıştırılacaktır.
- Gelecekteki salt okunur mobil istemci aynı backend API'yi kullanacaktır.

## Veri erişimi

- Frontend veritabanına doğrudan erişmeyecektir.
- Bütün veri işlemleri backend API üzerinden yapılacaktır.

## Authentication ve oturum

- Supabase Auth kullanılmayacaktır.
- Kullanıcı adı ve şifre tabanlı özel authentication kullanılacaktır.
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
