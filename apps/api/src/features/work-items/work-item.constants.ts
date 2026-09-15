export const WORK_MODULES = [
  { key: 'incoming-orders', title: 'Gelen Siparişler' },
  { key: 'new-designs', title: 'Yeni Tasarımlar' },
  { key: 'revisions', title: 'Revizeler' },
  { key: 'team-approval', title: 'Ekip Onayı' },
  { key: 'customer-approval-mail', title: 'Müşteri Onayı (Mail)' },
  { key: 'pricing', title: 'Fiyatlandırma' },
  { key: 'digital', title: 'Dijital' },
] as const;

export type WorkModuleKey = (typeof WORK_MODULES)[number]['key'];
export type WorkItemStatus = 'active' | 'completed';
export type WorkItemEventType = 'moved' | 'completed' | 'reopened';

export const WORK_MODULE_KEYS = WORK_MODULES.map((module) => module.key);

export function isWorkModuleKey(value: string): value is WorkModuleKey {
  return WORK_MODULE_KEYS.some((moduleKey) => moduleKey === value);
}

export function getWorkModuleTitle(moduleKey: WorkModuleKey): string {
  return WORK_MODULES.find((module) => module.key === moduleKey)?.title ?? '';
}

export const WORK_ITEM_REQUEST_ERROR_MESSAGE = 'İş isteği işlenemedi.';
export const WORK_ITEM_NOT_FOUND_MESSAGE = 'İş bulunamadı.';
export const INVALID_ASSIGNEE_MESSAGE =
  'Seçilen kullanıcılardan biri geçersiz veya pasif.';
export const DUPLICATE_ASSIGNEE_MESSAGE =
  'Aynı kullanıcı birden fazla kez seçilemez.';
export const CLAIM_CONFLICT_MESSAGE =
  'Bu iş başka bir kullanıcı tarafından alınmış.';
export const WRONG_CLAIM_MODULE_MESSAGE =
  'Yalnızca Gelen Siparişler modülündeki işler üzerinize alınabilir.';
export const COMPLETED_MOVE_MESSAGE =
  'Tamamlanmış iş aktarılamaz. Önce işi yeniden açın.';
export const SAME_MODULE_MESSAGE = 'İş zaten seçilen birimde.';
export const COMPLETED_ASSIGNMENT_MESSAGE =
  'Tamamlanmış işin ataması değiştirilemez.';
export const COMPLETED_CLAIM_MESSAGE =
  'Tamamlanmış iş üzerinize alınamaz.';
export const COMPLETED_UPDATE_MESSAGE =
  'Tamamlanmış iş düzenlenemez. Önce işi yeniden açın.';
export const COMPLETED_DELETE_MESSAGE =
  'Tamamlanmış iş silinemez. Önce işi yeniden açın.';
export const INVALID_DELETE_CONFIRMATION_MESSAGE = 'Silme onayı geçersiz.';
export const COMMENT_NOT_FOUND_MESSAGE = 'Yorum bulunamadı.';
