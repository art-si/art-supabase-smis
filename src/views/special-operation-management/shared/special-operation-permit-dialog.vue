<template>
  <ArtDialog
    @open="
      () => {
        activePermitTab = 'section-0'
      }
    "
    ref="dialogRef"
    size="xl"
    :show-fullscreen-button="true"
    :show-confirm-button="false"
    :loading="loading"
    loading-text="正在加载作业票…"
  >
    <div class="permit-form">
      <ArtForm
        ref="formRef"
        v-model="form"
        v-model:active-tab="activePermitTab"
        :items="formItems"
        :rules="rules"
        :span="12"
      >
        <template #[blindPlateSlotKey]
          ><SpecialOperationBlindPlateItems ref="blindPlateItemsRef" v-model="blindPlateItems"
        /></template>
        <template #workers
          ><ArtTable
            :data="form.workers"
            :pagination="false"
            row-key="employeeId"
            table-layout="fixed"
            empty-text="尚未添加作业人员"
          >
            <ElTableColumn type="index" label="序号" width="62" />
            <ElTableColumn label="作业人员" min-width="132"
              ><template #default="{ row }"><ElInput v-model="row.employeeName" /></template
            ></ElTableColumn>
            <ElTableColumn label="部门" min-width="150"
              ><template #default="{ row }"><ElInput v-model="row.organizationName" /></template
            ></ElTableColumn>
            <ElTableColumn label="身份证号" min-width="190"
              ><template #default="{ row }"><ElInput v-model="row.idCardNo" /></template
            ></ElTableColumn>
            <ElTableColumn label="手机号" min-width="145"
              ><template #default="{ row }"><ElInput v-model="row.phone" /></template
            ></ElTableColumn>
            <ElTableColumn label="证件" min-width="150"
              ><template #default="{ row }"><ElInput v-model="row.certificateName" /></template
            ></ElTableColumn>
            <ElTableColumn label="证书编号" min-width="160"
              ><template #default="{ row }"><ElInput v-model="row.certificateNumber" /></template
            ></ElTableColumn>
            <ElTableColumn label="操作" width="76" fixed="right"
              ><template #default="{ row }"
                ><ElButton link type="danger" @click="removeWorker(row.employeeId)"
                  >移除</ElButton
                ></template
              ></ElTableColumn
            >
          </ArtTable></template
        >
        <template #siteAnalysisRecords
          ><ArtTable
            :data="form.siteAnalysisRecords"
            :pagination="false"
            row-key="id"
            table-layout="fixed"
            empty-text="当前作业类型未配置现场分析项"
          >
            <ElTableColumn type="index" label="序号" width="62" />
            <ElTableColumn prop="itemName" label="分析项" min-width="180" />
            <ElTableColumn label="记录类型" width="100"
              ><template #default="{ row }"
                ><ArtDictDisplay
                  dict-code="smisSpecialOperationRecordType"
                  :value="row.recordType"
                  display="tag" /></template
            ></ElTableColumn>
            <ElTableColumn prop="normalValue" label="正常值" min-width="140" />
            <ElTableColumn label="本次记录" min-width="180"
              ><template #default="{ row }"
                ><ElInput v-model="row.recordedValue" placeholder="填写检测结果" /></template
            ></ElTableColumn> </ArtTable
        ></template>
        <template #safetyMeasures
          ><div v-if="form.safetyMeasures.length" class="permit-form__measure-list">
            <ElCheckbox
              v-for="item in form.safetyMeasures"
              :key="item.id"
              v-model="item.involved"
              >{{ item.itemName }}</ElCheckbox
            >
          </div>
          <ArtEmptyState
            v-else
            title="当前作业类型未配置安全检查项"
            description="请先维护该作业类型的安全检查项。"
            size="compact"
            :visual-size="72"
        /></template>
        <template #aiPrecheck
          ><SpecialOperationAiPrecheckPanel
            ref="aiPrecheckRef"
            :permission="aiPrecheckPermission"
            :draft="aiPrecheckDraft"
        /></template>
      </ArtForm>
    </div>

    <template #footer="{ api }">
      <div class="permit-form__footer">
        <span>草稿可继续编辑；提交后进入审批流程。</span>
        <div>
          <ElButton :disabled="submitting" @click="api.handleClose()">取消</ElButton>
          <ElButton
            :disabled="!formRef?.readyToSubmit"
            :loading="submitting && submitMode === 'draft'"
            @click="handleSave(false)"
            >保存草稿</ElButton
          >
          <ElButton
            type="primary"
            :loading="submitting && submitMode === 'submit'"
            @click="handleSave(true)"
            >提交审批</ElButton
          >
        </div>
      </div>
    </template>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'
  import { ElMessage, type FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import {
    fetchSpecialOperationCatalogList,
    fetchSpecialOperationPermit,
    fetchSpecialOperationWorkerDefaults,
    saveSpecialOperationPermit,
    type SmisSpecialOperationCatalogItem,
    type SmisSpecialOperationCatalogSelection,
    type SmisSpecialOperationBlindPlateItem,
    type SmisSpecialOperationPermit,
    type SmisSpecialOperationPermitSavePayload,
    type SmisSpecialOperationPerson,
    type SmisSpecialOperationType,
    type SmisSpecialOperationPrecheckDraft
  } from '@smis/api'
  import { useUserStore } from '@/store/modules/user'
  import SpecialOperationBlindPlateItems from './special-operation-blind-plate-items.vue'
  import SpecialOperationAiPrecheckPanel from './special-operation-ai-precheck-panel.vue'
  import {
    normalizeBlindPlateItems,
    normalizeCustomValues,
    readCustomValue
  } from './special-operation-permit-utils'

  export interface SpecialOperationPermitDialogOpenData {
    row?: Pick<SmisSpecialOperationPermit, 'id' | 'tenantId' | 'permitNo'>
    mode?: 'add' | 'edit' | 'copy'
    operationTypes: SmisSpecialOperationType[]
    forcedOperationTypeCode?: string | null
    aiPrecheckPermission: string
    tenantId?: string | null
  }

  interface PermitFormState {
    operationTypeId: string
    workContent: string
    workStartTime: string | null
    workEndTime: string | null
    workLocation: string
    workUnit: string
    workSection: string
    hotWorkLevel: string
    hotWorkMethods: string[]
    hazardFactorIds: string[]
    responsibleEmployeeId?: string
    guardianIds: string[]
    verifierIds: string[]
    briefingGiverIds: string[]
    briefingReceiverIds: string[]
    analystIds: string[]
    workerIds: string[]
    workers: SmisSpecialOperationPerson[]
    siteAnalysisRecords: SmisSpecialOperationCatalogSelection[]
    relatedOperationTypeIds: string[]
    safetyMeasures: SmisSpecialOperationCatalogSelection[]
    customValues: Record<string, unknown>
    workDescription: string
    sitePhotoUrls: string[]
  }

  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const blindPlateSlotKey = 'customValues.blind_plate_items'
  const activePermitTab = ref('section-0')
  const dialogRef = ref<ArtDialogExpose<SpecialOperationPermitDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const blindPlateItemsRef = ref<InstanceType<typeof SpecialOperationBlindPlateItems>>()
  const aiPrecheckRef = ref<InstanceType<typeof SpecialOperationAiPrecheckPanel>>()
  const loading = ref(false)
  const submitting = ref(false)
  const submitMode = ref<'draft' | 'submit'>('draft')
  const editingId = ref<string>()
  const sourcePermitNo = ref<string>()
  const tenantId = ref<string | null>(null)
  const operationTypes = ref<SmisSpecialOperationType[]>([])
  const forcedOperationTypeCode = ref<string | null>(null)
  const aiPrecheckPermission = ref('SmisSpecialOperationWorkbench:AiPrecheck')
  const catalogs = reactive<{ hazards: SmisSpecialOperationCatalogItem[] }>({ hazards: [] })

  const emptyForm = (): PermitFormState => ({
    operationTypeId: '',
    workContent: '',
    workStartTime: null,
    workEndTime: null,
    workLocation: '',
    workUnit: '',
    workSection: '',
    hotWorkLevel: '',
    hotWorkMethods: [],
    hazardFactorIds: [],
    responsibleEmployeeId: undefined,
    guardianIds: [],
    verifierIds: [],
    briefingGiverIds: [],
    briefingReceiverIds: [],
    analystIds: [],
    workerIds: [],
    workers: [],
    siteAnalysisRecords: [],
    relatedOperationTypeIds: [],
    safetyMeasures: [],
    customValues: {},
    workDescription: '',
    sitePhotoUrls: []
  })
  const form = ref<PermitFormState>(emptyForm())
  const selection = reactive({
    responsible: [] as EmployeeIntegrationItem[],
    guardians: [] as EmployeeIntegrationItem[],
    verifiers: [] as EmployeeIntegrationItem[],
    briefingGivers: [] as EmployeeIntegrationItem[],
    briefingReceivers: [] as EmployeeIntegrationItem[],
    analysts: [] as EmployeeIntegrationItem[],
    workers: [] as EmployeeIntegrationItem[]
  })
  const rules: FormRules<PermitFormState> = {
    operationTypeId: [{ required: true, message: '请选择作业类型', trigger: 'change' }],
    workContent: [{ required: true, message: '请填写作业内容', trigger: 'blur' }],
    workStartTime: [{ required: true, message: '请选择作业开始时间', trigger: 'change' }],
    workEndTime: [{ required: true, message: '请选择作业结束时间', trigger: 'change' }],
    workLocation: [{ required: true, message: '请填写作业地点', trigger: 'blur' }],
    responsibleEmployeeId: [{ required: true, message: '请选择作业负责人', trigger: 'change' }],
    hotWorkLevel: [{ required: true, message: '请选择动火级别', trigger: 'change' }],
    hotWorkMethods: [
      {
        type: 'array',
        required: true,
        min: 1,
        message: '请至少选择一种动火方式',
        trigger: 'change'
      }
    ],
    hazardFactorIds: [
      {
        type: 'array',
        required: true,
        min: 1,
        message: '请至少选择一项危害因素',
        trigger: 'change'
      }
    ],
    workers: [
      {
        type: 'array',
        required: true,
        min: 1,
        message: '请至少添加一名作业人员',
        trigger: 'change'
      }
    ],
    'customValues.blind_plate_items': [
      {
        validator: (_rule, value: unknown, callback) => {
          callback(
            Array.isArray(value) && value.length ? undefined : new Error('请至少添加一项盲板明细')
          )
        },
        trigger: 'change'
      }
    ]
  }
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const hotWorkLevelOptions = computed(() => dictOptions('smisHotWorkLevel'))
  const hotWorkMethodOptions = computed(() => dictOptions('smisHotWorkMethod'))
  const enabledOperationTypes = computed(() =>
    operationTypes.value.filter((item) => item.status === 'enabled')
  )
  const selectedOperationType = computed(() =>
    operationTypes.value.find((item) => item.id === form.value.operationTypeId)
  )
  const hotWorkBuiltinFieldCodes = new Set([
    'hot_work_level',
    'fire_method',
    'hot_work_method',
    'hot_work_methods',
    'hazard_factor',
    'hazard_factors'
  ])
  const visibleCustomFields = computed(() =>
    (selectedOperationType.value?.fieldDefinitions ?? []).filter(
      (field) => !isHotWork.value || !hotWorkBuiltinFieldCodes.has(field.fieldCode)
    )
  )
  const isHotWork = computed(() => selectedOperationType.value?.typeCode === 'HOT_WORK')
  const isWorkAtHeight = computed(() => selectedOperationType.value?.typeCode === 'WORK_AT_HEIGHT')
  const isBlindPlate = computed(() => selectedOperationType.value?.typeCode === 'BLIND_PLATE')
  const blindPlateItems = computed<SmisSpecialOperationBlindPlateItem[]>({
    get: () =>
      normalizeBlindPlateItems(readCustomValue(form.value.customValues, 'blind_plate_items')),
    set: (value) => setCustomValue('blind_plate_items', value)
  })
  const workAtHeightLevel = computed(() => {
    const value = Number(readCustomValue(form.value.customValues, 'work_height'))
    if (!Number.isFinite(value) || value < 2) return '填写高度后自动判定'
    if (value <= 5) return '一级'
    if (value <= 15) return '二级'
    if (value <= 30) return '三级'
    return '特级'
  })
  const relatedTypeOptions = computed(() =>
    enabledOperationTypes.value.filter((item) => item.id !== form.value.operationTypeId)
  )
  const displayPermitNo = computed(() => sourcePermitNo.value || '保存后按编号规则自动生成')
  const isPresent = (value: unknown): boolean => {
    if (value === null || value === undefined) return false
    if (typeof value === 'string') return Boolean(value.trim())
    if (Array.isArray(value)) return value.length > 0
    return true
  }
  const aiPrecheckDraft = computed<SmisSpecialOperationPrecheckDraft>(() => ({
    operationTypeCode: selectedOperationType.value?.typeCode || '',
    operationTypeName: selectedOperationType.value?.typeName || '',
    workContent: form.value.workContent || null,
    workStartTime: form.value.workStartTime,
    workEndTime: form.value.workEndTime,
    workLocation: form.value.workLocation || null,
    workUnit: form.value.workUnit || null,
    workSection: form.value.workSection || null,
    hotWorkLevel: form.value.hotWorkLevel || null,
    hotWorkMethodCount: form.value.hotWorkMethods.length,
    hazardFactorCount: form.value.hazardFactorIds.length,
    responsibleEmployeeSelected: Boolean(form.value.responsibleEmployeeId),
    guardianCount: form.value.guardianIds.length,
    verifierCount: form.value.verifierIds.length,
    briefingGiverCount: form.value.briefingGiverIds.length,
    briefingReceiverCount: form.value.briefingReceiverIds.length,
    workerCount: form.value.workers.length,
    analystCount: form.value.analystIds.length,
    siteAnalysisTotal: form.value.siteAnalysisRecords.length,
    siteAnalysisCompleted: form.value.siteAnalysisRecords.filter((item) =>
      isPresent(item.recordedValue)
    ).length,
    safetyMeasureTotal: form.value.safetyMeasures.length,
    safetyMeasureConfirmed: form.value.safetyMeasures.filter((item) => item.involved).length,
    sitePhotoCount: form.value.sitePhotoUrls.length,
    relatedOperationCount: form.value.relatedOperationTypeIds.length,
    requiredCustomFields: visibleCustomFields.value
      .filter((field) => field.required)
      .map((field) => ({
        label: field.fieldLabel,
        present: isPresent(readCustomValue(form.value.customValues, field.fieldCode))
      })),
    blindPlateItemCount: blindPlateItems.value.length
  }))
  const requiredCustomFieldRule = (label: string) => ({
    validator: (_rule: unknown, value: unknown, callback: (error?: Error) => void): void => {
      const empty =
        value === null ||
        value === undefined ||
        (typeof value === 'string' && !value.trim()) ||
        (Array.isArray(value) && value.length === 0)
      callback(empty ? new Error(`请填写${label}`) : undefined)
    },
    trigger: ['blur', 'change']
  })
  const setCustomValue = (key: string, value: unknown): void => {
    form.value.customValues[key] = value
  }

  const toEmployeeOption = (person: SmisSpecialOperationPerson): EmployeeIntegrationItem =>
    ({
      id: person.employeeId,
      employeeNo: person.employeeNo || '',
      employeeName: person.employeeName,
      phone: person.phone || '',
      organization: person.organizationName
        ? { id: '', organizationName: person.organizationName }
        : null
    }) as EmployeeIntegrationItem
  const toPerson = (row: EmployeeIntegrationItem): SmisSpecialOperationPerson => ({
    employeeId: row.id,
    employeeNo: row.employeeNo,
    employeeName: row.employeeName,
    phone: row.phone,
    organizationName: row.organization?.organizationName || null
  })
  const people = (rows: EmployeeIntegrationItem[]) => rows.map(toPerson)
  const resetSelections = (): void => Object.values(selection).forEach((rows) => rows.splice(0))

  const loadCatalogs = async (preserveValues = false): Promise<void> => {
    if (!form.value.operationTypeId) return
    const [hazards, analyses, measures] = await Promise.all([
      fetchSpecialOperationCatalogList({
        catalogKind: 'hazard_factor',
        operationTypeId: form.value.operationTypeId,
        status: 'enabled',
        tenantId: tenantId.value,
        from: 0,
        to: 499
      }),
      fetchSpecialOperationCatalogList({
        catalogKind: 'site_analysis',
        operationTypeId: form.value.operationTypeId,
        status: 'enabled',
        tenantId: tenantId.value,
        from: 0,
        to: 499
      }),
      fetchSpecialOperationCatalogList({
        catalogKind: 'safety_checklist',
        operationTypeId: form.value.operationTypeId,
        status: 'enabled',
        tenantId: tenantId.value,
        from: 0,
        to: 499
      })
    ])
    catalogs.hazards = hazards.data
    if (!preserveValues) {
      form.value.hazardFactorIds = []
      form.value.siteAnalysisRecords = analyses.data.map((item) => ({
        id: item.id,
        itemName: item.itemName,
        recordType: item.recordType,
        normalValue: item.normalValue,
        abnormalValue: item.abnormalValue,
        recordedValue: null
      }))
      form.value.safetyMeasures = measures.data.map((item) => ({
        id: item.id,
        itemName: item.itemName,
        involved: false
      }))
      form.value.customValues = {}
    }
  }
  const handleOperationTypeChange = async (): Promise<void> => {
    await loadCatalogs(false)
  }

  const hydrate = (record: SmisSpecialOperationPermit): void => {
    Object.assign(form.value, {
      operationTypeId: record.operationTypeId,
      workContent: record.workContent || '',
      workStartTime: record.workStartTime,
      workEndTime: record.workEndTime,
      workLocation: record.workLocation || '',
      workUnit: record.workUnit || '',
      workSection: record.workSection || '',
      hotWorkLevel: record.hotWorkLevel || '',
      hotWorkMethods: record.hotWorkMethods || [],
      hazardFactorIds: (record.hazardFactors || []).map((item) => item.id),
      responsibleEmployeeId: record.responsibleEmployee?.employeeId,
      guardianIds: record.guardianEmployees.map((item) => item.employeeId),
      verifierIds: record.verifierEmployees.map((item) => item.employeeId),
      briefingGiverIds: record.briefingGiverEmployees.map((item) => item.employeeId),
      briefingReceiverIds: record.briefingReceiverEmployees.map((item) => item.employeeId),
      analystIds: record.analysts.map((item) => item.employeeId),
      workerIds: record.workers.map((item) => item.employeeId),
      workers: record.workers,
      siteAnalysisRecords: record.siteAnalysisRecords || [],
      relatedOperationTypeIds: (record.relatedPermits || []).map((item) => item.id),
      safetyMeasures: record.safetyMeasures || [],
      customValues: normalizeCustomValues(record.customValues),
      workDescription: record.workDescription || '',
      sitePhotoUrls: record.sitePhotoUrls || []
    })
    selection.responsible = record.responsibleEmployee
      ? [toEmployeeOption(record.responsibleEmployee)]
      : []
    selection.guardians = record.guardianEmployees.map(toEmployeeOption)
    selection.verifiers = record.verifierEmployees.map(toEmployeeOption)
    selection.briefingGivers = record.briefingGiverEmployees.map(toEmployeeOption)
    selection.briefingReceivers = record.briefingReceiverEmployees.map(toEmployeeOption)
    selection.analysts = record.analysts.map(toEmployeeOption)
    selection.workers = record.workers.map(toEmployeeOption)
  }

  const handleWorkerConfirm = async (ids: string[]): Promise<void> => {
    const response = await fetchSpecialOperationWorkerDefaults(
      ids,
      selectedOperationType.value?.typeCode || 'HOT_WORK',
      tenantId.value
    )
    form.value.workerIds = ids
    form.value.workers = response.data || []
  }
  const removeWorker = (employeeId: string): void => {
    form.value.workerIds = form.value.workerIds.filter((id) => id !== employeeId)
    form.value.workers = form.value.workers.filter((item) => item.employeeId !== employeeId)
    selection.workers = selection.workers.filter((item) => item.id !== employeeId)
  }

  const buildCustomValues = (): Record<string, unknown> => {
    const values: Record<string, unknown> = { ...form.value.customValues }
    if (isHotWork.value) {
      const hazardNames = catalogs.hazards
        .filter((item) => form.value.hazardFactorIds.includes(item.id))
        .map((item) => item.itemName)
      Object.assign(values, {
        hot_work_level: form.value.hotWorkLevel,
        fire_method: form.value.hotWorkMethods,
        hot_work_method: form.value.hotWorkMethods.join('、'),
        hot_work_methods: form.value.hotWorkMethods,
        hazard_factor: hazardNames.join('、'),
        hazard_factors: hazardNames
      })
    }
    return values
  }
  const buildPayload = (): SmisSpecialOperationPermitSavePayload => ({
    operationTypeId: form.value.operationTypeId,
    workContent: form.value.workContent || null,
    workStartTime: form.value.workStartTime,
    workEndTime: form.value.workEndTime,
    workLocation: form.value.workLocation || null,
    workUnit: form.value.workUnit || null,
    workSection: form.value.workSection || null,
    hotWorkLevel: form.value.hotWorkLevel || null,
    hotWorkMethods: form.value.hotWorkMethods,
    hazardFactors: catalogs.hazards
      .filter((item) => form.value.hazardFactorIds.includes(item.id))
      .map((item) => ({ id: item.id, itemName: item.itemName })),
    responsibleEmployee: selection.responsible[0] ? toPerson(selection.responsible[0]) : null,
    guardianEmployees: people(selection.guardians),
    verifierEmployees: people(selection.verifiers),
    briefingGiverEmployees: people(selection.briefingGivers),
    briefingReceiverEmployees: people(selection.briefingReceivers),
    workers: form.value.workers,
    analysts: people(selection.analysts),
    siteAnalysisRecords: form.value.siteAnalysisRecords,
    relatedPermits: operationTypes.value
      .filter((item) => form.value.relatedOperationTypeIds.includes(item.id))
      .map((item) => ({ id: item.id, permitNo: '', operationTypeName: item.typeName })),
    safetyMeasures: form.value.safetyMeasures,
    customValues: buildCustomValues(),
    workDescription: form.value.workDescription || null,
    sitePhotoUrls: form.value.sitePhotoUrls
  })
  const formItems = computed<FormItem[]>(() => [
    { key: 'section-0', label: '基础与专项信息', type: 'tab' },
    {
      key: 'basicSection',
      label: '基础信息',
      type: 'divider',
      span: 24,
      description: '明确作业范围、时段与责任主体'
    },
    {
      key: 'permitNoDisplay',
      label: '作业证编号',
      type: 'text',
      props: { formatter: () => displayPermitNo.value }
    },
    {
      key: 'operationTypeId',
      label: '作业类型',
      type: 'select',
      options: enabledOperationTypes.value.map((item) => ({
        label: item.typeName,
        value: item.id
      })),
      props: {
        disabled: Boolean(forcedOperationTypeCode.value),
        placeholder: '请选择作业类型',
        onChange: handleOperationTypeChange
      }
    },
    {
      key: 'workStartTime',
      label: '作业开始时间',
      type: 'date',
      props: { type: 'datetime', valueFormat: 'YYYY-MM-DDTHH:mm:ssZ', placeholder: '选择开始时间' }
    },
    {
      key: 'workEndTime',
      label: '作业结束时间',
      type: 'date',
      props: { type: 'datetime', valueFormat: 'YYYY-MM-DDTHH:mm:ssZ', placeholder: '选择结束时间' }
    },
    {
      key: 'workContent',
      label: '作业内容',
      type: 'input',
      span: 24,
      props: { maxlength: 500, showWordLimit: true, placeholder: '说明本次作业的具体内容' }
    },
    {
      key: 'workLocation',
      label: '作业地点',
      type: 'input',
      props: { maxlength: 200, placeholder: '填写具体区域或设备位置' }
    },
    {
      key: 'workSection',
      label: '作业部位',
      type: 'input',
      props: { maxlength: 200, placeholder: '填写作业部位' }
    },
    {
      key: 'workUnit',
      label: '作业单位',
      type: 'input',
      props: { maxlength: 200, placeholder: '填写承包或执行单位' }
    },
    {
      key: 'relatedOperationTypeIds',
      label: '涉及其他作业',
      type: 'select',
      options: relatedTypeOptions.value.map((item) => ({ label: item.typeName, value: item.id })),
      props: {
        multiple: true,
        collapseTags: true,
        collapseTagsTooltip: true,
        placeholder: '可关联其他作业类型'
      }
    },
    {
      key: 'hotWorkSection',
      label: '动火专有信息',
      type: 'divider',
      span: 24,
      hidden: !isHotWork.value,
      description: '按动火作业制度补充级别、方式和危害因素'
    },
    {
      key: 'hotWorkLevel',
      label: '动火级别',
      type: 'select',
      hidden: !isHotWork.value,
      options: hotWorkLevelOptions.value,
      props: { placeholder: '请选择动火级别' }
    },
    {
      key: 'hotWorkMethods',
      label: '动火方式',
      type: 'select',
      hidden: !isHotWork.value,
      options: hotWorkMethodOptions.value,
      props: {
        multiple: true,
        collapseTags: true,
        collapseTagsTooltip: true,
        placeholder: '可多选动火方式'
      }
    },
    {
      key: 'hazardFactorIds',
      label: '危害因素',
      type: 'select',
      span: 24,
      hidden: !isHotWork.value,
      options: catalogs.hazards.map((item) => ({ label: item.itemName, value: item.id })),
      props: {
        multiple: true,
        collapseTags: true,
        collapseTagsTooltip: true,
        filterable: true,
        placeholder: '选择已识别的危害因素'
      }
    },
    {
      key: 'customSection',
      label: '作业专有信息',
      type: 'divider',
      span: 24,
      hidden: !visibleCustomFields.value.length,
      description: (selectedOperationType.value?.typeName || '当前作业类型') + '配置的专有字段'
    },
    ...visibleCustomFields.value.map((field): FormItem => {
      const common = {
        key: 'customValues.' + field.fieldCode,
        label: field.fieldLabel,
        formItemProps: {
          rules: field.required ? [requiredCustomFieldRule(field.fieldLabel)] : undefined
        }
      }
      if (field.fieldType === 'text' || field.fieldType === 'textarea')
        return {
          ...common,
          type: field.fieldType === 'textarea' ? 'textarea' : 'input',
          props: {
            maxlength: field.fieldType === 'textarea' ? 500 : 200,
            placeholder: field.placeholder || '填写' + field.fieldLabel
          }
        }
      if (field.fieldType === 'number')
        return {
          ...common,
          type: 'number',
          description: field.unit || undefined,
          props: {
            controls: false,
            min: 0,
            placeholder: field.placeholder || '填写' + field.fieldLabel
          }
        }
      if (field.fieldType === 'date' || field.fieldType === 'datetime')
        return {
          ...common,
          type: 'date',
          props: {
            type: field.fieldType,
            valueFormat: field.fieldType === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm:ssZ',
            placeholder: field.placeholder || '选择' + field.fieldLabel
          }
        }
      if (field.fieldType === 'single' || field.fieldType === 'multiple')
        return {
          ...common,
          type: 'select',
          options: field.options.map((option) => ({ label: option, value: option })),
          props: {
            multiple: field.fieldType === 'multiple',
            clearable: true,
            placeholder: field.placeholder || '选择' + field.fieldLabel
          }
        }
      return { ...common, type: 'switch' }
    }),
    {
      key: 'workAtHeightLevelDisplay',
      label: '作业级别',
      type: 'text',
      hidden: !isWorkAtHeight.value,
      description: '按最大作业高度自动判定',
      props: { formatter: () => workAtHeightLevel.value }
    },
    { key: 'section-1', label: '盲板配置', type: 'tab', hidden: !isBlindPlate.value },
    {
      key: 'blindPlateSection',
      label: '盲板抽堵配置',
      type: 'divider',
      span: 24,
      description: '按现场隔离方案逐块登记盲板工况、规格和标识'
    },
    { key: 'customValues.blind_plate_items', label: '盲板明细', type: 'custom', span: 24 },
    { key: 'section-2', label: '责任与人员', type: 'tab' },
    {
      key: 'responsibilitySection',
      label: '责任与交底',
      type: 'divider',
      span: 24,
      description: '人员均来自当前租户员工花名册'
    },
    {
      key: 'responsibleEmployeeId',
      label: '作业负责人',
      type: 'employeeSelect',
      props: {
        selectedData: selection.responsible,
        'onUpdate:selectedData': (value: EmployeeIntegrationItem[]) => {
          selection.responsible = value
        },
        tenantId: tenantId.value || undefined,
        placeholder: '选择作业负责人'
      }
    },
    ...(
      [
        ['guardianIds', 'guardians', '现场监护人'],
        ['verifierIds', 'verifiers', '作业验证人'],
        ['briefingGiverIds', 'briefingGivers', '安全交底人'],
        ['briefingReceiverIds', 'briefingReceivers', '接受交底人'],
        ['analystIds', 'analysts', '现场分析人']
      ] as const
    ).map(([key, selectionKey, label]): FormItem => ({
      key,
      label,
      type: 'employeeSelect',
      props: {
        multiple: true,
        modelValues: form.value[key],
        'onUpdate:modelValues': (value: string[]) => {
          form.value[key] = value
        },
        selectedData: selection[selectionKey],
        'onUpdate:selectedData': (value: EmployeeIntegrationItem[]) => {
          selection[selectionKey] = value
        },
        tenantId: tenantId.value || undefined,
        placeholder: '可多选' + label
      }
    })),
    {
      key: 'workersSection',
      label: '作业人员明细',
      type: 'divider',
      span: 24,
      description: '批量选择后自动带入员工与证书信息，允许按本次作业修正'
    },
    {
      key: 'workerIds',
      label: '批量添加作业人员',
      type: 'employeeSelect',
      span: 24,
      props: {
        multiple: true,
        modelValues: form.value.workerIds,
        'onUpdate:modelValues': (value: string[]) => {
          form.value.workerIds = value
        },
        selectedData: selection.workers,
        'onUpdate:selectedData': (value: EmployeeIntegrationItem[]) => {
          selection.workers = value
        },
        tenantId: tenantId.value || undefined,
        title: '批量添加作业人员',
        placeholder: '批量选择作业人员',
        onConfirmMultiple: handleWorkerConfirm
      }
    },
    { key: 'workers', label: '人员明细', type: 'custom', span: 24 },
    { key: 'section-3', label: '现场分析', type: 'tab' },
    {
      key: 'analysisSection',
      label: '现场分析',
      type: 'divider',
      span: 24,
      description: '分析项目随作业类型自动加载，可直接记录本次检测结果'
    },
    { key: 'siteAnalysisRecords', label: '现场分析记录', type: 'custom', span: 24 },
    { key: 'section-4', label: '安全与说明', type: 'tab' },
    {
      key: 'safetySection',
      label: '安全措施与现场说明',
      type: 'divider',
      span: 24,
      description: '逐项确认安全措施，并保留现场文字和影像记录'
    },
    { key: 'safetyMeasures', label: '安全措施', type: 'custom', span: 24 },
    {
      key: 'workDescription',
      label: '作业描述',
      type: 'textarea',
      props: { maxlength: 1000, placeholder: '补充作业环境、边界或注意事项' }
    },
    {
      key: 'sitePhotoUrls',
      label: '作业现场照片',
      type: 'uploadImage',
      span: 24,
      props: {
        resourceTenantId: tenantId.value || '',
        multiple: true,
        limit: 6,
        size: 104,
        tip: '支持 jpg、png，最多 6 张'
      }
    },
    { key: 'aiPrecheck', label: '', type: 'custom', span: 24 }
  ])

  const handleSave = async (submit: boolean): Promise<void> => {
    if (submit) {
      const currentForm = formRef.value
      if (!currentForm) return
      const validation = currentForm.validate()
      if (!validation) return
      const valid = await validation.catch(() => false)
      if (!valid) {
        return
      }
      if (isBlindPlate.value) {
        const tableValidation = await blindPlateItemsRef.value?.validate({ focus: false })
        if (tableValidation && !tableValidation.valid) {
          activePermitTab.value = 'section-1'
          await nextTick()
          if (tableValidation.firstError) {
            await blindPlateItemsRef.value?.validateField(tableValidation.firstError.prop)
            ElMessage.warning(tableValidation.firstError.message)
          }
          return
        }
      }
    } else if (!form.value.operationTypeId) {
      await formRef.value?.validateField('operationTypeId')
      return
    }
    submitMode.value = submit ? 'submit' : 'draft'
    submitting.value = true
    try {
      await saveSpecialOperationPermit(editingId.value, buildPayload(), submit, tenantId.value)
      await dialogRef.value?.handleClose()
      emit('success')
    } finally {
      submitting.value = false
    }
  }

  const handleOpen = async (data: SpecialOperationPermitDialogOpenData): Promise<void> => {
    Object.assign(form.value, emptyForm())
    resetSelections()
    operationTypes.value = data.operationTypes
    tenantId.value = data.tenantId || data.row?.tenantId || null
    forcedOperationTypeCode.value = data.forcedOperationTypeCode || null
    aiPrecheckPermission.value = data.aiPrecheckPermission
    aiPrecheckRef.value?.reset()
    editingId.value = data.mode === 'copy' ? undefined : data.row?.id
    sourcePermitNo.value = data.mode === 'copy' ? undefined : data.row?.permitNo
    const forcedType = operationTypes.value.find(
      (item) => item.typeCode === forcedOperationTypeCode.value
    )
    form.value.operationTypeId = forcedType?.id || enabledOperationTypes.value[0]?.id || ''
    loading.value = true
    try {
      await dialogRef.value?.handleOpen(data, {
        title:
          data.mode === 'edit'
            ? '编辑特殊作业票'
            : data.mode === 'copy'
              ? '复制特殊作业票'
              : '新增特殊作业票',
        subtitle:
          data.mode === 'copy'
            ? '已复制原单内容，保存时将生成新的作业证编号'
            : '保存草稿或校验完整后提交审批'
      })
      if (data.row?.id) {
        const result = await fetchSpecialOperationPermit(data.row.id, tenantId.value)
        if (result.data) hydrate(result.data)
        if (forcedType) form.value.operationTypeId = forcedType.id
        await loadCatalogs(true)
      } else await loadCatalogs(false)
    } finally {
      loading.value = false
    }
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .permit-form__measure-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 20px;
    padding: 12px 16px;
    background: var(--art-gray-100);
    border-radius: var(--art-control-radius);
  }

  .permit-form__footer {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    color: var(--el-text-color-secondary);
  }

  @media (width <= 900px) {
    .permit-form__measure-list {
      grid-template-columns: minmax(0, 1fr);
    }

    .permit-form__footer {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
