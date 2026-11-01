<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="work-injury-dialog">
      <div class="work-injury-dialog__context" role="note">
        <span><ArtSvgIcon icon="ri:first-aid-kit-line" /></span>
        <div>
          <strong>申报与事故快报建立可追溯关联</strong>
          <p>选择事故名称后自动带入事故单号；申报人及所在部门按员工花名册确认。</p>
        </div>
      </div>
      <ArtForm
        ref="formRef"
        v-model="form"
        :items="items"
        :rules="rules"
        :span="12"
        :gutter="24"
        label-position="top"
      >
        <template #accidentReportId>
          <AccidentReportSelect
            v-model="form.accidentReportId"
            v-model:selected-data="accidentSelection"
          />
        </template>
        <template #declarantEmployeeId>
          <ArtEmployeeSelect
            v-model="form.declarantEmployeeId"
            v-model:selected-data="employeeSelection"
            :api-fn="fetchAccidentEmployeeCandidates"
            title="选择申报人"
            subtitle="默认当前登录账号关联员工，可从员工花名册修改"
            placeholder="点击选择申报人"
            :clearable="false"
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
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchAccidentEmployeeCandidates,
    saveWorkInjuryDeclaration,
    type SmisAccidentEmployee,
    type SmisAccidentOption,
    type SmisWorkInjuryDeclaration,
    type SmisWorkInjuryType
  } from '@smis/api'
  import AccidentReportSelect from '../../shared/accident-report-select.vue'

  export interface WorkInjuryDialogOpenData {
    row?: SmisWorkInjuryDeclaration
    currentEmployee?: SmisAccidentEmployee | null
  }
  interface WorkInjuryForm {
    id?: string
    declarationNo: string
    declarationDate: string
    accidentReportId: string
    accidentNo: string
    declarantEmployeeId: string
    departmentName: string
    injuryType: SmisWorkInjuryType | ''
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<WorkInjuryDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const numberRule = useDocumentNumberRule('smis.work_injury_declaration')
  const accidentSelection = shallowRef<SmisAccidentOption[]>([])
  const employeeSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const initialForm = (): WorkInjuryForm => ({
    declarationNo: '',
    declarationDate: dayjs().format('YYYY-MM-DD'),
    accidentReportId: '',
    accidentNo: '',
    declarantEmployeeId: '',
    departmentName: '',
    injuryType: ''
  })
  const form = ref<WorkInjuryForm>(initialForm())
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const items = computed<FormItem[]>(() => [
    {
      label: '申报编号',
      key: 'declarationNo',
      type: 'input',
      description: numberRule.description.value,
      props: numberRule.inputProps(Boolean(form.value.id), '保存后自动生成', true)
    },
    {
      label: '申报时间',
      key: 'declarationDate',
      type: 'date',
      valueFormat: 'YYYY-MM-DD',
      props: { clearable: false, placeholder: '选择申报日期' }
    },
    { label: '关联事故名称', key: 'accidentReportId', type: 'text', span: 12 },
    {
      label: '事故单号',
      key: 'accidentNo',
      type: 'input',
      props: { readonly: true, placeholder: '选择事故后自动带入' }
    },
    { label: '姓名', key: 'declarantEmployeeId', type: 'text' },
    {
      label: '所在部门',
      key: 'departmentName',
      type: 'input',
      props: { readonly: true, placeholder: '选择申报人后自动带入' }
    },
    {
      label: '工伤类型',
      key: 'injuryType',
      type: 'select',
      span: 12,
      options: dictOptions('smisWorkInjuryType'),
      props: { clearable: false, placeholder: '请选择工伤类型' }
    }
  ])
  const rules: FormRules<WorkInjuryForm> = {
    declarationDate: [{ required: true, message: '请选择申报时间', trigger: 'change' }],
    accidentReportId: [{ required: true, message: '请选择关联事故名称', trigger: 'change' }],
    declarantEmployeeId: [{ required: true, message: '请选择申报人', trigger: 'change' }],
    injuryType: [{ required: true, message: '请选择工伤类型', trigger: 'change' }]
  }
  const employeeDepartment = (employee?: SmisAccidentEmployee | null): string =>
    employee?.organization?.organizationName ||
    employee?.teamName ||
    employee?.operationAreaName ||
    employee?.operationDepartmentName ||
    employee?.companyName ||
    ''
  watch(
    accidentSelection,
    (rows) => {
      form.value.accidentNo = rows[0]?.accidentNo || ''
    },
    { deep: true }
  )
  watch(
    employeeSelection,
    (rows) => {
      form.value.departmentName = employeeDepartment(rows[0] as SmisAccidentEmployee | undefined)
    },
    { deep: true }
  )
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await saveWorkInjuryDeclaration({
        id: form.value.id,
        declarationDate: form.value.declarationDate,
        accidentReportId: form.value.accidentReportId,
        declarantEmployeeId: form.value.declarantEmployeeId,
        injuryType: form.value.injuryType as SmisWorkInjuryType
      })
      emit('success', form.value.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '工伤申报保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: WorkInjuryDialogOpenData): Promise<void> => {
    Object.assign(form.value, initialForm())
    accidentSelection.value = []
    employeeSelection.value = []
    if (data.row) {
      Object.assign(form.value, {
        id: data.row.id,
        declarationNo: data.row.declarationNo,
        declarationDate: data.row.declarationDate,
        accidentReportId: data.row.accidentReportId,
        accidentNo: data.row.accident.accidentNo,
        declarantEmployeeId: data.row.declarantEmployeeId,
        departmentName: data.row.departmentNameSnapshot || '',
        injuryType: data.row.injuryType
      })
      accidentSelection.value = [data.row.accident]
      employeeSelection.value = [data.row.declarantEmployee]
    } else if (data.currentEmployee) {
      form.value.declarantEmployeeId = data.currentEmployee.id
      form.value.departmentName = employeeDepartment(data.currentEmployee)
      employeeSelection.value = [data.currentEmployee]
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑工伤申报' : '新增工伤申报',
      subtitle: '关联事故快报并确认申报人与工伤类型',
      confirmText: data.row ? '保存更改' : '创建工伤申报',
      loading: true,
      onOpen: async (_openData, api) => {
        try {
          await Promise.all([
            numberRule.loadRule(),
            userStore.ensureDictLoaded('smisWorkInjuryType')
          ])
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit,
      onReset: () => Object.assign(form.value, initialForm())
    })
  }
  onDeactivated(() => dialogRef.value?.handleClose())
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .work-injury-dialog {
    min-width: 0;

    &__context {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      padding: 14px 16px;
      margin-bottom: 18px;
      background: color-mix(in srgb, var(--el-color-primary) 6%, var(--el-bg-color));
      border-left: 3px solid var(--el-color-primary);
      border-radius: var(--el-border-radius-base);

      > span {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        color: var(--el-color-primary);
        background: var(--el-bg-color);
        border-radius: var(--el-border-radius-base);
      }

      p {
        margin: 3px 0 0;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
  }
</style>
