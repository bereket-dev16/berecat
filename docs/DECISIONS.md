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
- Şifre hashleme Node.js `scrypt` ile yapılır.
- Şifre karşılaştırmasında `timingSafeEqual` kullanılır.
- Session token `randomBytes` ile üretilir.
- Veritabanında yalnız SHA-256 session token hash'i tutulur.
- Web oturumu `berecat_session` adlı HttpOnly cookie ile yönetilir.
- Session süresi 30 gündür.
- Frontend token saklamaz.
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
- Geliştirmede Vite `/api` proxy'si kullanılır.

## Ses deneyimi

- Intro müziği yalnız başarılı manuel login sonrasında çalınır.
- Otomatik session geri yüklemesinde veya sayfa yenilemesinde müzik çalınmaz.
- Intro müziği loop olmaz.
- Müzik oynatma hatası authentication veya navigation işlemini engellemez.
- Intro müziğinin varsayılan ses seviyesi 0.35'tir.
- Logout sırasında çalan intro müziği durdurulur.

## İş yönetimi

- Modüller ayrı sayfalar değildir; anasayfa kolonlarıdır.
- Bütün işler tek /isler/:workItemId detay rotasını kullanır.
- İş kayıtları PostgreSQL’de work_items tablosunda tutulur.
- Çoklu atama work_item_assignees ilişki tablosuyla yönetilir.
- Yorumlar work_item_comments tablosunda tutulur.
- İş oluşturma ve ilk atamalar transaction içinde yapılır.
- Atama değişikliği transaction içinde yapılır.
- Görevi üzerine alma işlemi yarış durumuna karşı transaction ve satır kilidiyle korunur.
- Bu fazda bütün authenticated kullanıcılar iş oluşturabilir, atayabilir ve yorum yapabilir.
- Stok ve miktar alanları Excel’de serbest biçimli değerler bulunduğu için metin olarak saklanır.
- Yeni işler modül içinde oluşturulma tarihine göre en yeni üstte gösterilir.
- Realtime yorum mevcut fazda kullanılmaz.
- Bir iş aynı anda yalnızca bir anasayfa modülünde bulunur.
- Modül geçişleri work_item_events tablosunda saklanır.
- İşler active veya completed durumunda olabilir.
- Tamamlanan işler anasayfa board'unda gösterilmez.
- Tamamlanan işler ayrı bir tablo değil, `work_items` içindeki `completed` kayıtlar olarak Arşiv sayfasında gösterilir.
- Yeniden açılan iş arşivden kaldırılır ve son modülüne geri döner.
- Tamamlanmış iş aktarılamaz, atanamaz veya claim edilemez.
- Tamamlanmış işe yorum eklenebilir.
- İş yeniden açıldığında yeniden aktarılabilir ve atanabilir.
- Move, complete ve reopen işlemleri transaction ve satır kilidi kullanır.
- Otomatik modül geçişi veya zorunlu iş akışı sırası bu fazda yoktur.
- Preview popup ve detay sayfası ortak yorum/aktivite bileşenini kullanabilir.
- Header giriş yapan kullanıcının profil özetini gösterir.
- Birimler arası iş aktarımı anasayfada sürükle-bırak ile yapılır.
- Popup ve detay sayfasında manuel birim seçimi bulunmaz.
- Aynı kolon içinde manuel kart sıralaması bu fazda yapılmaz.
- İşi tamamlama aksiyonu anasayfa kartı üzerindeki ikonla gerçekleştirilir.
- Yorum yanıtları tek seviyelidir.
- Bir reply yalnız aynı işe ait ana yorumu parent olarak kullanabilir.
- Sipariş Termin Tarihi, Sipariş Verilen Tarih'ten sonraki 10 hafta içi günü olarak otomatik hesaplanır.
- Resmî tatiller mevcut fazda iş günü hesabına dahil edilmez.
- Süreç Kodu alanı kaldırılmıştır.
- Atanan kişiler kompakt çoklu kullanıcı seçiciyle yönetilir.
- Çoğaltılan iş her zaman Gelen Siparişler modülünde yeni `active` kayıt olarak oluşturulur.
- Çoğaltmada yorum, event, status ve tamamlanma bilgisi kopyalanmaz.
- Çoğaltmada iş alanları ve mevcut atamalar forma aktarılır.
- Arşiv araması server-side çalışır.
- Arşiv autocomplete yalnız `completed` kayıtlardan öneri üretir.
- Arşiv kayıtları `completed_at` alanına göre azalan sırada gösterilir.
- Arşiv listelemesi server-side sayfalama kullanır; varsayılan sayfa `1`, varsayılan sayfa boyutu `25` ve azami sayfa boyutu `100`'dür.
- İş silme fiziksel kayıt silme yerine soft delete olarak uygulanır.
- Soft deleted işler normal board, arşiv, arama ve detay sorgularında gösterilmez.
- Silinen işlerin yorum, reaction, event ve atama kayıtları korunur.
- Silme işlemi SİL metniyle ikinci bir kullanıcı onayı gerektirir.
- Yalnız active işler düzenlenebilir veya silinebilir.
- İş düzenleme `moduleKey` alanını değiştirmez.
- İş alanları ve atamalar tek transaction içinde güncellenir.
- Create, duplicate ve edit modları ortak iş formunu kullanır.
- Ürün Detay iş formunda tek satırlık alandır.
- Ana yorumlara ve yanıtlara tek tip onay tepkisi verilebilir.
- Bir kullanıcı aynı yoruma en fazla bir onay tepkisi verebilir.
- Yorum yanıt formu ilgili yorumun altında inline açılır.
- Sistem eventleri ve kullanıcı yorumları görsel olarak ayrı gösterilir.

## Ana veri ve otomatik tamamlama

- Ana veri önerileri PostgreSQL master data tablolarından sunulur.
- CSV runtime sırasında okunmaz; yalnız ilk import kaynağıdır.
- CSV iş kayıtları oluşturmaz.
- Work item alanları metin snapshot olarak kalır ve master data foreign key'i taşımaz.
- Master data değerleri güvenli normalizedKey ile tekilleştirilir.
- Fuzzy benzer değerler otomatik birleştirilmez.
- CSV'de firma hücreleri ürün ilişkisi çıkarılırken forward-fill edilir.
- Firma–ürün, ürün–ambalaj, ambalaj–tedarikçi ve ambalaj–sipariş cinsi ilişkileri sıralama bağlamı olarak kullanılır.
- Autocomplete server-side çalışır.
- Kullanıcı suggestion seçmeden serbest değer girebilir.
- Kullanıcının yeni değeri work item create/edit işlemiyle ana veriye eklenir.
- Master data senkronizasyonu iş create/edit transaction'ının parçasıdır.
- CSV importu SHA-256 ile idempotenttir.
- Aynı CSV ikinci kez kullanım sayılarını artırmaz.
- Canonical CSV display değeri en sık görülen yazımdan seçilir.
- Ana veri entry'si daha önce kullanıcı tarafından oluşturulmuşsa CSV mevcut display değerini otomatik değiştirmez.
