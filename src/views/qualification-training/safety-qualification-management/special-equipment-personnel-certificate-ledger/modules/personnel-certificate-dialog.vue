<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="certificate-dialog">
      <div class="certificate-dialog__employee">
        <ElAvatar :size="56" :src="employeeSelection[0]?.avatarUrl || undefined">{{
          employeeSelection[0]?.employeeName?.slice(-1) || '人'
        }}</ElAvatar>
        <div
          ><strong>{{ employeeSelection[0]?.employeeName || '从员工花名册选择持证人员' }}</strong
          ><p>{{ employeeContext }}</p></div
        >
        <span>人员信息实时联动花名册</span>
      </div>

      <ArtSectionCard title="人员与证件" subtitle="证件人员为主表，人员基础资料不重复录入">
        <ArtForm
          ref="formRef"
          v-model="form"
          :items="formItems"
          :rules="rules"
          :span="8"
          :gutter="20"
          scroll-to-error
        >
        </ArtForm>
      </ArtSectionCard>

      <SmisAiDocumentOcrPanel
        ref="ocrPanelRef"
        mode="certificate"
        :permission="aiPermission"
        :image-urls="certificateImageUrls"
        :category="form.certificateCategory"
        @apply-certificate="applyOcrResult"
      />

      <ArtSectionCard :title="categoryMeta.detailTitle" :subtitle="categoryMeta.detailSubtitle">
        <template v-if="!categoryMeta.certificateTermCode" #actions
          ><ElButton type="primary" plain @click="addItem"
            ><ArtSvgIcon icon="ri:add-line" />新增项目</ElButton
          ></template
        >
        <ArtTable
          ref="itemTableRef"
          :data="form.items"
          :columns="itemColumns"
          :pagination="false"
          row-key="key"
          table-layout="fixed"
          :empty-text="`请至少新增一条${categoryMeta.detailTitle}`"
        />
        <p class="certificate-dialog__hint"
          ><ArtSvgIcon icon="ri:information-line" />
          修改批准日期或有效日期时，系统自动保存旧值和新值，形成不可修改的复审记录。</p
        >
      </ArtSectionCard>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { toDictionaryOption } from '@/utils/form/option'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableText, normalizeSingleStringKey } from '@/utils/form/normalize'
  import { uniqBy } from 'lodash-es'
  import { ElButton, ElDatePicker, ElOption, ElSelect, type FormRules } from 'element-plus'
  import type { ColumnOption } from '@/types'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm from '@/components/core/forms/art-form/index.vue'
  import type { FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import type { ArtTableExpose } from '@/components/core/tables/art-table/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import SmisAiDocumentOcrPanel from '@smis/views/components/smis-ai-document-ocr-panel.vue'
  import {
    fetchPersonnelCertificateEmployeeDetail,
    fetchPersonnelCertificateEmployeeOptions,
    fetchPersonnelCertificateCatalogOptions,
    reviewPersonnelCertificateOcr,
    savePersonnelCertificate,
    type PersonnelCertificateEmployee,
    type SmisCertificateCategory,
    type SmisCertificateOcrResponse,
    type SmisCertificateDismissalReason,
    type SmisCertificateWarningStatus,
    type SmisPersonnelCertificate,
    type SmisPersonnelCertificateSavePayload,
    type SmisQualificationCatalog
  } from '@smis/api'
  import {
    getCertificateCategoryMeta,
    isCatalogAllowedForCertificateCategory
  } from './certificate-category-meta'

  export type PersonnelCertificateDialogMode = 'add' | 'edit' | 'copy'
  export interface PersonnelCertificateDialogOpenData {
    mode: PersonnelCertificateDialogMode
    row?: SmisPersonnelCertificate
    category?: SmisCertificateCategory
    pageTitle?: string
    aiPermission: string
  }
  interface ItemForm {
    key: string
    id?: string
    catalogId: string
    workCategoryId: string
    workCode: string
    approvalDate: string
    effectiveDate: string
    reminderDays: number
    dismissalReason?: SmisCertificateDismissalReason
    reviewCount: number
  }
  interface FormModel {
    id?: string
    employeeId: string
    employeeIdCardNo: string
    employeeEducationLevel: string
    certificateCategory: SmisCertificateCategory
    certificateNumber: string
    issuingAuthority: string
    archiveNumber: string
    certificatePhotoUrl: string
    warningStatus: SmisCertificateWarningStatus
    extraFields: Record<string, string>
    remark: string
    items: ItemForm[]
  }
  interface ArtFormExpose {
    validate: () => Promise<boolean | void>
    clearValidate: () => void
  }
  interface OcrPanelExpose {
    reset: () => void
  }

  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<PersonnelCertificateDialogOpenData>>()
  const formRef = ref<ArtFormExpose>()
  const itemTableRef = ref<ArtTableExpose>()
  const ocrPanelRef = ref<OcrPanelExpose>()
  const employeeSelection = ref<PersonnelCertificateEmployee[]>([])
  const catalogOptions = ref<SmisQualificationCatalog[]>([])
  const isEditing = ref(false)
  const isCategoryLocked = ref(false)
  const aiPermission = ref('')
  const ocrArtifactId = ref('')
  let itemSequence = 0
  const makeItem = (): ItemForm => ({
    key: `item-${++itemSequence}`,
    catalogId: '',
    workCategoryId: '',
    workCode: '',
    approvalDate: '',
    effectiveDate: '',
    reminderDays: 30,
    reviewCount: 0
  })
  const initial = (): FormModel => ({
    id: undefined,
    employeeId: '',
    employeeIdCardNo: '',
    employeeEducationLevel: '',
    certificateCategory: 'special_equipment_personnel',
    certificateNumber: '',
    issuingAuthority: '',
    archiveNumber: '',
    certificatePhotoUrl: '',
    warningStatus: 'normal',
    extraFields: {},
    remark: '',
    items: [makeItem()]
  })
  const form = ref<FormModel>(initial())
  const certificateImageUrls = computed(() =>
    form.value.certificatePhotoUrl ? [form.value.certificatePhotoUrl] : []
  )
  const rules = computed<FormRules<FormModel>>(() => {
    const result: FormRules<FormModel> = {
      employeeId: [{ required: true, message: '请选择持证人员', trigger: 'change' }],
      certificateCategory: [{ required: true, message: '请选择证件类别', trigger: 'change' }],
      certificateNumber: [{ required: true, message: '请输入证件编号', trigger: 'blur' }],
      warningStatus: [{ required: true, message: '请选择预警状态', trigger: 'change' }]
    }
    for (const field of categoryMeta.value.extraFields ?? []) {
      if (field.required) {
        result[`extraFields.${field.key}`] = [
          { required: true, message: field.placeholder, trigger: 'change' }
        ]
      }
    }
    return result
  })
  const dictOptions = (code: string) =>
    computed(() => (getDictMap.value[code] ?? []).map(toDictionaryOption))
  const dictionaryOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const categoryOptions = dictOptions('smisCertificateCategory')
  const warningOptions = dictOptions('commonWarningStatus')
  const reminderOptions = dictOptions('smisCertificateReminderDays')
  const dismissalOptions = dictOptions('smisCertificateDismissalReason')
  const categoryMeta = computed(() => getCertificateCategoryMeta(form.value.certificateCategory))
  const selectedCatalogIds = computed(() => form.value.items.map((item) => item.catalogId))
  const activeCatalogOptions = computed(() =>
    catalogOptions.value.filter(
      (item) =>
        isCatalogAllowedForCertificateCategory(item, form.value.certificateCategory) &&
        (item.status === 'enabled' || selectedCatalogIds.value.includes(item.id))
    )
  )
  const activeWorkCategoryOptions = computed(() =>
    catalogOptions.value.filter(
      (item) => item.catalogType === 'work_category' && item.status === 'enabled'
    )
  )
  const employeeSelectorSubtitle = computed(() =>
    categoryMeta.value.showEmployeeProfile
      ? '选择后自动带出性别、组织、岗位、手机号、身份证号和最高学历'
      : '选择后自动带出性别、组织、岗位、手机号和头像'
  )
  const projectColumnLabel = computed(() =>
    form.value.certificateCategory === 'special_operation' ? '准操项目' : '作业项目'
  )
  const approvalDateLabel = computed(() => {
    if (categoryMeta.value.approvalDateLabel) return categoryMeta.value.approvalDateLabel
    if (form.value.certificateCategory === 'safety_manager') return '发证日期'
    if (form.value.certificateCategory === 'special_operation') return '初次发证日期'
    return '批准日期'
  })
  const itemColumns = computed<ColumnOption<ItemForm>[]>(() => {
    const columns: ColumnOption<ItemForm>[] = []
    if (categoryMeta.value.showWorkCategory) {
      columns.push({
        prop: 'workCategoryId',
        label: '作业类别',
        minWidth: 190,
        required: true,
        formatter: (row) => (
          <ElSelect
            v-model={row.workCategoryId}
            filterable
            placeholder="请选择作业类别"
            onChange={() => handleWorkCategoryChange(row)}
          >
            {activeWorkCategoryOptions.value.map((item) => (
              <ElOption key={item.id} label={item.itemName} value={item.id} />
            ))}
          </ElSelect>
        )
      })
    }
    if (!categoryMeta.value.certificateTermCode) {
      columns.push(
        {
          prop: 'catalogId',
          label: projectColumnLabel.value,
          minWidth: 250,
          required: true,
          formatter: (row) => (
            <ElSelect
              v-model={row.catalogId}
              filterable
              disabled={categoryMeta.value.showWorkCategory && !row.workCategoryId}
              placeholder="请选择项目，编码将自动带出"
              onChange={() => syncCatalog(row)}
            >
              {activeCatalogOptionsFor(row).map((item) => (
                <ElOption
                  key={item.id}
                  label={`${item.itemCode} · ${item.itemName}`}
                  value={item.id}
                />
              ))}
            </ElSelect>
          )
        },
        {
          prop: 'workCode',
          label: '项目编码',
          width: 120,
          formatter: (row) => <span>{row.workCode || '—'}</span>
        }
      )
    }
    columns.push(
      {
        prop: 'approvalDate',
        label: approvalDateLabel.value,
        width: 160,
        required: true,
        formatter: (row) => (
          <ElDatePicker
            v-model={row.approvalDate}
            type="date"
            valueFormat="YYYY-MM-DD"
            placeholder={approvalDateLabel.value}
            class="!w-full"
          />
        )
      },
      {
        prop: 'effectiveDate',
        label: '有效日期',
        width: 160,
        required: true,
        rules: {
          validator: ({ value, row }) => !value || !row.approvalDate || value >= row.approvalDate,
          message: ({ rowIndex }) => `第 ${rowIndex + 1} 行有效日期不能早于批准日期`
        },
        formatter: (row) => (
          <ElDatePicker
            v-model={row.effectiveDate}
            type="date"
            valueFormat="YYYY-MM-DD"
            placeholder="有效日期"
            class="!w-full"
          />
        )
      },
      {
        prop: 'reminderDays',
        label: '提前提醒',
        width: 160,
        formatter: (row) => (
          <ElSelect v-model={row.reminderDays}>
            {reminderOptions.value.map((item) => (
              <ElOption key={item.value} label={item.label} value={Number(item.value)} />
            ))}
          </ElSelect>
        )
      }
    )
    if (isEditing.value) {
      columns.push({
        prop: 'dismissalReason',
        label: '消除提醒',
        width: 150,
        formatter: (row) => (
          <ElSelect v-model={row.dismissalReason} clearable placeholder="仅离岗/培训">
            {dismissalOptions.value.map((item) => (
              <ElOption key={item.value} label={item.label} value={item.value} />
            ))}
          </ElSelect>
        )
      })
    }
    if (!categoryMeta.value.certificateTermCode) {
      columns.push({
        prop: 'operation',
        label: '操作',
        width: 74,
        fixed: 'right',
        align: 'center',
        formatter: (row) => (
          <ElButton
            type="danger"
            link
            aria-label={row.reviewCount ? '已有复审记录，不能移除' : '删除作业项目'}
            disabled={Boolean(row.reviewCount)}
            onClick={() => removeItem(form.value.items.findIndex((item) => item.key === row.key))}
          >
            <ArtSvgIcon icon="ri:delete-bin-line" />
          </ElButton>
        )
      })
    }
    return columns
  })
  const employeeContext = computed(() => {
    const employee = employeeSelection.value[0]
    return employee
      ? [
          employee.employeeNo,
          employee.gender,
          employee.organization?.organizationName,
          employee.jobTitle,
          employee.phone,
          categoryMeta.value.showEmployeeProfile ? employee.idCardNo : '',
          categoryMeta.value.showEmployeeProfile ? employee.educationLevel : ''
        ]
          .filter(Boolean)
          .join(' · ')
      : employeeSelectorSubtitle.value
  })
  const formItems = computed<FormItem[]>(() => {
    const showEmployeeProfile = Boolean(categoryMeta.value.showEmployeeProfile)
    const employeeItems: FormItem[] = [
      {
        label: '姓名',
        key: 'employeeId',
        span: showEmployeeProfile ? 8 : 16,
        type: 'employeeSelect',
        get props(): FormItem['props'] {
          return {
            selectedData: employeeSelection.value,
            'onUpdate:selectedData': ($event: typeof employeeSelection.value) => {
              employeeSelection.value = $event
            },
            apiFn: fetchCertificateEmployees,
            title: '选择持证人员',
            subtitle: employeeSelectorSubtitle.value,
            onChange: handleEmployeeChange
          }
        }
      }
    ]
    if (showEmployeeProfile) {
      employeeItems.push(
        {
          label: '身份证号',
          key: 'employeeIdCardNo',
          type: 'input',
          props: { readonly: true, placeholder: '由员工花名册自动带出' }
        },
        {
          label: categoryMeta.value.employeeEducationLabel || '最高学历',
          key: 'employeeEducationLevel',
          type: 'input',
          props: { readonly: true, placeholder: '由员工花名册自动带出' }
        }
      )
    }
    const extraItems: FormItem[] = (categoryMeta.value.extraFields ?? []).map((field) => ({
      label: field.label,
      key: `extraFields.${field.key}`,
      type: field.type ?? 'input',
      options: field.dictCode ? dictionaryOptions(field.dictCode) : undefined,
      props: {
        clearable: true,
        maxlength: field.type === 'select' ? undefined : 120,
        placeholder: field.placeholder
      }
    }))
    return [
      ...employeeItems,
      {
        label: '证件类别',
        key: 'certificateCategory',
        type: 'select',
        options: categoryOptions.value,
        props: {
          disabled: isCategoryLocked.value,
          placeholder: '请选择证件类别',
          onChange: handleCategoryChange
        }
      },
      {
        label: '证件编号',
        key: 'certificateNumber',
        type: 'input',
        props: { maxlength: 100, placeholder: '请输入证件编号' }
      },
      {
        label: '发证机关',
        key: 'issuingAuthority',
        type: 'input',
        props: { maxlength: 200, placeholder: '请输入发证机关' }
      },
      {
        label: '档案编号',
        key: 'archiveNumber',
        type: 'input',
        props: { maxlength: 100, placeholder: '请输入档案编号' }
      },
      {
        label: '预警状态',
        key: 'warningStatus',
        type: 'radioGroup',
        options: warningOptions.value,
        props: { optionType: 'button' }
      },
      ...extraItems,
      {
        label: '证件照片',
        key: 'certificatePhotoUrl',
        span: 8,
        type: 'uploadImage',
        get props(): FormItem['props'] {
          return { title: '上传证件照片', limit: 1, size: 112 }
        }
      },
      {
        label: '备注',
        key: 'remark',
        type: 'textarea',
        span: 24,
        props: {
          rows: 3,
          maxlength: 1000,
          resize: 'none',
          placeholder: '补充证件管理说明（选填）'
        }
      }
    ]
  })
  const isItemForm = (row: unknown): row is ItemForm => {
    if (!row || typeof row !== 'object') return false
    return (
      'key' in row &&
      typeof row.key === 'string' &&
      'catalogId' in row &&
      typeof row.catalogId === 'string'
    )
  }
  const activeCatalogOptionsFor = (row: unknown): SmisQualificationCatalog[] => {
    if (!isItemForm(row)) return []
    return activeCatalogOptions.value.filter(
      (item) => !categoryMeta.value.showWorkCategory || item.workCategoryId === row.workCategoryId
    )
  }
  const syncCatalog = (row: unknown): void => {
    if (!isItemForm(row)) return
    const catalog = catalogOptions.value.find((item) => item.id === row.catalogId)
    row.workCode = catalog?.itemCode || ''
    row.workCategoryId = catalog?.workCategoryId || row.workCategoryId
  }
  const handleWorkCategoryChange = (row: unknown): void => {
    if (!isItemForm(row)) return
    row.catalogId = ''
    row.workCode = ''
  }
  const ensureCertificateTermItem = (): void => {
    const termCode = categoryMeta.value.certificateTermCode
    if (!termCode) return
    const term = catalogOptions.value.find(
      (item) => item.catalogType === 'certificate_term' && item.itemCode === termCode
    )
    if (!term) return
    const row = form.value.items[0] ?? makeItem()
    row.catalogId = term.id
    row.workCode = term.itemCode
    row.workCategoryId = ''
    form.value.items = [row]
  }
  const addItem = (): void => {
    form.value.items.push(makeItem())
  }
  const removeItem = (index: number): void => {
    if (form.value.items[index]?.reviewCount) {
      ElMessage.warning('已有复审记录的作业项目不能移除，请保留该项目的历史证据')
      return
    }
    form.value.items.splice(index, 1)
  }
  const handleCategoryChange = (): void => {
    form.value.extraFields = {}
    form.value.items = [makeItem()]
    void loadCatalogs()
    if (form.value.employeeId) void loadEmployeeDetail(form.value.employeeId)
  }
  const applyOcrResult = (result: SmisCertificateOcrResponse): void => {
    const appliedFields: string[] = []
    const certificate = result.certificate
    if (!form.value.certificateNumber.trim() && certificate.certificateNumber) {
      form.value.certificateNumber = certificate.certificateNumber
      appliedFields.push('证件编号')
    }
    if (!form.value.issuingAuthority.trim() && certificate.issuingAuthority) {
      form.value.issuingAuthority = certificate.issuingAuthority
      appliedFields.push('发证机关')
    }
    if (!form.value.archiveNumber.trim() && certificate.archiveNumber) {
      form.value.archiveNumber = certificate.archiveNumber
      appliedFields.push('档案编号')
    }
    const item = form.value.items[0]
    if (item && !item.approvalDate && certificate.approvalDate) {
      item.approvalDate = certificate.approvalDate
      appliedFields.push(approvalDateLabel.value)
    }
    if (item && !item.effectiveDate && certificate.effectiveDate) {
      item.effectiveDate = certificate.effectiveDate
      appliedFields.push('有效日期')
    }
    ocrArtifactId.value = result.artifactId
    const detectedName = certificate.holderName?.trim()
    const selectedName = employeeSelection.value[0]?.employeeName?.trim()
    if (detectedName && selectedName && detectedName !== selectedName) {
      ElMessage.warning(`证件姓名“${detectedName}”与所选人员“${selectedName}”不一致，请重点核验`)
      return
    }
    ElMessage.success(
      appliedFields.length
        ? `已补充${appliedFields.join('、')}，请人工复核`
        : '当前字段已有内容，识别结果未覆盖人工填写'
    )
  }
  const toEmployee = (row: SmisPersonnelCertificate): PersonnelCertificateEmployee => ({
    id: row.employeeId,
    tenantId: row.tenantId || '',
    employeeNo: row.employeeNo,
    employeeName: row.employeeName,
    avatarUrl: row.avatarUrl || null,
    gender: row.gender || null,
    idCardNo: row.idCardNo || null,
    educationLevel: row.educationLevel || null,
    phone: row.phone || '',
    jobTitle: row.jobTitle || null,
    employmentStatus: 'active',
    organization: row.organizationName
      ? { id: '', organizationCode: '', organizationName: row.organizationName }
      : null
  })

  const fetchCertificateEmployees = (
    params: Parameters<typeof fetchPersonnelCertificateEmployeeOptions>[1]
  ) => fetchPersonnelCertificateEmployeeOptions(form.value.certificateCategory, params)
  const loadEmployeeDetail = async (employeeId: string): Promise<void> => {
    const category = form.value.certificateCategory
    const result = await fetchPersonnelCertificateEmployeeDetail(category, employeeId)
    if (form.value.certificateCategory !== category || form.value.employeeId !== employeeId) return
    const employee = result.data
    if (!employee) return
    employeeSelection.value = [employee]
    form.value.employeeIdCardNo = employee.idCardNo?.trim() || ''
    form.value.employeeEducationLevel = employee.educationLevel?.trim() || ''
  }
  const handleEmployeeChange = (
    value: string | string[] | undefined,
    rows: EmployeeIntegrationItem[]
  ): void => {
    employeeSelection.value = rows
    form.value.employeeIdCardNo = ''
    form.value.employeeEducationLevel = ''
    const employeeId = normalizeSingleStringKey(value)
    if (employeeId) void loadEmployeeDetail(employeeId)
  }

  const validateItems = async (): Promise<boolean> => {
    if (!form.value.items.length) {
      ElMessage.warning('请至少新增一个作业项目')
      return false
    }
    const tableValidation = await itemTableRef.value?.validate()
    if (tableValidation?.valid === false) {
      return false
    }
    if (uniqBy(form.value.items, 'catalogId').length !== form.value.items.length) {
      ElMessage.warning('同一证件不能重复选择作业项目')
      return false
    }
    return true
  }
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (!(await validateItems())) return false
      const extraFields = (categoryMeta.value.extraFields ?? []).reduce<Record<string, string>>(
        (result, field) => {
          const value = form.value.extraFields[field.key]?.trim()
          if (value) result[field.key] = value
          return result
        },
        {}
      )
      const payload: SmisPersonnelCertificateSavePayload = {
        id: form.value.id,
        employeeId: form.value.employeeId,
        certificateCategory: form.value.certificateCategory,
        certificateNumber: form.value.certificateNumber.trim(),
        issuingAuthority: normalizeNullableText(form.value.issuingAuthority),
        archiveNumber: normalizeNullableText(form.value.archiveNumber),
        certificatePhotoUrl: form.value.certificatePhotoUrl || null,
        warningStatus: form.value.warningStatus,
        extraFields,
        remark: normalizeNullableText(form.value.remark),
        items: form.value.items.map((item) => ({
          id: item.id,
          catalogId: item.catalogId,
          approvalDate: item.approvalDate,
          effectiveDate: item.effectiveDate,
          reminderDays: Number(item.reminderDays),
          dismissalReason: isEditing.value ? item.dismissalReason || null : null
        }))
      }
      const response = await savePersonnelCertificate(payload)
      const entityId = form.value.id || response.data
      if (ocrArtifactId.value && entityId) {
        const firstItem = form.value.items[0]
        const review = await reviewPersonnelCertificateOcr({
          artifactId: ocrArtifactId.value,
          entityId,
          category: form.value.certificateCategory,
          finalPayload: {
            certificateNumber: form.value.certificateNumber.trim(),
            issuingAuthority: normalizeNullableText(form.value.issuingAuthority),
            archiveNumber: normalizeNullableText(form.value.archiveNumber),
            approvalDate: firstItem?.approvalDate || null,
            effectiveDate: firstItem?.effectiveDate || null
          }
        })
        if (review.error) console.warn('人员证件 OCR 反馈记录失败', review.error)
      }
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '人员证书保存失败，请检查内容后重试')
      return false
    }
  }
  const loadCatalogs = async (): Promise<void> => {
    const category = form.value.certificateCategory
    const result = await fetchPersonnelCertificateCatalogOptions(category)
    if (form.value.certificateCategory !== category) return
    catalogOptions.value = result.data
    ensureCertificateTermItem()
  }
  const handleOpen = async (data: PersonnelCertificateDialogOpenData): Promise<void> => {
    isEditing.value = data.mode === 'edit'
    isCategoryLocked.value = Boolean(data.category) || data.mode === 'edit'
    aiPermission.value = data.aiPermission
    ocrArtifactId.value = ''
    ocrPanelRef.value?.reset()
    Object.assign(form.value, initial())
    if (data.category) form.value.certificateCategory = data.category
    employeeSelection.value = []
    if (data.row) {
      Object.assign(form.value, {
        id: data.mode === 'edit' ? data.row.id : undefined,
        employeeId: data.row.employeeId,
        employeeIdCardNo: data.row.idCardNo || '',
        employeeEducationLevel: data.row.educationLevel || '',
        certificateCategory: data.row.certificateCategory,
        certificateNumber:
          data.mode === 'copy' ? `${data.row.certificateNumber}-副本` : data.row.certificateNumber,
        issuingAuthority: data.row.issuingAuthority || '',
        archiveNumber: data.row.archiveNumber || '',
        certificatePhotoUrl: data.row.certificatePhotoUrl || '',
        warningStatus: data.row.warningStatus,
        extraFields: { ...data.row.extraFields },
        remark: data.row.remark || '',
        items: data.row.items.map((item) => ({
          key: `item-${++itemSequence}`,
          id: data.mode === 'edit' ? item.id : undefined,
          catalogId: item.catalogId,
          workCategoryId: item.workCategoryId || '',
          workCode: item.workCode,
          approvalDate: item.approvalDate,
          effectiveDate: item.effectiveDate,
          reminderDays: item.reminderDays,
          dismissalReason: data.mode === 'edit' ? item.dismissalReason || undefined : undefined,
          reviewCount: data.mode === 'edit' ? item.reviewCount : 0
        }))
      })
      employeeSelection.value = [toEmployee(data.row)]
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title:
        data.mode === 'edit'
          ? `编辑${data.pageTitle || '人员证件'}`
          : data.mode === 'copy'
            ? `复制并新增${data.pageTitle || '人员证件'}`
            : `新增${data.pageTitle || '人员证件'}`,
      subtitle: categoryMeta.value.detailSubtitle.includes('复审记录')
        ? categoryMeta.value.detailSubtitle
        : `${categoryMeta.value.detailSubtitle}；日期变更自动形成复审记录`,
      confirmText: data.mode === 'copy' ? '复制并保存' : '保存人员证件',
      contentMaxHeight: 'calc(100vh - 128px)',
      onOpen: async (_data, api) => {
        api.setLoading(true)
        try {
          await Promise.all(
            [
              'smisCertificateCategory',
              'commonWarningStatus',
              'smisCertificateReminderDays',
              'smisCertificateDismissalReason',
              'smisSafetyManagerUnitType',
              'smisSafetyManagerOccupationType',
              'smisRegisteredSafetyOfficerType',
              'smisRegisteredEngineerType',
              'smisRegisteredPracticeCategory'
            ].map((code) => userStore.ensureDictLoaded(code))
          )
          await loadCatalogs()
          ensureCertificateTermItem()
          if (form.value.employeeId) await loadEmployeeDetail(form.value.employeeId)
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
  .certificate-dialog {
    display: grid;
    gap: 16px;

    &__employee {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 14px 16px;
      background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-base);

      p {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }

      > span {
        font-size: 12px;
        color: var(--theme-color);
      }
    }

    &__hint {
      display: flex;
      gap: 6px;
      align-items: center;
      margin: 12px 2px 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    :deep(.el-select),
    :deep(.el-date-editor) {
      width: 100%;
    }
  }

  @media (width <= 680px) {
    .certificate-dialog__employee {
      grid-template-columns: auto minmax(0, 1fr);

      > span {
        grid-column: 1/-1;
      }
    }
  }
</style>
