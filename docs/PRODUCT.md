# BereCat Ürün Tanımı

## Amaç

BereCat, Bereket İlaç bünyesindeki grafik ve dijital ekiplerinin işlerini hızlı ve pratik biçimde takip etmesi için geliştirilecek şirket içi bir iş takip ve iş akışı uygulamasıdır. Genel amaçlı bir Trello, Jira veya Asana klonu değildir; Bereket İlaç'ın gerçek grafik ve dijital iş akışına özel olacaktır.

Ürünün temel ilkeleri şunlardır:

- Kullanım hızlı ve pratik olmalıdır.
- Gereksiz UX adımları oluşturulmamalıdır.
- Kullanıcının istemediği özellikler eklenmemelidir.
- Yeni özellik, sayfa, widget, istatistik veya iş kuralı kendiliğinden üretilmemelidir.
- Geliştirme kontrollü checkpoint'ler hâlinde yürütülmelidir.

## Hedef kullanıcılar

İlk kullanım grafik ve dijital ekiplerinden toplam üç kullanıcı içindir. Kullanıcı ve ekip sayısının ileride artabilmesi beklenmektedir; ancak ölçek artışı mevcut faza yeni özellik eklemek için gerekçe değildir.

## Genel kullanım senaryosu

Grafik ve dijital ekip üyeleri, kendilerine yetki verilen iş akışı modüllerindeki işleri anasayfada görür. Mevcut fazda bu alanlar demo iş kartları içerir ve kart seçildiğinde işin salt okunur önizlemesi açılır. İş oluşturma, düzenleme, atama, onay, yorum, dosya ve departmanlar arası gönderim gibi işlemler gelecek fazlara aittir.

## Erişim ve platform

- Uygulama web tabanlı olacaktır.
- Yalnızca şirketin LAN ağı üzerinden erişilecektir.
- LAN bağlantısı Wi-Fi veya kablolu ağ üzerinden olabilir.
- Geliştirme şimdilik Mac mini üzerinde yapılacaktır.
- Gelecekte şirket sunucusunda Docker ile çalıştırılması planlanmaktadır.
- Docker deployment testi Windows laptop üzerinde yapılacaktır.
- Gelecekte Android ve iOS için aynı backend API'yi kullanan salt okunur bir mobil uygulama düşünülebilir. Mobil uygulama mevcut fazın kapsamında değildir.

## Ürün kavramları

### Modül

İş akışının belirli bir aşamasını veya çalışma alanını temsil eden anasayfa sütunudur. Mevcut fazdaki yedi modül `docs/CURRENT_PHASE.md` içinde tanımlanır. Modül ile gelecekteki bağımsız sayfa veya board ilişkisinin kesin yapısı henüz kararlaştırılmamıştır.

### İş kaydı

Takip edilen bir grafik veya dijital işi temsil eden temel kayıttır. Mevcut fazda yalnızca demo iş kartı olarak gösterilir ve üzerinde değişiklik yapılamaz. Kalıcı alanları ve yaşam döngüsü henüz kesinleşmemiştir.

### Anasayfa önizlemesi

Anasayfadaki bir iş kartı seçildiğinde açılan, işi hızlıca incelemeyi sağlayan salt okunur modaldır. Mevcut fazda buradan aksiyon alınmaz.

### İş detay sayfası

Bir işin ayrıntılı alanlarını ve gelecekteki aksiyonlarını barındırması düşünülen ayrı sayfadır. Mevcut faz kapsamında değildir; kesin alanları ve davranışları açık sorudur.

### Kullanıcı

BereCat'e erişebilen kişileri genel olarak ifade eder. Kullanıcı hesabı kullanıcı adı ve şifreyle çalışır. Rol ve yetki ayrıntıları henüz kesinleşmemiştir.

### Admin

Gelecekte kullanıcı hesaplarını ve izin verilen yönetim işlerini yürütecek yetkili kullanıcıdır. Kullanıcı hesapları yalnızca admin panelinden oluşturulacaktır. Admin paneli mevcut faz kapsamında değildir.

### Üye

Admin olmayan, kendisine verilen erişim ve yetkiler çerçevesinde uygulamayı kullanan oturum açmış kullanıcıdır. Üyenin yapabileceği aksiyonların kesin listesi henüz kararlaştırılmamıştır.

### Grafik ekibi

Bereket İlaç'ın grafik tasarım ve revizyon odaklı işlerini takip edecek kullanıcı grubudur. Bu ekibin modül ve aksiyon yetkileri henüz kesinleşmemiştir.

### Dijital ekip

Review, sosyal medya, siteler, program/diğer ve yazılım gibi dijital iş başlıklarını takip etmesi düşünülen kullanıcı grubudur. Kategoriler ve yetki farkları henüz kesinleşmemiştir.
