# Phase 02 — İş Akışı

## Amaç

Bu fazın amacı, BereCat anasayfasındaki PostgreSQL tabanlı işleri kullanıcı, durum ve modül hareketleriyle izlenebilir bir iş akışına dönüştürmektir.

## Tamamlanan Önceki Faz

Phase 01 kapsamında aşağıdaki çalışmalar tamamlandı:

- Kullanıcı adı ve şifreyle login
- Şifreyi göster/gizle
- Oturumun hatırlanması
- Korumalı anasayfa ve çıkış yapma
- Login sonrası intro müziği
- Dark tema, küçük header ve açılır/kapanabilir sol sidebar
- BereCat logosu
- Yedi modüllü yatay anasayfa çalışma alanı
- Demo iş kartları
- Salt okunur iş önizleme modalı
- Temel loading, empty ve error durumları
- Masaüstü ve farklı ekran genişliklerinde taşma kontrolü

## Tamamlanan Phase 02A — Temel İş Aksiyonları

- Veritabanı tabanlı iş kayıtları
- Modül başlığındaki yeşil artı butonları
- İş oluşturma formu
- Excel sütunlarını içeren sipariş ve üretim alanları
- İsteğe bağlı kullanıcı atama
- Tek ve genel iş detay sayfası
- İşi oluşturan kullanıcı ve oluşturulma zamanı
- Detay sayfasından atama değiştirme
- Atanmamış Gelen Siparişler işini üzerine alma
- Yorum ekleme ve yorumları görüntüleme
- Anasayfa önizleme modalından detay sayfasına geçiş

## Tamamlanan Phase 02B — İş Akışı ve Aktivite

- Header’da aktif kullanıcı profili
- Önizleme popup’ında yorum ekleme
- Önizleme popup’ında yorumları görüntüleme
- Önizleme popup’ında iş etkinliklerini görüntüleme
- İşi başka bir modüle aktarma
- İşi tamamlandı olarak işaretleme
- Tamamlanan işi yeniden açma
- İş hareketlerinin kullanıcı ve tarih bilgisiyle saklanması
- İşlerin tamamlanma durumunun ve yeniden açılmasının desteklenmesi

## Tamamlanan Phase 02C — Hızlı Operasyon ve Arşiv

### Tamamlanan kapsam

- Birimler arası kart sürükle-bırak
- Kart üzerinden işi tamamlama
- Tamamlanan işlerin anasayfadan kaldırılması
- Tamamlanan işler için Arşiv sayfası
- Arşiv tablosu
- Arşiv birleşik araması
- Arşiv arama otomatik tamamlama
- Arşiv filtreleri
- Arşivden işi yeniden açma
- Kart üzerinden işi çoğaltma
- Tek seviyeli yorum yanıtları
- Sipariş termin tarihinin 10 iş günü olarak otomatik hesaplanması
- Kompakt çoklu kullanıcı seçimi
- Genişletilmiş iş önizleme popup’ı

### Phase 02C kapsam dışında bırakılanlar

- Aynı kolon içindeki kartların manuel sıralanması
- Drag and drop ile kart sırası değiştirme
- Mobil dokunmatik arayüz optimizasyonunun tamamlanması
- Resmî tatil takvimi
- İş düzenleme ekranı
- İş silme
- Dosya yükleme
- Yorum düzenleme
- Yorum silme
- İki seviyeden daha derin yorum ağacı
- Bildirim
- Realtime
- Öncelik veya acil sistemi
- Takvim
- Admin paneli
- Kullanıcı oluşturma arayüzü
- Profil düzenleme
- Mobil uygulama

## Phase 02D — İş Düzeltme ve Yorum Etkileşimleri

### Aktif kapsam

