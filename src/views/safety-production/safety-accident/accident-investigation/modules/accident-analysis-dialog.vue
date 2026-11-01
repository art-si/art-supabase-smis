<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="analysis-dialog">
      <div class="analysis-dialog__context" role="note">
        <span><ArtSvgIcon icon="ri:team-line" /></span>
        <div>
          <strong>围绕事故快报组织分析与责任闭环</strong>
          <p>关联事故后自动带入事故单号和级别，会议角色及参加人员统一从员工花名册选择。</p>
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
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import type { FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchAccidentEmployeeCandidates,
    saveAccidentAnalysis,
    type SmisAccidentAnalysis,
    type SmisAccidentEmployee,
    type SmisAccidentLevel,
    type SmisAccidentOption
  } from '@smis/api'
  import AccidentReportSelect from '../../shared/accident-report-select.vue'

  export interface AccidentAnalysisDialogOpenData {
    row?: SmisAccidentAnalysis
  }
  interface AccidentAnalysisForm {
    id?: string
    accidentReportId: string
    accidentNo: string
    hostEmployeeId: string
    participantEmployeeIds: string[]
    recorderEmployeeId: string
    rectificationResponsibleEmployeeId: string
    accidentLevel: SmisAccidentLevel | ''
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<AccidentAnalysisDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const accidentSelection = shallowRef<SmisAccidentOption[]>([])
  const hostSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const recorderSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const responsibleSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const participantSelection = shallowRef<SmisAccidentEmployee[]>([])
  const initialForm = (): AccidentAnalysisForm => ({
    accidentReportId: '',
    accidentNo: '',
    hostEmployeeId: '',
    participantEmployeeIds: [],
    recorderEmployeeId: '',
    rectificationResponsibleEmployeeId: '',
    accidentLevel: ''
  })
  const form = ref<AccidentAnalysisForm>(initialForm())
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const items = computed<FormItem[]>(() => [
    {
      label: '关联事故名称',
      key: 'accidentReportId',
      type: 'text',
      span: 16,
      description: '数据来源：事故快报'
    },
    {
      label: '关联事故单号',
      key: 'accidentNo',
      type: 'input',
      span: 8,
      props: { readonly: true, placeholder: '选择事故后自动带入' }
    },
    {
      label: '主持人',
      key: 'hostEmployeeId',
      span: 12,
      type: 'employeeSelect',
      get props(): FormItem['props'] {
        return {
          selectedData: hostSelection.value,
          'onUpdate:selectedData': ($event: typeof hostSelection.value) => {
            hostSelection.value = $event
          },
          apiFn: fetchAccidentEmployeeCandidates,
          title: '选择主持人',
          subtitle: '从当前租户员工花名册选择事故分析主持人',
          placeholder: '点击选择主持人'
        }
      }
    },
    {
      label: '记录人',
      key: 'recorderEmployeeId',
      span: 12,
      type: 'employeeSelect',
      get props(): FormItem['props'] {
        return {
          selectedData: recorderSelection.value,
          'onUpdate:selectedData': ($event: typeof recorderSelection.value) => {
            recorderSelection.value = $event
          },
          apiFn: fetchAccidentEmployeeCandidates,
          title: '选择记录人',
          subtitle: '从当前租户员工花名册选择事故分析记录人',
          placeholder: '点击选择记录人'
        }
      }
    },
    {
      label: '参加人员',
      key: 'participantEmployeeIds',
      span: 24,
      description: '支持多选，可按姓名、工号、组织或岗位检索',
      type: 'employeeSelect',
      get props(): FormItem['props'] {
        return {
          modelValues: form.value.participantEmployeeIds,
          'onUpdate:modelValues': ($event: typeof form.value.participantEmployeeIds) => {
            form.value.participantEmployeeIds = $event
          },
          selectedData: participantSelection.value,
          'onUpdate:selectedData': ($event: typeof participantSelection.value) => {
            participantSelection.value = $event
          },
          multiple: true,
          allowAllTenantRead: true,
          apiFn: fetchAccidentEmployeeCandidates,
          displayFields: ['organization', 'jobTitle', 'gender', 'age', 'phone'],
          title: '选择参加人员',
          subtitle: '支持从员工花名册多选，已选人员可再次打开弹窗调整',
          placeholder: '点击选择参加人员'
        }
      }
    },
    {
      label: '整改责任人',
      key: 'rectificationResponsibleEmployeeId',
      span: 12,
      type: 'employeeSelect',
      get props(): FormItem['props'] {
        return {
          selectedData: responsibleSelection.value,
          'onUpdate:selectedData': ($event: typeof responsibleSelection.value) => {
            responsibleSelection.value = $event
          },
          apiFn: fetchAccidentEmployeeCandidates,
          title: '选择整改责任人',
          subtitle: '从当前租户员工花名册选择整改事项负责人',
          placeholder: '点击选择整改责任人'
        }
      }
    },
    {
      label: '事故级别',
      key: 'accidentLevel',
      type: 'select',
      span: 12,
      props: {
        options: dictOptions('smisAccidentLevel'),
        clearable: false,
        placeholder: '请选择事故级别'
      }
    }
  ])
  const rules: FormRules<AccidentAnalysisForm> = {
    accidentReportId: [{ required: true, message: '请选择关联事故名称', trigger: 'change' }],
    accidentLevel: [{ required: true, message: '请选择事故级别', trigger: 'change' }]
  }

  watch(
    accidentSelection,
    (rows) => {
      const selected = rows[0]
      form.value.accidentNo = selected?.accidentNo || ''
      if (selected) form.value.accidentLevel = selected.accidentLevel
    },
    { deep: true }
  )
  const employeeRows = (employee?: SmisAccidentEmployee | null): EmployeeIntegrationItem[] =>
    employee ? [employee as EmployeeIntegrationItem] : []
  const resetSelections = (): void => {
    accidentSelection.value = []
    hostSelection.value = []
    recorderSelection.value = []
    responsibleSelection.value = []
    participantSelection.value = []
  }
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await saveAccidentAnalysis({
        id: form.value.id,
        accidentReportId: form.value.accidentReportId,
        hostEmployeeId: form.value.hostEmployeeId || null,
        recorderEmployeeId: form.value.recorderEmployeeId || null,
        rectificationResponsibleEmployeeId: form.value.rectificationResponsibleEmployeeId || null,
        participantEmployeeIds: form.value.participantEmployeeIds,
        accidentLevel: form.value.accidentLevel as SmisAccidentLevel
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '事故分析保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: AccidentAnalysisDialogOpenData): Promise<void> => {
    Object.assign(form.value, initialForm())
    resetSelections()
    if (data.row) {
      Object.assign(form.value, {
        id: data.row.id,
        accidentReportId: data.row.accidentReportId,
        accidentNo: data.row.accident.accidentNo,
        hostEmployeeId: data.row.hostEmployeeId || '',
        participantEmployeeIds: data.row.participants.map((employee) => employee.id),
        recorderEmployeeId: data.row.recorderEmployeeId || '',
        rectificationResponsibleEmployeeId: data.row.rectificationResponsibleEmployeeId || '',
        accidentLevel: data.row.accidentLevel
      })
      accidentSelection.value = [data.row.accident]
      hostSelection.value = employeeRows(data.row.hostEmployee)
      recorderSelection.value = employeeRows(data.row.recorderEmployee)
      responsibleSelection.value = employeeRows(data.row.rectificationResponsibleEmployee)
      participantSelection.value = data.row.participants
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '事故分析' : '新增事故分析',
      subtitle: data.row ? data.row.accident.accidentName : '选择事故快报并组织事故分析会议',
      confirmText: data.row ? '保存分析结果' : '创建事故分析',
      loading: true,
      onOpen: async (_openData, api) => {
        try {
          await userStore.ensureDictLoaded('smisAccidentLevel')
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit,
      onReset: () => {
        Object.assign(form.value, initialForm())
        resetSelections()
      }
    })
  }
  onDeactivated(() => dialogRef.value?.handleClose())
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .analysis-dialog {
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
