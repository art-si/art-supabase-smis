<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="three-violation-dialog">
      <div class="three-violation-dialog__context" role="note">
        <ElAvatar :size="52" :src="inspectedSelection[0]?.avatarUrl || undefined">
          {{ inspectedSelection[0]?.employeeName?.slice(-1) || '人' }}
        </ElAvatar>
        <div>
          <strong>{{ inspectedSelection[0]?.employeeName || '从员工花名册选择被检查人' }}</strong>
          <p>
            {{ employeeContext }}
          </p>
        </div>
        <ArtDictDisplay
          dict-code="smisThreeViolationEducationStatus"
          value="pending"
          display="tag"
        />
      </div>

      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="24"
        label-position="top"
      >
        <template #inspectedEmployeeId>
          <ArtEmployeeSelect
            v-model="form.model.inspectedEmployeeId"
            v-model:selected-data="inspectedSelection"
            :tenant-id="recordTenantId"
            title="选择被检查人"
            subtitle="人员、照片、组织和岗位均来自当前租户员工花名册"
            placeholder="请选择被检查人"
          />
        </template>
        <template #checkerEmployeeId>
          <ArtEmployeeSelect
            v-model="form.model.checkerEmployeeId"
            v-model:selected-data="checkerSelection"
            :tenant-id="recordTenantId"
            title="选择检查人"
            subtitle="按姓名、工号、组织或岗位检索"
            placeholder="请选择检查人"
          />
        </template>
        <template #responsibleEmployeeIds>
          <ArtEmployeeSelect
            multiple
            v-model:model-values="form.model.responsibleEmployeeIds"
            v-model:selected-data="responsibleSelection"
            :tenant-id="recordTenantId"
            title="选择教育负责人"
            subtitle="支持多选，教育台账将保留负责人快照"
            placeholder="请选择一名或多名教育负责人"
          />
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'

  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    saveThreeViolationEducation,
    type SmisAntiViolationStandardOption,
    type SmisThreeViolationEducation,
    type SmisThreeViolationEducationSavePayload,
    type SmisThreeViolationWarningStatus
  } from '@smis/api'

  export type ThreeViolationDialogMode = 'add' | 'edit' | 'copy'
  export interface ThreeViolationDialogOpenData {
    mode: ThreeViolationDialogMode
    row?: SmisThreeViolationEducation
    standards: SmisAntiViolationStandardOption[]
  }

  interface FormModel {
    id?: string
    inspectedEmployeeId: string
    checkerEmployeeId: string
    standardId: string
    warningStatus: SmisThreeViolationWarningStatus
    inspectionTime: string
    violationDescription: string
    plannedEducationContent: string
    responsibleEmployeeIds: string[]
    remark: string
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [mode: ThreeViolationDialogMode] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<ThreeViolationDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const standards = shallowRef<SmisAntiViolationStandardOption[]>([])
  const currentMode = ref<ThreeViolationDialogMode>('add')
  const recordTenantId = ref<string>()
  const inspectedSelection = ref<EmployeeIntegrationItem[]>([])
  const checkerSelection = ref<EmployeeIntegrationItem[]>([])
  const responsibleSelection = ref<EmployeeIntegrationItem[]>([])

  const initial = (): FormModel => ({
    id: undefined,
    inspectedEmployeeId: '',
    checkerEmployeeId: '',
    standardId: '',
    warningStatus: 'normal',
    inspectionTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    violationDescription: '',
    plannedEducationContent: '',
    responsibleEmployeeIds: [],
    remark: ''
  })

  const warningOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.commonWarningStatus ?? []).map(toDictionaryOption)
  )
  const standardOptions = computed<FormItemOption[]>(() =>
    standards.value.map((item) => ({
      label: `${item.standardCode} · ${item.standardName}`,
      value: item.id,
      description: `${item.categoryName} · ${item.deductionPoints} 分`
    }))
  )
  const employeeContext = computed(() => {
    const employee = inspectedSelection.value[0]
    if (!employee) return '选择后自动带出员工照片、工号、组织和岗位信息。'
    return [employee.employeeNo, employee.organization?.organizationName, employee.jobTitle]
      .filter(Boolean)
      .join(' · ')
  })

  const textareaProps = (placeholder: string, maxlength: number, rows = 4) => ({
    rows,
    maxlength,
    showWordLimit: true,
    resize: 'none',
    placeholder
  })

  const form = reactive<{
    model: FormModel
    items: ComputedRef<FormItem[]>
    rules: FormRules<FormModel>
  }>({
    model: initial(),
    items: computed(() => [
      { label: '人员与检查信息', key: 'inspection', type: 'divider', span: 24 },
      { label: '被检查人', key: 'inspectedEmployeeId', span: 12 },
      { label: '检查人', key: 'checkerEmployeeId', span: 12 },
      {
        label: '检查时间',
        key: 'inspectionTime',
        type: 'date',
        props: {
          type: 'datetime',
          valueFormat: 'YYYY-MM-DD HH:mm:ss',
          format: 'YYYY-MM-DD HH:mm',
          clearable: false,
          class: '!w-full'
        }
      },
      {
        label: '预警状态',
        key: 'warningStatus',
        type: 'radioGroup',
        options: warningOptions.value
      },
      {
        label: '关联反违章标准',
        key: 'standardId',
        type: 'select',
        span: 24,
        options: standardOptions.value,
        props: {
          clearable: true,
          filterable: true,
          placeholder: '可选：关联标准库条目，统一违章认定与扣分口径'
        }
      },
      {
        label: '三违问题描述',
        key: 'violationDescription',
        type: 'textarea',
        span: 24,
        props: textareaProps('描述违章时间、地点、行为和现场情况', 3000, 5)
      },
      { label: '教育安排', key: 'education', type: 'divider', span: 24 },
      { label: '教育负责人', key: 'responsibleEmployeeIds', span: 24 },
      {
        label: '拟教育内容',
        key: 'plannedEducationContent',
        type: 'textarea',
        span: 24,
        props: textareaProps('填写拟开展的规程学习、案例警示或专项教育内容', 3000)
      },
      {
        label: '备注',
        key: 'remark',
        type: 'textarea',
        span: 24,
        props: textareaProps('补充说明（选填）', 1000, 3)
      }
    ]),
    rules: {
      inspectedEmployeeId: [{ required: true, message: '请选择被检查人', trigger: 'change' }],
      checkerEmployeeId: [{ required: true, message: '请选择检查人', trigger: 'change' }],
      inspectionTime: [{ required: true, message: '请选择检查时间', trigger: 'change' }],
      warningStatus: [{ required: true, message: '请选择预警状态', trigger: 'change' }],
      violationDescription: [{ required: true, message: '请输入三违问题描述', trigger: 'blur' }],
      responsibleEmployeeIds: [
        {
          required: true,
          type: 'array',
          min: 1,
          message: '请至少选择一名教育负责人',
          trigger: 'change'
        }
      ]
    }
  })

  const toEmployee = (
    row: SmisThreeViolationEducation,
    kind: 'inspected' | 'checker'
  ): EmployeeIntegrationItem => ({
    id: kind === 'inspected' ? row.inspectedEmployeeId : row.checkerEmployeeId,
    tenantId: row.tenantId,
    employeeNo: kind === 'inspected' ? row.employeeNo : '',
    employeeName: kind === 'inspected' ? row.employeeName : row.checkerName,
    avatarUrl: kind === 'inspected' ? row.avatarUrl : null,
    jobTitle: kind === 'inspected' ? row.positionName : row.checkerPositionName,
    employmentStatus: 'active',
    organization:
      kind === 'inspected' && row.organizationId
        ? {
            id: row.organizationId,
            organizationCode: '',
            organizationName: row.organizationName || ''
          }
        : null
  })

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const payload: SmisThreeViolationEducationSavePayload = {
        id: form.model.id,
        operation: form.model.id ? 'edit' : currentMode.value,
        inspectedEmployeeId: form.model.inspectedEmployeeId,
        checkerEmployeeId: form.model.checkerEmployeeId,
        standardId: form.model.standardId || null,
        warningStatus: form.model.warningStatus,
        inspectionTime: dayjs(form.model.inspectionTime).toISOString(),
        violationDescription: form.model.violationDescription.trim(),
        plannedEducationContent: normalizeNullableText(form.model.plannedEducationContent),
        responsibleEmployeeIds: [...form.model.responsibleEmployeeIds],
        remark: normalizeNullableText(form.model.remark)
      }
      await saveThreeViolationEducation(payload)
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '三违教育保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: ThreeViolationDialogOpenData): Promise<void> => {
    currentMode.value = data.mode
    recordTenantId.value = data.row?.tenantId
    Object.assign(form.model, initial())
    standards.value = data.standards
    inspectedSelection.value = []
    checkerSelection.value = []
    responsibleSelection.value = []
    if (data.row) {
      const row = data.row
      Object.assign(form.model, {
        id: data.mode === 'edit' ? row.id : undefined,
        inspectedEmployeeId: row.inspectedEmployeeId,
        checkerEmployeeId: row.checkerEmployeeId,
        standardId: row.standardId || '',
        warningStatus: row.warningStatus,
        inspectionTime:
          data.mode === 'copy'
            ? dayjs().format('YYYY-MM-DD HH:mm:ss')
            : dayjs(row.inspectionTime).format('YYYY-MM-DD HH:mm:ss'),
        violationDescription: row.violationDescription,
        plannedEducationContent: row.plannedEducationContent || '',
        responsibleEmployeeIds: row.responsibleEmployees.map((item) => item.id),
        remark: row.remark || ''
      })
      inspectedSelection.value = [toEmployee(row, 'inspected')]
      checkerSelection.value = [toEmployee(row, 'checker')]
      responsibleSelection.value = row.responsibleEmployees.map((item) => ({
        id: item.id,
        tenantId: row.tenantId,
        employeeNo: item.employeeNo,
        employeeName: item.employeeName,
        jobTitle: item.positionName,
        employmentStatus: 'active',
        organization: null
      }))
    }
    await nextTick()
    formRef.value?.clearValidate()
    const title =
      data.mode === 'edit'
        ? '编辑三违人员信息'
        : data.mode === 'copy'
          ? '复制并新增三违人员信息'
          : '新增三违人员信息'
    await dialogRef.value?.handleOpen(data, {
      title,
      subtitle: '人员资料来源于员工花名册，新增记录默认进入待教育状态',
      confirmText: data.mode === 'copy' ? '复制并保存' : '保存三违信息',
      contentMaxHeight: 'calc(100vh - 150px)',
      onOpen: async (_openData, api) => {
        api.setLoading(true)
        try {
          await Promise.all([
            userStore.ensureDictLoaded('commonWarningStatus'),
            userStore.ensureDictLoaded('smisThreeViolationEducationStatus')
          ])
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
  .three-violation-dialog {
    &__context {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 14px 16px;
      margin-bottom: 18px;
      background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-base);

      strong {
        font-size: 15px;
        color: var(--el-text-color-primary);
      }

      p {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
  }
</style>
