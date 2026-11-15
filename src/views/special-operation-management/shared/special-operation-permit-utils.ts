import { camelCase, snakeCase } from 'lodash-es'
import { isPlainObjectRecord } from '@/utils/type-guards'
import type { SmisSpecialOperationBlindPlateItem } from '@smis/api'

export const readCustomValue = (
  customValues: Record<string, unknown>,
  fieldCode: string
): unknown => customValues[fieldCode] ?? customValues[camelCase(fieldCode)]

export const normalizeCustomValues = (value: unknown): Record<string, unknown> => {
  if (!isPlainObjectRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [snakeCase(key), fieldValue])
  )
}

const readText = (value: Record<string, unknown>, ...keys: string[]): string => {
  const fieldValue = keys.map((key) => value[key]).find((item) => item !== undefined)
  return typeof fieldValue === 'string' || typeof fieldValue === 'number' ? String(fieldValue) : ''
}

export const normalizeBlindPlateItems = (value: unknown): SmisSpecialOperationBlindPlateItem[] => {
  if (!Array.isArray(value)) return []

  return value.filter(isPlainObjectRecord).map((item, index) => ({
    id: readText(item, 'id') || `blind-plate-${index + 1}`,
    equipmentPipelineName: readText(item, 'equipmentPipelineName', 'equipment_pipeline_name'),
    medium: readText(item, 'medium'),
    temperature: readText(item, 'temperature'),
    pressure: readText(item, 'pressure'),
    material: readText(item, 'material'),
    specification: readText(item, 'specification'),
    blindPlateNo: readText(item, 'blindPlateNo', 'blind_plate_no')
  }))
}

export const createBlindPlateItem = (): SmisSpecialOperationBlindPlateItem => ({
  id: crypto.randomUUID(),
  equipmentPipelineName: '',
  medium: '',
  temperature: '',
  pressure: '',
  material: '',
  specification: '',
  blindPlateNo: ''
})
