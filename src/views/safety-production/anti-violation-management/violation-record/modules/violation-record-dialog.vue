<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="violation-record-dialog">
      <ElAlert v-if="optionsError" type="error" :closable="false" show-icon>
        <template #title>场所和违章标准加载失败</template>
        <ElButton link type="primary" @click="loadOptions">重新加载</ElButton>
      </ElAlert>
      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="24"
        label-position="top"
      >
        <template #violatorEmployeeIds>
          <ArtEmployeeSelect
            multiple
            v-model:model-values="form.model.violatorEmployeeIds"
            v-model:selected-data="violatorSelection"
            :tenant-id="recordTenantId"
            title="选择违章人员"
            placeholder="从员工花名册批量选择"
            :display-fields="['organization', 'jobTitle']"
          />
        </template>

        <template #siteId>
          <AntiViolationSiteSelect
            v-model="form.model.siteId"
            v-model:selected-data="siteSelection"
            :sites="sites"
          />
        </template>

        <template #standardIds>
          <AntiViolationStandardMultipleSelect
            v-model="form.model.standardIds"
            v-model:selected-data="standardSelection"
            :standards="standards"
          />
        </template>

        <template #checkerEmployeeId>
          <ArtEmployeeSelect
            v-model="form.model.checkerEmployeeId"
            v-model:selected-data="checkerSelection"
            :tenant-id="recordTenantId"
            title="选择检查人"
            subtitle="数据来自当前租户员工花名册"
            placeholder="从员工花名册选择"
          />
        </template>

        <template #imageUrls>
          <ArtUploadImage
            v-model="form.model.imageUrls"
            title="上传违章现场图片"
            multiple
            :limit="12"
            :size="104"
          />
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import {
    saveViolationRecord,
    type SmisAntiViolationStandardOption,
    type SmisSite,
    type SmisViolationRecord,
    type SmisViolationRecordSavePayload
  } from '@smis/api'
  import AntiViolationSiteSelect from '../../shared/anti-violation-site-select.vue'
  import AntiViolationStandardMultipleSelect from '../../shared/anti-violation-standard-multiple-select.vue'

  export type ViolationRecordDialogMode = 'add' | 'edit' | 'copy'
  export interface ViolationRecordDialogOpenData {
    mode: ViolationRecordDialogMode
    row?: SmisViolationRecord
    sites: SmisSite[]
    standards: SmisAntiViolationStandardOption[]
    loadOptions?: () => Promise<{
      sites: SmisSite[]
      standards: SmisAntiViolationStandardOption[]
    }>
  }

  interface ViolationRecordForm extends SmisViolationRecordSavePayload {
    deductionPoints: number
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [mode: ViolationRecordDialogMode] }>()
  const dialogRef = ref<ArtDialogExpose<ViolationRecordDialogOpenData>>()
  const recordTenantId = ref<string>()
  const formRef = ref<FormExpose>()
  const mode = ref<ViolationRecordDialogMode>('add')
  const sites = shallowRef<SmisSite[]>([])
  const standards = shallowRef<SmisAntiViolationStandardOption[]>([])
  const optionsError = ref(false)
  const optionsLoader = shallowRef<ViolationRecordDialogOpenData['loadOptions']>()
  const violatorSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const checkerSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const siteSelection = shallowRef<SmisSite[]>([])
  const standardSelection = shallowRef<SmisAntiViolationStandardOption[]>([])

  const createInitialForm = (): ViolationRecordForm => ({
    id: undefined,
    operation: 'add',
    violationTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    siteId: '',
    checkerEmployeeId: '',
    violatorEmployeeIds: [],
    standardIds: [],
    deductionPoints: 0,
    fineAmount: 0,
    situationDescription: '',
    imageUrls: [],
    remark: ''
  })

  const form = reactive<{
    model: ViolationRecordForm
    items: ComputedRef<FormItem[]>
    rules: FormRules<ViolationRecordForm>
  }>({
    model: createInitialForm(),
    items: computed(() => [
      { label: '记录对象', key: 'peopleSection', type: 'divider', span: 24 },
      { label: '违章人员', key: 'violatorEmployeeIds', type: 'text', span: 16 },
      {
        label: '违章时间',
        key: 'violationTime',
        type: 'date',
        span: 8,
        props: {
          type: 'datetime',
          valueFormat: 'YYYY-MM-DD HH:mm:ss',
          format: 'YYYY-MM-DD HH:mm',
          class: '!w-full',
          placeholder: '请选择违章时间'
        }
      },
      { label: '违章地点', key: 'siteId', type: 'text', span: 12 },
      { label: '检查人', key: 'checkerEmployeeId', type: 'text', span: 12 },
      { label: '违章项目', key: 'standardSection', type: 'divider', span: 24 },
      { label: '选择违章项目', key: 'standardIds', type: 'text', span: 24 },
      {
        label: '扣减分值',
        key: 'deductionPoints',
        type: 'number',
        span: 8,
        props: { disabled: true, precision: 2, class: '!w-full' }
      },
      {
        label: '罚款金额（元）',
        key: 'fineAmount',
        type: 'number',
        span: 8,
        props: { min: 0, precision: 2, step: 10, controlsPosition: 'right', class: '!w-full' }
      },
      {
        label: '现场情况补充',
        key: 'situationDescription',
        type: 'input',
        span: 24,
        props: {
          type: 'textarea',
          rows: 3,
          maxlength: 3000,
          showWordLimit: true,
          resize: 'none',
          placeholder: '补充标准项目之外的现场表现、原因或处置情况'
        }
      },
      { label: '现场证据', key: 'evidenceSection', type: 'divider', span: 24 },
      { label: '违章图片', key: 'imageUrls', type: 'text', span: 24 },
      {
        label: '备注',
        key: 'remark',
        type: 'input',
        span: 24,
        props: {
          type: 'textarea',
          rows: 2,
          maxlength: 1000,
          showWordLimit: true,
          resize: 'none',
          placeholder: '可补充复核、处置或其他说明'
        }
      }
    ]),
    rules: {
      violatorEmployeeIds: [
        {
          type: 'array',
          required: true,
          min: 1,
          message: '请至少选择一名违章人员',
          trigger: 'change'
        }
      ],
      violationTime: [{ required: true, message: '请选择违章时间', trigger: 'change' }],
      siteId: [{ required: true, message: '请选择违章地点', trigger: 'change' }],
      checkerEmployeeId: [{ required: true, message: '请选择检查人', trigger: 'change' }],
      standardIds: [
        {
          type: 'array',
          required: true,
          min: 1,
          message: '请至少选择一个违章项目',
          trigger: 'change'
        }
      ],
      fineAmount: [{ required: true, message: '请输入罚款金额', trigger: 'blur' }]
    }
  })

  watch(
    standardSelection,
    (rows) => {
      form.model.deductionPoints = rows.reduce(
        (total, item) => total + Number(item.deductionPoints || 0),
        0
      )
    },
    { deep: true }
  )

  const toEmployeeSelection = (
    people: SmisViolationRecord['violators'],
    tenantId: string
  ): EmployeeIntegrationItem[] =>
    people.map((person) => ({
      id: person.id,
      tenantId,
      organizationId: person.organizationId,
      employeeNo: person.employeeNo,
      employeeName: person.employeeName,
      avatarUrl: person.avatarUrl,
      jobTitle: person.positionName,
      employmentStatus: 'active',
      organization: person.organizationId
        ? {
            id: person.organizationId,
            organizationCode: '',
            organizationName: person.organizationName || '未分配组织'
          }
        : null
    }))

  const toCheckerSelection = (row: SmisViolationRecord): EmployeeIntegrationItem[] => [
    {
      id: row.checkerEmployeeId,
      tenantId: row.tenantId,
      employeeNo: '',
      employeeName: row.checkerName,
      jobTitle: row.checkerPositionName,
      employmentStatus: 'active',
      organization: row.checkerOrganizationName
        ? { id: '', organizationCode: '', organizationName: row.checkerOrganizationName }
        : null
    }
  ]

  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, createInitialForm())
    violatorSelection.value = []
    checkerSelection.value = []
    siteSelection.value = []
    standardSelection.value = []
    await nextTick()
    formRef.value?.clearValidate()
  }

  const initializeFromRow = (row: SmisViolationRecord): void => {
    Object.assign(form.model, {
      id: mode.value === 'edit' ? row.id : undefined,
      operation: mode.value,
      violationTime:
        mode.value === 'copy'
          ? dayjs().format('YYYY-MM-DD HH:mm:ss')
          : dayjs(row.violationTime).format('YYYY-MM-DD HH:mm:ss'),
      siteId: row.siteId,
      checkerEmployeeId: row.checkerEmployeeId,
      violatorEmployeeIds: row.violators.map((item) => item.id),
      standardIds: row.items.map((item) => item.id),
      deductionPoints: Number(row.deductionPoints),
      fineAmount: Number(row.fineAmount),
      situationDescription: row.situationDescription || '',
      imageUrls: [...row.imageUrls],
      remark: row.remark || ''
    })
    violatorSelection.value = toEmployeeSelection(row.violators, row.tenantId)
    checkerSelection.value = toCheckerSelection(row)
    siteSelection.value = sites.value.filter((item) => item.id === row.siteId)
    standardSelection.value = row.items.map((item) => ({
      id: item.id,
      standardCode: item.standardCode,
      standardName: item.standardName,
      categoryId: item.categoryId || '',
      categoryName: item.categoryName,
      deductionPoints: Number(item.deductionPoints)
    }))
  }

  const handleSubmit = async (): Promise<boolean> => {
    if (optionsError.value) return false
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const payload: SmisViolationRecordSavePayload = {
        id: form.model.id,
        operation: mode.value,
        violationTime: dayjs(form.model.violationTime).toISOString(),
        siteId: form.model.siteId,
        checkerEmployeeId: form.model.checkerEmployeeId,
        violatorEmployeeIds: [...form.model.violatorEmployeeIds],
        standardIds: [...form.model.standardIds],
        fineAmount: Number(form.model.fineAmount || 0),
        situationDescription: normalizeNullableText(form.model.situationDescription),
        imageUrls: [...form.model.imageUrls],
        remark: normalizeNullableText(form.model.remark)
      }
      await saveViolationRecord(payload)
      emit('success', mode.value)
      return true
    } catch (error) {
      notifyFriendlyError(error, '违章记录保存失败，请检查内容后重试')
      return false
    }
  }

  const loadOptions = async (): Promise<void> => {
    if (!optionsLoader.value) return
    optionsError.value = false
    dialogRef.value?.setLoading(true)
    try {
      const options = await optionsLoader.value()
      sites.value = options.sites
      standards.value = options.standards
    } catch {
      optionsError.value = true
    } finally {
      dialogRef.value?.setLoading(false)
    }
  }

  const handleOpen = async (data: ViolationRecordDialogOpenData): Promise<void> => {
    mode.value = data.mode
    recordTenantId.value = data.row?.tenantId
    sites.value = data.sites
    standards.value = data.standards
    optionsError.value = false
    optionsLoader.value = data.loadOptions
    await dialogRef.value?.handleOpen(data, {
      title:
        data.mode === 'edit'
          ? '编辑违章记录'
          : data.mode === 'copy'
            ? '复制并新增违章记录'
            : '新增违章记录',
      subtitle: '违章编号由系统保存时自动生成；人员、场所与项目均来自权威主数据。',
      confirmText: '保存记录',
      contentMaxHeight: 'calc(100vh - 176px)',
      loading: Boolean(data.loadOptions),
      loadingText: '正在加载场所和违章标准…',
      onOpen: async (_data, api) => {
        try {
          await resetForm()
          form.model.operation = data.mode
          if (data.row) initializeFromRow(data.row)
          await loadOptions()
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .violation-record-dialog {
    min-width: 0;
  }
</style>
