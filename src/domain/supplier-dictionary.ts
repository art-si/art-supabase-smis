export const SUPPLIER_DICTIONARY_CODES = [
  'supplierCategory',
  'supplierType',
  'enterpriseNature',
  'supplierIndustry'
] as const

export type SupplierDictionaryCode = (typeof SUPPLIER_DICTIONARY_CODES)[number]

export interface SupplierDictionaryOption {
  label: string
  value: string
}

export const getSupplierDictionaryOptions = (
  _code: SupplierDictionaryCode,
  items?: Api.DataCenter.DictListItem[]
): SupplierDictionaryOption[] =>
  (items ?? [])
    .filter((item) => !item.status || item.status === '1')
    .map((item) => ({
      label: String(item.label || item.name || item.value || ''),
      value: String(item.value ?? '')
    }))

export const resolveSupplierDictionaryLabel = (
  code: SupplierDictionaryCode,
  value?: string | null,
  items?: Api.DataCenter.DictListItem[]
): string =>
  getSupplierDictionaryOptions(code, items).find((item) => item.value === value)?.label ||
  value ||
  ''