- Aktif işlerin düzenlenmesi
- İş oluşturma formunun düzenleme modunda yeniden kullanılması
- Aktif işlerin güvenli soft delete yöntemiyle silinmesi
- Kart üzerinde düzenleme ve silme ikonları
- Ana yorumun altında açılan inline yanıt formu
- Ana yorum ve yanıtların ayrı görsel yapıda gösterilmesi
- Yorumlara ve yanıtlara tek tip onay tepkisi verilmesi
- Yorum tepki sayısının gösterilmesi
- Süreç Aşaması ve Ürün Detay alanlarının kompakt input düzeninde sunulması

### Kapsam dışı

- Silinen işler için Çöp Kutusu sayfası
- Silinen işi geri yükleme
- Silinen işleri kalıcı olarak fiziksel silme
- Tamamlanmış iş düzenleme
- Tamamlanmış iş silme
- İş düzenleme geçmişinde alan bazlı eski ve yeni değerler
- Yorum düzenleme
- Yorum silme
- Birden fazla tepki türü
- Tepki veren kullanıcıların listesini gösterme
- İkinci seviyeden derin yorum ağacı
- Dosya yükleme
- Bildirim
- Realtime
- Öncelik veya acil sistemi
- Admin paneli
- Mobil uygulama

## Checkpoint — 14 Eylül 2026, çalışma durduruldu

Bu checkpoint tamamlanmış Phase 02C teslimi değildir. Çalışma kullanıcı talebiyle durdurulmuş, devam eden agent görevleri sonlandırılmış ve mevcut çalışma ağacı korunmuştur.

### Tamamlanan ve doğrulanan işler

- Phase 02C kapsamı, kalıcı kararlar ve açık sorular ilgili dokümantasyon dosyalarında güncellendi.
- Yalnız izin verilen `@dnd-kit/react`, `@dnd-kit/dom` ve `@radix-ui/react-popover` frontend paketleri eklendi; legacy DnD paketleri eklenmedi.
- `apps/api/drizzle/0003_neat_lady_deathstrike.sql` üretildi ve SQL güvenlik incelemesinden geçirildi.
- Migration yalnız `work_items.process_code` kolonunu kaldırıyor; `work_item_comments.parent_comment_id` self-FK/cascade/check/index yapısını ve üç arşiv indexini ekliyor.
- Migration veritabanına başarıyla uygulandı.
- `npm run db:check` başarıyla tamamlandı: `Veritabanı bağlantısı başarılı.`
- Backend tarafında aktif-only home sorgusu, iş günü termin fallback'i, tek seviyeli yorum yanıtları ve session korumalı arşiv liste/öneri endpoint'leri uygulandı.
- Arşiv frontendinde korumalı `/arsiv` route'u, mevcut AppShell, Anasayfa/Arşiv sidebar bağlantıları, tablo, birleşik arama, autocomplete, filtreler, pagination ve reopen akışı oluşturuldu.
- Frontend üretim koduna kart sürükle-bırak, karttan tamamlama, çoğaltma, geniş preview, yorum yanıtı, otomatik termin ve kompakt kullanıcı seçici davranışları eklendi.
- `npm run lint` son durumda başarıyla tamamlandı.
- `npm run test` son durumda başarıyla tamamlandı: API 5 dosyada 98/98, web 7 dosyada 114/114 test geçti.
- `git diff --check` hata raporlamadı.

### Yarım kalan doğrulama ve bilinen tutarsızlıklar

- Frontend ana çalışma agent'ı ve DnD test agent'ı son gözden geçirme/final rapor aşamasından önce durduruldu; bu nedenle frontend değişiklikleri tamamlanmış teslim olarak kabul edilmemelidir.
- `npm run typecheck` API tarafında geçti, web tarafında `apps/web/src/features/work-items/work-item-flow.test.tsx:904` satırındaki `toHaveFocus` matcher tip bildirimi eksik olduğu için başarısız oldu. İlgili test runtime'da geçiyor; TypeScript test matcher tipi henüz düzeltilmedi.
- `apps/web/src/features/home/components/home-board.tsx` içinde complete hata kolunda arka arkaya iki `return` bulunuyor. Davranışı değiştirmeyen bu yinelenen satır henüz temizlenmedi.
- Nihai workspace `npm run build` komutu son frontend değişikliklerinden sonra çalıştırılmadı; mevcut typecheck hatası giderilmeden build yeşil kabul edilmemelidir.
- Tarayıcı üzerinde manuel drag-drop, popup, arşiv ve responsive görünüm kontrolü yapılmadı.
- Git commit veya push yapılmadı; dev server başlatılmadı.

