<template>
  <ArtDialog
    @open="
      () => {
        activeFormTab = 'reportSection'
      }
    "
    ref="dialogRef"
    size="xl"
  >
    <div class="inspection-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:shield-check-line" /></template>
        <strong>检验结果将同步进入设备全生命周期</strong>
        <p>报告编号按租户规则自动生成；检验类别、机构和图片证据均保留结构化关联。</p>
      </ArtEntitySummary>
      <ArtAsyncState
        v-if="categoryLoadError"
        size="compact"
        :error="'检验类别加载失败，请重新加载'"
        @retry="reloadCategoryOptions"
      />

      <ArtForm
        v-model:active-tab="activeFormTab"
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="24"
        label-position="top"
      >
      </ArtForm>

      <SmisAiDocumentOcrPanel
        ref="ocrPanelRef"
        mode="inspection"
        permission="SmisInspectionDeclaration:AiAnalyze"
        :image-urls="imageUrls"
        @apply-inspection="applyOcrResult"
      />
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { h } from 'vue'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { toDictionaryOption } from '@/utils/form/option'

  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import dayjs from 'dayjs'
  import { ElMessage, type FormRules } from 'element-plus'
  import type {
    DataSelectColumn,
    DataSelectFetchParams,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import SmisDataSourceEmptyActions from '@smis/views/components/smis-data-source-empty-actions.vue'
  import SmisAiDocumentOcrPanel from '@smis/views/components/smis-ai-document-ocr-panel.vue'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import { useUserStore } from '@/store/modules/user'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import {
    fetchEquipmentLedgerList,
    fetchInspectionCategoryList,
    fetchSupplierList,
    reviewEquipmentInspectionReportOcr,
    saveEquipmentInspection,
    type SmisEquipmentInspection,
    type SmisEquipmentInspectionConclusion,
    type SmisEquipmentInspectionImage,
    type SmisInspectionReportOcrResponse,
    type SmisEquipmentInspectionSavePayload,
    type SmisEquipmentInspectionStatus,
    type SmisInspectionCategory,
    type SmisInspectionCategorySearchParams
  } from '@smis/api'

  export interface InspectionDeclarationDialogOpenData {
    row?: SmisEquipmentInspection
    presetEquipmentId?: string
  }
  interface InspectionForm {
    id?: string
    inspectionNo: string
    equipmentId: string
    inspectionCategoryId: string
    inspectionInstitutionId: string
    inspectionDate: string
    conclusion: SmisEquipmentInspectionConclusion | ''
    nextDueDate: string
    needsExtension: boolean
    extensionDate: string
    reminderMonths: 1 | 2 | 3
    status: SmisEquipmentInspectionStatus
    images: string[]
    remark: string
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
    reloadOptions: (key?: string) => Promise<unknown>
  }
  interface OcrPanelExpose {
    reset: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const activeFormTab = ref('reportSection')
  const dialogRef = ref<ArtDialogExpose<InspectionDeclarationDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const ocrPanelRef = ref<OcrPanelExpose>()
  const equipmentSelection = shallowRef<DataSelectRecord[]>([])
  const institutionSelection = shallowRef<DataSelectRecord[]>([])
  const numberRule = useDocumentNumberRule('smis.equipment_inspection')
  const categoriesLoading = ref(false)
  const categoryLoadError = shallowRef<unknown>(null)
  const loadCategoryOptions = async (): Promise<{ data: SmisInspectionCategory[] }> => {
    categoriesLoading.value = true
    categoryLoadError.value = null
    dialogRef.value?.setOptions({ confirmDisabled: true })
    try {
      return {
        data: await loadAllDocumentPages<
          SmisInspectionCategory,
          SmisInspectionCategorySearchParams
        >((params) => fetchInspectionCategoryList(params, { showErrorMessage: false }), {
          status: 'enabled'
        })
      }
    } catch (error) {
      categoryLoadError.value = error
      return { data: [] }
    } finally {
      categoriesLoading.value = false
      dialogRef.value?.setOptions({ confirmDisabled: !!categoryLoadError.value })
    }
  }
  const reloadCategoryOptions = async (): Promise<void> => {
    await formRef.value?.reloadOptions('inspectionCategoryId')
  }

  const initialForm = (): InspectionForm => ({
    inspectionNo: '',
    equipmentId: '',
    inspectionCategoryId: '',
    inspectionInstitutionId: '',
    inspectionDate: dayjs().format('YYYY-MM-DD'),
    conclusion: '',
    nextDueDate: '',
    needsExtension: false,
    extensionDate: '',
    reminderMonths: 1,
    status: 'completed',
    images: [],
    remark: ''
  })
  const formModel = reactive<InspectionForm>(initialForm())
  const images = shallowRef<SmisEquipmentInspectionImage[]>([])
  const imageUrls = computed({
    get: () => formModel.images,
    set: (value: string[]) => {
      formModel.images = value
    }
  })
  const ocrArtifactId = ref('')

  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const conclusionOptions = computed(() => dictOptions('smisEquipmentInspectionConclusion'))
  const statusOptions = computed(() => dictOptions('smisEquipmentInspectionStatus'))
  const reminderOptions = computed(() =>
    dictOptions('smisEquipmentInspectionReminderMonths').map((item) => ({
      ...item,
      value: Number(item.value)
    }))
  )
  const booleanOptions = computed(() =>
    dictOptions('commonBoolean').map((item) => ({ ...item, value: item.value === 'true' }))
  )
  const inspectionNoProps = computed<Record<string, unknown>>(() =>
    numberRule.inputProps(Boolean(formModel.id), '系统自动生成检验报告编号', true)
  )

  const form = reactive<{
    model: InspectionForm
    images: SmisEquipmentInspectionImage[]
    items: ComputedRef<FormItem[]>
    rules: FormRules<InspectionForm>
  }>({
    model: formModel,
    images: images.value,
    items: computed(() => [
      { label: '申报与报告', key: 'reportSection', type: 'tab', span: 24 },
      {
        label: '检验报告编号',
        key: 'inspectionNo',
        type: 'input',
        description: numberRule.description.value,
        props: inspectionNoProps.value
      },
      {
        label: '检验状态',
        key: 'status',
        type: 'select',
        options: statusOptions.value,
        props: { clearable: false }
      },
      {
        label: '检验设备',
        key: 'equipmentId',
        span: 12,
        type: 'dataSelect',
        get props(): FormItem['props'] {
          return {
            mode: 'table',
            multiple: false,
            showSelectedPanel: false,
            selectedData: equipmentSelection.value,
            apiFn: fetchEquipmentOptions,
            columns: equipmentColumns,
            title: '选择检验设备',
            subtitle: '数据来自当前租户设备台账',
            labelKey: 'equipmentName',
            descriptionKey: 'equipmentCode',
            placeholder: '点击选择设备',
            emptyText: '暂无可检验设备',
            emptyDescription: '请先维护当前租户的设备台账，再创建检验申报。',
            showPagination: true
          }
        },
        slots: { empty: () => h(SmisDataSourceEmptyActions, { source: 'equipment' }) }
      },
      {
        label: '检验类别',
        key: 'inspectionCategoryId',
        type: 'selectV2',
        span: 12,
        api: loadCategoryOptions,
        immediate: false,
        resultField: 'data',
        labelField: 'categoryName',
        valueField: 'id',
        props: {
          filterable: true,
          disabled: categoriesLoading.value || !!categoryLoadError.value,
          placeholder: '请选择租户检验类别'
        }
      },
      { label: '检验结果与资料', key: 'resultSection', type: 'tab', span: 24 },
      {
        label: '检验日期',
        key: 'inspectionDate',
        type: 'date',
        props: { valueFormat: 'YYYY-MM-DD', clearable: false, class: '!w-full' }
      },
      {
        label: '检验结论',
        key: 'conclusion',
        type: 'select',
        options: conclusionOptions.value,
        props: { clearable: false }
      },
      {
        label: '检验机构',
        key: 'inspectionInstitutionId',
        span: 12,
        type: 'dataSelect',
        get props(): FormItem['props'] {
          return {
            mode: 'table',
            multiple: false,
            showSelectedPanel: false,
            selectedData: institutionSelection.value,
            apiFn: fetchInstitutionOptions,
            columns: institutionColumns,
            title: '选择检验机构',
            subtitle: '仅展示供应商主数据中分类为“检验机构”的单位',
            labelKey: 'supplierName',
            descriptionKey: 'supplierCode',
            placeholder: '点击选择检验机构',
            emptyText: '暂无可选检验机构',
            emptyDescription: '请在供应商主数据中新增单位，并将供应商类别设为“检验机构”。',
            showPagination: true
          }
        },
        slots: { empty: () => h(SmisDataSourceEmptyActions, { source: 'supplier' }) }
      },
      {
        label: '下次检验日期',
        key: 'nextDueDate',
        type: 'date',
        span: 12,
        props: { valueFormat: 'YYYY-MM-DD', class: '!w-full' }
      },
      {
        label: '是否需要下次检验延期',
        key: 'needsExtension',
        type: 'select',
        options: booleanOptions.value,
        props: { clearable: false }
      },
      {
        label: '检验延期日期',
        key: 'extensionDate',
        type: 'date',
        description: formModel.needsExtension
          ? '请选择获批后的延期日期。'
          : '选择“是”后方可维护延期日期。',
        props: {
          valueFormat: 'YYYY-MM-DD',
          class: '!w-full',
          disabled: !formModel.needsExtension,
          clearable: formModel.needsExtension
        }
      },
      {
        label: '提前提醒时间',
        key: 'reminderMonths',
        type: 'select',
        options: reminderOptions.value,
        props: { clearable: false }
      },

      {
        label: '检验图片',
        key: 'images',
        span: 24,
        type: 'uploadImage',
        description: '支持直接上传或从资源库选择，最多 9 张。',
        props: {
          title: '上传检验图片',
          size: 88,
          limit: 9,
          multiple: true,
          onResourceChange: handleImageResourceChange
        }
      },
      {
        label: '备注',
        key: 'remark',
        type: 'textarea',
        span: 24,
        props: {
          rows: 4,
          maxlength: 1000,
          showWordLimit: true,
          resize: 'none',
          placeholder: '补充检验范围、整改要求或延期依据'
        }
      }
    ]),
    rules: {
      inspectionNo: [
        {
          validator: (_rule, value, callback) => {
            if (numberRule.manualRequired(Boolean(formModel.id)) && !String(value || '').trim())
              callback(new Error('请输入检验报告编号'))
            else callback()
          },
          trigger: 'blur'
        }
      ],
      equipmentId: [{ required: true, message: '请选择检验设备', trigger: 'change' }],
      inspectionCategoryId: [{ required: true, message: '请选择检验类别', trigger: 'change' }],
      inspectionInstitutionId: [{ required: true, message: '请选择检验机构', trigger: 'change' }],
      inspectionDate: [{ required: true, message: '请选择检验日期', trigger: 'change' }],
      conclusion: [{ required: true, message: '请选择检验结论', trigger: 'change' }],
      extensionDate: [
        {
          validator: (_rule, value, callback) => {
            if (formModel.needsExtension && !value) callback(new Error('请选择检验延期日期'))
            else callback()
          },
          trigger: 'change'
        }
      ]
    }
  })

  watch(images, (value) => {
    form.images = value
    const nextUrls = value.map((image) => image.url)
    if (
      nextUrls.length !== imageUrls.value.length ||
      nextUrls.some((url, index) => url !== imageUrls.value[index])
    ) {
      imageUrls.value = nextUrls
    }
  })
  watch(imageUrls, (value) => {
    const visibleUrls = new Set(value)
    const nextImages = images.value.filter((image) => visibleUrls.has(image.url))
    if (nextImages.length !== images.value.length) images.value = nextImages
  })
  watch(
    () => form.model.needsExtension,
    (needsExtension) => {
      if (!needsExtension) form.model.extensionDate = ''
    }
  )

  const equipmentColumns: DataSelectColumn[] = [
    { prop: 'equipmentCode', label: '设备编码', minWidth: 150 },
    { prop: 'equipmentName', label: '设备名称', minWidth: 210 },
    { prop: 'categoryName', label: '设备分类', minWidth: 150 },
    { prop: 'organizationName', label: '使用部门', minWidth: 160 }
  ]
  const institutionColumns: DataSelectColumn[] = [
    { prop: 'supplierCode', label: '机构编码', minWidth: 150 },
    { prop: 'supplierName', label: '检验机构', minWidth: 240 },
    { prop: 'contactPerson', label: '联系人', minWidth: 120 },
    { prop: 'contactPhone', label: '联系电话', minWidth: 140 }
  ]
  const fetchEquipmentOptions = async (params: DataSelectFetchParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.page, size: params.pageSize })
    const result = await fetchEquipmentLedgerList({
      keyword: params.keyword,
      from,
      to
    })
    return {
      data: result.data.map((row) => ({
        ...row,
        categoryName: row.category.categoryName,
        organizationName: row.usingOrganization.organizationName
      })) as DataSelectRecord[],
      total: result.total
    }
  }
  const fetchInstitutionOptions = async (params: DataSelectFetchParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.page, size: params.pageSize })
    const result = await fetchSupplierList({
      keyword: params.keyword,
      supplierCategory: 'inspection_agency',
      from,
      to
    })
    return { data: result.data as DataSelectRecord[], total: result.total }
  }

  const handleImageResourceChange = (
    resources: Api.DataCenter.Resources.ResourceListItem[]
  ): void => {
    const known = new Set(images.value.map((item) => item.attachmentId))
    const additions = resources
      .filter((resource) => resource.id != null && resource.url && !known.has(String(resource.id)))
      .map((resource, index): SmisEquipmentInspectionImage => ({
        attachmentId: String(resource.id),
        sort: images.value.length + index,
        originName: resource.originName || `检验图片 ${images.value.length + index + 1}`,
        url: resource.url || '',
        mimeType: resource.mimeType,
        suffix: resource.suffix,
        sizeInfo: resource.sizeInfo
      }))
    images.value = [...images.value, ...additions].slice(0, 9)
  }

  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, initialForm())
    images.value = []
    imageUrls.value = []
    ocrArtifactId.value = ''
    ocrPanelRef.value?.reset()
    equipmentSelection.value = []
    institutionSelection.value = []
    await nextTick()
    formRef.value?.clearValidate()
  }
  const buildPayload = (): SmisEquipmentInspectionSavePayload => ({
    id: form.model.id,
    inspectionNo: form.model.inspectionNo.trim(),
    equipmentId: form.model.equipmentId,
    inspectionCategoryId: form.model.inspectionCategoryId,
    inspectionInstitutionId: form.model.inspectionInstitutionId,
    inspectionDate: form.model.inspectionDate,
    conclusion: form.model.conclusion as SmisEquipmentInspectionConclusion,
    nextDueDate: form.model.nextDueDate || null,
    needsExtension: form.model.needsExtension,
    extensionDate: form.model.needsExtension ? form.model.extensionDate || null : null,
    reminderMonths: form.model.reminderMonths,
    status: form.model.status,
    remark: form.model.remark.trim(),
    imageAttachmentIds: images.value.map((item) => item.attachmentId)
  })
  const applyOcrResult = (result: SmisInspectionReportOcrResponse): void => {
    const appliedFields: string[] = []
    const report = result.report
    if (report.inspectionDate && form.model.inspectionDate === dayjs().format('YYYY-MM-DD')) {
      form.model.inspectionDate = report.inspectionDate
      appliedFields.push('检验日期')
    }
    if (!form.model.conclusion && report.conclusion) {
      form.model.conclusion = report.conclusion
      appliedFields.push('检验结论')
    }
    if (!form.model.nextDueDate && report.nextDueDate) {
      form.model.nextDueDate = report.nextDueDate
      appliedFields.push('下次检验日期')
    }
    if (!form.model.remark.trim()) {
      const remarkParts = [
        report.reportNumber ? `外部报告编号：${report.reportNumber}` : '',
        report.remark || ''
      ].filter(Boolean)
      if (remarkParts.length) {
        form.model.remark = remarkParts.join('；').slice(0, 1000)
        appliedFields.push('备注')
      }
    }
    ocrArtifactId.value = result.artifactId
    const selectedEquipment = equipmentSelection.value[0]
    if (
      report.equipmentCode &&
      selectedEquipment?.equipmentCode &&
      report.equipmentCode.trim() !== String(selectedEquipment.equipmentCode).trim()
    ) {
      ElMessage.warning('报告设备编码与所选设备不一致，请重点核验后再保存')
      return
    }
    ElMessage.success(
      appliedFields.length
        ? `已补充${appliedFields.join('、')}，请人工复核`
        : '当前字段已有内容，识别结果未覆盖人工填写'
    )
  }
  const handleSubmit = async (): Promise<boolean> => {
    if (categoriesLoading.value || categoryLoadError.value) return false
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const response = await saveEquipmentInspection(buildPayload())
      const entityId = form.model.id || response.data
      if (ocrArtifactId.value && entityId) {
        const review = await reviewEquipmentInspectionReportOcr({
          artifactId: ocrArtifactId.value,
          entityId,
          finalPayload: {
            inspectionDate: form.model.inspectionDate,
            conclusion: form.model.conclusion,
            nextDueDate: form.model.nextDueDate || null,
            remark: normalizeNullableText(form.model.remark)
          }
        })
        if (review.error) console.warn('设备检验报告 OCR 反馈记录失败', review.error)
      }
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '设备检验申报保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: InspectionDeclarationDialogOpenData): Promise<void> => {
    categoryLoadError.value = null
    await resetForm()
    if (data.row) {
      Object.assign(form.model, {
        id: data.row.id,
        inspectionNo: data.row.inspectionNo,
        equipmentId: data.row.equipmentId,
        inspectionCategoryId: data.row.inspectionCategoryId,
        inspectionInstitutionId: data.row.inspectionInstitutionId,
        inspectionDate: data.row.inspectionDate,
        conclusion: data.row.conclusion,
        nextDueDate: data.row.nextDueDate || '',
        needsExtension: data.row.needsExtension,
        extensionDate: data.row.extensionDate || '',
        reminderMonths: data.row.reminderMonths,
        status: data.row.status,
        remark: data.row.remark || ''
      })
      equipmentSelection.value = [
        {
          id: data.row.equipment.id,
          equipmentCode: data.row.equipment.equipmentCode,
          equipmentName: data.row.equipment.equipmentName,
          equipmentKind: data.row.equipment.equipmentKind,
          model: data.row.equipment.model,
          categoryName: data.row.equipment.categoryName,
          organizationName: data.row.equipment.organizationName
        }
      ]
      institutionSelection.value = data.row.inspectionInstitution
        ? [
            {
              id: data.row.inspectionInstitution.id,
              supplierCode: data.row.inspectionInstitution.supplierCode,
              supplierName: data.row.inspectionInstitution.supplierName
            }
          ]
        : []
      images.value = [...data.row.images]
    } else if (data.presetEquipmentId) {
      form.model.equipmentId = data.presetEquipmentId
    }
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑检验申报' : '新增检验申报',
      subtitle: '维护检验报告、结论、延期与图片证据',
      confirmText: data.row ? '保存检验申报' : '创建检验申报',
      contentMaxHeight: 'calc(100vh - 176px)',
      loading: true,
      confirmDisabled: true,
      onOpen: async (_data, api) => {
        try {
          await Promise.all([
            numberRule.loadRule(),
            reloadCategoryOptions(),
            ...[
              'commonBoolean',
              'smisEquipmentInspectionConclusion',
              'smisEquipmentInspectionReminderMonths',
              'smisEquipmentInspectionStatus'
            ].map((code) => userStore.ensureDictLoaded(code))
          ])
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit,
      onReset: () => void resetForm()
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .inspection-dialog {
    display: grid;
    gap: var(--art-space-4);

    &__upload-help {
      margin: 7px 0 0;
      font-size: 12px;
      line-height: 18px;
      color: var(--el-text-color-secondary);
    }
  }
</style>
