export const WORK_ITEM_MODULES = [
  { key: 'incoming-orders', title: 'Gelen Siparişler' },
  { key: 'new-designs', title: 'Yeni Tasarımlar' },
  { key: 'revisions', title: 'Revizeler' },
  { key: 'team-approval', title: 'Ekip Onayı' },
  { key: 'customer-approval-mail', title: 'Müşteri Onayı (Mail)' },
  { key: 'pricing', title: 'Fiyatlandırma' },
  { key: 'digital', title: 'Dijital' },
] as const

export type WorkItemModuleKey = (typeof WORK_ITEM_MODULES)[number]['key']

const moduleTitleByKey = new Map<WorkItemModuleKey, string>(
  WORK_ITEM_MODULES.map((module) => [module.key, module.title]),
)

export function isWorkItemModuleKey(
  value: unknown,
): value is WorkItemModuleKey {
  return (
    typeof value === 'string' &&
    WORK_ITEM_MODULES.some((module) => module.key === value)
  )
}

export function getWorkItemModuleTitle(moduleKey: WorkItemModuleKey): string {
  return moduleTitleByKey.get(moduleKey) ?? moduleKey
}
