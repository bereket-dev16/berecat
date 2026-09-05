# BereCat Agent Sözleşmesi

Bu kurallar bağlayıcıdır ve repoda çalışan tüm agent'lar için geçerlidir.

1. Her görevden önce `AGENTS.md` ve `docs/CURRENT_PHASE.md` okunmalıdır.
2. Güncel kullanıcı talimatı en yüksek önceliğe sahiptir.
3. `docs/CURRENT_PHASE.md` dışında hiçbir özellik uygulanamaz.
4. Bir özelliğin `docs/BACKLOG.md` içinde bulunması, onu aktif kapsam yapmaz.
5. Agent yeni route, ekran, tablo, kolon, paket, widget veya iş kuralı uyduramaz.
6. Kullanıcı istemeden arama, filtre, bildirim, dashboard metriği veya animasyon eklenemez.
7. Çalışmayan sahte buton veya sahte bağlantı eklenemez.
8. Henüz yapılmayan sayfalar için boş route oluşturulamaz.
9. Figma, mevcut görsel dil ve yerleşim için ana referanstır.
10. Excalidraw yalnızca backlog ve açık soru kaynağıdır; aktif kapsam belirlemez.
11. Arayüz metinleri Türkçe olmalıdır.
12. İngilizce placeholder veya lorem ipsum kullanılamaz.
13. Secret, şifre veya gerçek environment değeri repoya yazılamaz.
14. Şifreler düz metin saklanamaz.
15. Agent açık talimat olmadan Git commit veya Git push yapamaz.
16. İlgisiz refactor yapılamaz.
17. Belirsizliklerde tahmin yürütülmez; konu `docs/OPEN_QUESTIONS.md` içine yazılır.
18. Her checkpoint sonunda değişen dosyalar ve yapılan işlemler raporlanır.
19. Başarısız veya yapılmamış bir işlem tamamlanmış gibi gösterilemez.
20. `docs/CURRENT_PHASE.md` aktif fazın üst sınırını tanımlar; dosyadaki bütün maddelerin tek görevde uygulanmasına izin vermez.
21. Agent yalnızca kullanıcının mevcut mesajında veya checkpoint talimatında açıkça istediği işleri uygulayabilir. Aktif fazdaki diğer maddeler sonraki checkpoint'lerde ele alınır.
22. Sonraki checkpoint'e hazırlık gerekçesiyle kullanılmayan route, component, tablo, kolon, dependency, mock veri, servis veya altyapı oluşturulamaz.