Devam checkpoint'i önce yukarıdaki typecheck hatasını ve yinelenen `return` satırını ele almalı, ardından lint, typecheck, test ve build zincirini yeniden çalıştırmalıdır.

## Checkpoint — 15 Eylül 2026, Phase 02C devam doğrulaması

Bu bölüm, 14 Eylül 2026 tarihli durdurma checkpoint'ini tarihsel kayıt olarak korur. O kayıtta açık bırakılan uygulama ve doğrulama işleri aşağıdaki güncel sonuçlarla ele alınmıştır. Phase 02C dışına çıkılmamış ve daha önce tamamlanan işler yeniden uygulanmamıştır.

### Tamamlanan devam çalışması

- Mevcut uygulama Phase 02C aktif kapsamındaki 14 maddeyle karşılaştırıldı; maddelerin üretim kodundaki karşılıkları doğrulandı ve kapsam dışı yeni özellik eklenmedi.
- Eksik `toHaveFocus` matcher tip bildirimi tamamlandı; önceki workspace typecheck engeli giderildi.
- Önceki checkpoint'te belirtilen yinelenen `return` mevcut kaynakta bulunmadığı doğrulandı; bu konuda gereksiz kod değişikliği yapılmadı.
- İyimser kart taşıma sonrasında hızlı tamamlama sırasında kartın yeniden görünmesine yol açabilen durum yarışı düzeltildi ve regresyon testi eklendi.
- İş oluşturma veya çoğaltma isteği sürerken Escape ya da overlay ile modalın kapanması ve geç yanıtın yeni form oturumunu etkilemesi engellendi.
- Arşiv autocomplete isteği Escape veya dışarı tıklama ile kapatıldığında bekleme durumu temizlenir hâle getirildi.
- Arşiv birleşik araması `200` karakterle sınırlandı; başlangıç ve bitiş tarihi girdileri API'nin tarih aralığı kuralıyla eşlendi.
- Sürükle-bırak için kolon genişliğine uygun klavye hareketi, Türkçe ekran okuyucu talimatları ve Türkçe durum duyuruları eklendi; diğer varsayılan DnD pluginleri korundu.
- Kompakt kullanıcı seçicinin işlev adı korunurken seçim özeti erişilebilir açıklama olarak bağlandı; aynı görünen ada sahip kullanıcılar `@username` ile ayrıştırıldı.
- `npm run db:check` başarıyla tamamlandı: `Veritabanı bağlantısı başarılı.` Secret veya bağlantı adresi çıktıya yazılmadı.
- `npm run lint` API ve web workspace'lerinde başarıyla tamamlandı.
- `npm run typecheck` API ve web workspace'lerinde başarıyla tamamlandı.
- `npm run test` başarıyla tamamlandı: API 5 dosyada 98/98, web 7 dosyada 120/120 test geçti.
- `npm run build` başarıyla tamamlandı; API TypeScript çıktısı ve web production bundle'ı üretildi.
- `git diff --check` hata raporlamadı.
- Tarayıcıda login ekranı, şifreyi göster/gizle davranışı, kimlik doğrulamasız `/arsiv` isteğinin `/login` rotasına yönlenmesi ve 390x844 görünümde yatay taşma olmaması doğrulandı; console error veya hata overlay'i görülmedi.

### Kalan açık karar ve doğrulama sınırı

