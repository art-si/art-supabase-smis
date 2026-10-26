import type { EmployeeIntegrationItem } from '@/api/integration/employees'
import type {
  SmisMaterial,
  SmisPpeIssuanceRecord,
  SmisPpeIssuanceRecordItem,
  SmisStorageLocation
} from '@smis/api'

export interface IssuanceRecordFormModel {
  id?: string
  issuanceNo: string
  employeeId?: string
  warehouseId?: string
  issuerEmployeeId?: string
  issueDate: string
  remark: string
  items: SmisPpeIssuanceRecordItem[]
}

export interface IssuanceRecordSelectionState {
  employee: EmployeeIntegrationItem[]
  issuer: EmployeeIntegrationItem[]
  warehouse: SmisStorageLocation[]
  materialIds: string[]
  materials: SmisMaterial[]
}

export function createIssuanceEmployeeSnapshot(
  tenantId: string,
  id: string,
  employeeNo: string,
  employeeName: string,
  jobTitle?: string | null
): EmployeeIntegrationItem {
  return { id, tenantId, employeeNo, employeeName, jobTitle, employmentStatus: 'active' }
}

export function createIssuanceRecordEditState(
  row: SmisPpeIssuanceRecord,
  options: {
    copy: boolean
    today: string
    materialType: 'protective_equipment' | 'tool'
  }
): { form: IssuanceRecordFormModel; selection: IssuanceRecordSelectionState } {
  const { copy, today, materialType } = options
  return {
    form: {
      id: copy ? undefined : row.id,
      issuanceNo: copy ? '' : row.issuanceNo,
      employeeId: row.employeeId,
      warehouseId: row.warehouseId,
      issuerEmployeeId: row.issuerEmployeeId,
      issueDate: copy ? today : row.issueDate,
      remark: row.remark || '',
      items: row.items.map((item) => ({ ...item, id: undefined }))
    },
    selection: {
      employee: [
        createIssuanceEmployeeSnapshot(
          row.tenantId,
          row.employeeId,
          row.employeeNo,
          row.employeeName,
          row.positionName
        )
      ],
      issuer: [
        createIssuanceEmployeeSnapshot(row.tenantId, row.issuerEmployeeId, '', row.issuerName)
      ],
      warehouse: [
        {
          id: row.warehouseId,
          tenantId: row.tenantId,
          organizationId: row.organizationId || '',
          locationCode: '',
          locationName: row.warehouseName,
          status: 'enabled',
          childCount: 0,
          organization: {
            id: row.organizationId || '',
            organizationCode: '',
            organizationName: row.organizationName || ''
          }
        }
      ],
      materialIds: row.items.map((item) => item.materialId),
      materials: row.items.map((item) => ({
        id: item.materialId,
        tenantId: row.tenantId,
        materialCode: '',
        materialName: item.materialName,
        categoryId: '',
        category: { id: '', categoryCode: '', categoryName: item.materialCategory || '' },
        specificationModel: item.specificationModel,
        drawingNo: null,
        basicUnit: item.unit,
        materialType,
        materialSource: 'purchase',
        brand: null,
        materialComposition: null,
        placeOfOrigin: null,
        imageUrls: [],
        description: null,
        status: 'enabled',
        sort: 10
      }))
    }
  }
}
