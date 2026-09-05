import type { HomeOverview } from './home.types.js';

// Phase 01 demo verisi: Bu kayıtlar yalnızca anasayfa demosunda kullanılır.
export const PHASE_01_HOME_DEMO_OVERVIEW: HomeOverview = {
  modules: [
    {
      id: 'incoming-orders',
      title: 'Gelen Siparişler',
      items: [
        {
          id: 'incoming-order-1',
          title: 'Ürün broşürü talebi',
          description:
            'Yeni ürün için ön ve arka yüz broşür tasarımı hazırlanacak.',
          dueDate: '2026-09-08',
          assignees: [{ id: 'eren', displayName: 'Eren' }],
        },
        {
          id: 'incoming-order-2',
          title: 'Fuar standı görsel seti',
          description:
            'Stand ekranı ve baskı alanları için ana görsel seti hazırlanacak.',
          dueDate: '2026-09-10',
          assignees: [{ id: 'engin', displayName: 'Engin' }],
        },
      ],
    },
    {
      id: 'new-designs',
      title: 'Yeni Tasarımlar',
      items: [
        {
          id: 'new-design-1',
          title: 'Sosyal medya gönderisi',
          description:
            'Kurumsal hesaplar için kare ve dikey gönderi tasarımı hazırlanacak.',
          dueDate: '2026-09-09',
          assignees: [{ id: 'eren', displayName: 'Eren' }],
        },
        {
          id: 'new-design-2',
          title: 'Ürün katalog kapağı',
          description:
            'Yeni katalog için sade ve kurumsal bir kapak alternatifi hazırlanacak.',
          dueDate: '2026-09-12',
          assignees: [{ id: 'engin', displayName: 'Engin' }],
        },
      ],
    },
    {
      id: 'revisions',
      title: 'Revizeler',
      items: [
        {
          id: 'revision-1',
          title: 'Ambalaj metin revizesi',
          description:
            'Ambalaj üzerindeki metin alanları ile hizalamalar güncellenecek.',
          dueDate: '2026-09-08',
          assignees: [{ id: 'eren', displayName: 'Eren' }],
        },
      ],
    },
    {
      id: 'team-approval',
      title: 'Ekip Onayı',
      items: [
        {
          id: 'team-approval-1',
          title: 'Kampanya görsel seti',
          description:
            'Hazırlanan kampanya görselleri ekip içi değerlendirme bekliyor.',
          dueDate: '2026-09-11',
          assignees: [
            { id: 'eren', displayName: 'Eren' },
            { id: 'engin', displayName: 'Engin' },
          ],
        },
      ],
    },
    {
      id: 'customer-approval-mail',
      title: 'Müşteri Onayı (Mail)',
      items: [],
    },
    {
      id: 'pricing',
      title: 'Fiyatlandırma',
      items: [
        {
          id: 'pricing-1',
          title: 'Katalog baskı teklifi',
          description:
            'Katalog baskısı için alınan tekliflerin görsel kapsamı kontrol edilecek.',
          dueDate: '2026-09-13',
          assignees: [{ id: 'engin', displayName: 'Engin' }],
        },
      ],
    },
    {
      id: 'digital',
      title: 'Dijital',
      items: [
        {
          id: 'digital-1',
          title: 'Web sitesi banner güncellemesi',
          description:
            'Anasayfa banner görseli güncel kampanya içeriğiyle değiştirilecek.',
          dueDate: '2026-09-09',
          assignees: [{ id: 'engin', displayName: 'Engin' }],
        },
        {
          id: 'digital-2',
          title: 'LinkedIn fuar paylaşımı',
          description:
            'Fuar katılımı için kurumsal LinkedIn paylaşım görseli hazırlanacak.',
          dueDate: '2026-09-10',
          assignees: [{ id: 'engin', displayName: 'Engin' }],
        },
      ],
    },
  ],
};