- Pasif kullanıcıların mevcut atamalarda, çoğaltma formunda ve Arşiv'deki geçmiş tamamlayan filtresinde nasıl ele alınacağı `docs/OPEN_QUESTIONS.md` içine kaydedildi; ürün kararı olmadan yeni iş kuralı eklenmedi.
- Mevcut durumda iş detayı pasif bir atanmış kullanıcıyı taşıyabilirken kullanıcı seçenekleri ve backend atama doğrulaması yalnız aktif kullanıcıları kabul eder. Bu nedenle pasif kullanıcı içeren bir işi çoğaltma veya atamayı değiştirme davranışı karar verilene kadar tutarsız kalabilir; Arşiv'de pasif bir geçmiş tamamlayan da filtre seçeneklerinde görünmeyebilir.
- Kimlik doğrulamalı drag-drop, geniş popup ve Arşiv akışları test hesabı bulunmadığı için tarayıcıda manuel çalıştırılmadı; bu akışlar otomatik bileşen ve API testleriyle doğrulandı.
- Bu devam turunda yeni dependency veya migration üretilmedi ve mevcut migration yeniden çalıştırılmadı.
- Git commit veya push yapılmadı. Doğrulama için açılan geliştirme sunucusu kapatıldı.

## Checkpoint — 15 Eylül 2026, Phase 02D tamamlandı

### Tamamlanan kapsam

- `work_items` tablosuna nullable `deleted_at` ve `deleted_by` alanları, kullanıcı foreign key'i, tutarlılık constraint'i ve `deleted_at` indexi eklendi.
- `work_item_comment_reactions` tablosu yorum/kullanıcı composite primary key'i, yorum silinmesine bağlı cascade foreign key'i ve kullanıcı indexiyle oluşturuldu; bütün kayıtlar tek tip onay tepkisini temsil ediyor.
- `0004_exotic_drax.sql` migration'ı üretildi, SQL güvenlik açısından incelendi ve yalnız Phase 02D şema değişikliklerini içerdiği doğrulandıktan sonra veritabanına uygulandı.
- Board, detay, arşiv, arşiv araması/önerileri ve iş mutasyonları soft deleted kayıtları dışlayacak şekilde güncellendi; silinen iş doğrudan erişimde bulunamadı gibi davranıyor.
- Session korumalı `PATCH /api/work-items/:workItemId` endpoint'i yalnız aktif işleri düzenliyor; iş alanları ile atamalar `FOR UPDATE` satır kilidi kullanan tek transaction içinde güncelleniyor.
- Session korumalı `DELETE /api/work-items/:workItemId` endpoint'i Türkçe büyük/küçük harf uyumlu `SİL` onayı ve `FOR UPDATE` satır kilidiyle fiziksel silme yapmadan `deleted_at`, `deleted_by` ve `updated_at` alanlarını güncelliyor.
- Soft delete sonrasında yorum, yanıt, tepki, event ve atama kayıtları korunuyor.
- İş formu create, duplicate ve edit modlarında ortak bileşen olarak kullanılıyor; edit açılışında güncel detay ve atamalar yükleniyor, modül salt okunur kalıyor ve manuel termin tarihi korunuyor.
- Süreç Aşaması ve Ürün Detay alanları masaüstünde aynı satırda, küçük ekranda alt alta geçen tek satırlık inputlar olarak sunuluyor.
- Aktif kartlardaki Kopyala ve Tamamla aksiyonlarının yanına klavye erişilebilir Düzenle ve Sil ikonları eklendi; bu aksiyonlar popup veya drag başlatmıyor.
- Silme dialog'u iş ve firma bilgisini, soft delete etkisini ve veri koruma bilgisini gösteriyor; geçerli onay ve pending koruması olmadan silme isteği göndermiyor.
- Ortak activity panelinde Yeni Yorum, Yorumlar ve Etkinlik Geçmişi görsel olarak ayrıldı; ana yorum ve yanıtlar ayrı sosyal yorum yüzeylerinde gösteriliyor.
- Yanıt formu ilgili ana yorumun altında inline açılıyor, tek seviyeli yanıt kuralını koruyor ve aynı anda yalnız bir taslak gösteriyor; eski bir pending istek yeni açılan taslağı kapatmıyor.
- Session korumalı PUT/DELETE reaction endpoint'leri ana yorum ve yanıtlarda idempotent onay tepkisi ekleyip kaldırıyor; composite key duplicate kaydı engelliyor.
- İş detayı reaction sayılarını ve mevcut kullanıcının tepki durumunu toplu sorguyla yüklüyor; tepki veren kullanıcı listesi response'a eklenmiyor.
- Drag-drop, çoğaltma, karttan tamamlama, arşiv, yeniden açma, popup, detay, yorum ve intro müziği davranışları korunuyor.

### Doğrulama sonuçları

- `npm run db:generate` başarılı; `0004_exotic_drax.sql` üretildi.
- Migration SQL incelemesinde DROP, hard delete, seed, veri dönüşümü veya kapsam dışı tablo/kolon değişikliği bulunmadı.
- `npm run db:migrate` başarılı: `Migration başarıyla uygulandı.`
- `npm run db:check` başarılı: `Veritabanı bağlantısı başarılı.` Secret veya bağlantı adresi çıktıya yazılmadı.
- `npm run lint` API ve web workspace'lerinde başarılı.
- `npm run typecheck` API ve web workspace'lerinde başarılı.
- `npm run test` başarılı: API 5 dosyada 131/131, web 7 dosyada 135/135 test geçti.
- `npm run build` başarılı; API çıktısı ve web production bundle'ı üretildi. Vite yalnız mevcut 500 kB üzeri chunk için engelleyici olmayan uyarı verdi.
- `git diff --check` hata raporlamadı.
- Yeni dependency eklenmedi; kapsam dışı özellik, hard delete, commit veya push yapılmadı.

## Phase 03A — Ana Veri ve Akıllı Giriş

### Aktif kapsam

- Firma ana verileri
- Ürün ana verileri
- Ambalaj türü ana verileri
- Tedarikçi firma ana verileri
- Sipariş cinsi ana verileri
- Süreç aşaması ana verileri
- CSV'den güvenli ve idempotent ilk import
- Türkçe karakter duyarlı normalizasyon
- Güvenli tekrar temizleme
- Firma–ürün bağlamı
- Ürün–ambalaj bağlamı
- Ambalaj–tedarikçi bağlamı
- Ambalaj–sipariş cinsi bağlamı
- Server-side autocomplete
- Kullanıcının yeni serbest değer girebilmesi
- Kullanıcı tarafından girilen yeni değerlerin ana veriye eklenmesi
- Create, duplicate ve edit formlarında ortak autocomplete
- Mevcut iş kayıtlarından ana veri backfill'i

### Kapsam dışı

- Ana veri yönetim/admin sayfası
- Ana veriyi kullanıcı arayüzünden silme
- Ana veriyi kullanıcı arayüzünden birleştirme
- Fuzzy kayıtların otomatik birleştirilmesi
- CSV satırlarından work item oluşturulması
- Excel/CSV ile toplu iş oluşturma
- Periyodik CSV senkronizasyonu
- Harici ERP entegrasyonu
- Master data silme
- Alias yönetim ekranı
- Realtime autocomplete
- Mobil optimizasyonun tamamlanması

## Checkpoint — 15 Eylül 2026, Phase 03A tamamlandı

### Tamamlanan kapsam

- `master_data_entries`, `master_data_relations` ve `master_data_import_batches` tablolarını oluşturan `0005_lame_the_call.sql` migration'ı üretildi, güvenlik açısından incelendi ve uygulandı; mevcut tablolar ile work item metin snapshot modeli değiştirilmedi.
- Ortak Türkçe normalizasyon, güvenli tekilleştirme, fuzzy adayların yalnız raporlanması, firma forward-fill ilişkileri ve SHA-256 tabanlı tek seferlik CSV importu tamamlandı.
- Mevcut soft deleted olmayan work item kayıtları değiştirilmeden ana veri ve ilişki kullanım sayaçlarına idempotent backfill uygulandı.
- Work item create, edit ve duplicate akışları ana veri senkronizasyonunu aynı transaction içinde kullanıyor; payload alanları string olarak kaldı.
- Session korumalı server-side suggestion endpoint'i ile exact, bağlam, prefix, kelime-prefix, contains, kullanım ve alfabetik sıralama uygulandı; global fallback korunuyor ve sonuç sayısı en fazla 20.
- Altı iş alanında ortak, erişilebilir, debounce ve AbortController kullanan serbest metin autocomplete uygulandı; API hatasında form normal metin girişi olarak çalışmaya devam ediyor.
- Yalnız API workspace'ine `csv-parse` eklendi; başka dependency, kapsam dışı özellik, admin/merge/delete ekranı veya endpoint'i eklenmedi.
- CSV yalnız yerel ilk import kaynağı olarak kullanıldı; repo, migration, test, README, dokümantasyon veya konsol çıktısına ham satır ya da toplu gerçek değer listesi yazılmadı.

### Import ve veritabanı doğrulaması

- Dry-run 2.758 veri satırı ve 1.850 dolu ürün satırı buldu; blocking parser problemi, uzunluk aşımı, şüpheli değer veya firmasız ürün bulunmadı ve 21 placeholder atlandı.
- Ham/normalize unique sayıları sırasıyla company 143/133, product 994/953, packaging_type 21/20, supplier 18/16, order_type 3/3 ve process_stage 3/3 oldu.
- Safe duplicate grup sayıları company 9, product 40, packaging_type 1, supplier 1, order_type 0 ve process_stage 0; fuzzy aday sayıları sırasıyla 5, 47, 1, 1, 0 ve 0 olarak yalnız yerel rapora yazıldı.
- Çıkarılan unique ilişki sayıları company_product 990, product_packaging_type 1.567, packaging_type_supplier 44 ve packaging_type_order_type 24 oldu.
- İlk apply 1.128 entry ve 2.625 relation ekledi; ikinci aynı-hash apply `Bu dosya daha önce içeri aktarıldı.` sonucu ile no-op oldu.
- Backfill 3 work item üzerinde 15 entry ve 11 relation gördü; work item kayıtlarını yeniden yazmadı.
- Gerçek PostgreSQL üzerinde yalnız sentetik ve rollback edilen verilerle boş sorgu, exact/prefix/word-prefix/contains, dört context, global fallback ve inactive filtreleme doğrulandı; kalıntı bırakılmadı.

### Kalite ve kabul sonuçları

- `npm run db:check` başarılı: `Veritabanı bağlantısı başarılı.` Connection string veya secret çıktıya yazılmadı.
- `npm run lint` ve `npm run typecheck` API ile web workspace'lerinde başarılı.
- `npm run test` başarılı: API 10 dosyada 233/233, web 9 dosyada 179/179 test geçti.
- `npm run build` başarılı; Vite yalnız mevcut 500 kB üzeri chunk için engelleyici olmayan uyarı verdi.
- `git diff --check` hata raporlamadı.
- Geliştirme arayüzünde istenen 11 autocomplete kabul senaryosunun tamamı doğrulandı: gerçek import önerileri ve bağlam sırası, serbest yeni değer create/persistence, edit/duplicate prefill ve kontrollü suggestion API hatasında free-text fallback çalıştı.
- Manuel kabul için oluşturulan 1 sentetik work item, 6 sentetik ana veri entry'si, bunların ilişkileri, geçici session ve geçici kullanıcı test sonunda silindi; sıfır kalıntı doğrulandı.
- Kaynak CSV değiştirilmedi ve Git'e eklenmedi; ayrıntılı yerel rapor `.local/` altında ignore edildi.
- Bu turda başlatılan geçici web/API denemesi, hata proxy'si ve tarayıcı oturumu kapatıldı; önceden açık geliştirme sunucusuna dokunulmadı.
- Git commit veya push yapılmadı.
