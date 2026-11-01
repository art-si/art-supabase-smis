<template>
  <ArtDialog
    @open="
      () => {
        activeFormTab = 'section-0'
      }
    "
    ref="dialogRef"
    size="xl"
  >
    <div class="risk-control-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:git-merge-line" /></template>
        <strong>按组织层级落实风险管控责任</strong>
        <p>每个层级配置一名责任人和巡查频率；系统据此自动生成风险巡查任务。</p>
      </ArtEntitySummary>

      <ArtForm
        ref="formRef"
        v-model="form"
        v-model:active-tab="activeFormTab"
        :items="formItems"
        :rules="rules"
        :span="12"
        root-class="p-0! md:p-0!"
      />
    </div>

    <template #footer="{ api }">
      <div class="risk-control-dialog__footer">
        <span>保存后立即生成当前周期内到期的巡查任务</span>
        <div
          ><ElButton @click="api.handleClose()">取消</ElButton
          ><ElButton
            type="primary"
            :loading="submitting"
            :disabled="!formRef?.readyToSubmit"
            @click="handleSubmit"
            >保存管控设置</ElButton
          ></div
        >
      </div>
    </template>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { normalizeNullableText } from '@/utils/form/normalize'
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import {
    saveRiskControlPlan,
    type SmisRiskControlAssignment,
    type SmisRiskControlLevel,
    type SmisRiskControlOptions,
    type SmisRiskControlPlanSavePayload,
    type SmisRiskControlPoint
  } from '@smis/api'

  export interface RiskControlPlanDialogOpenData {
    row?: SmisRiskControlPoint
    options: SmisRiskControlOptions
    loadOptions?: () => Promise<SmisRiskControlOptions>
  }
  interface AssignmentForm extends SmisRiskControlAssignment {
    employeeSelection: EmployeeIntegrationItem[]
  }
  interface ControlForm extends Omit<SmisRiskControlPlanSavePayload, 'assignments'> {
    assignments: AssignmentForm[]
    selectedLevels: SmisRiskControlLevel[]
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const activeFormTab = ref('section-0')
  const dialogRef = ref<ArtDialogExpose<RiskControlPlanDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const row = shallowRef<SmisRiskControlPoint>()
  const options = shallowRef<SmisRiskControlOptions>({
    riskPoints: [],
    duplicateConfigurations: []
  })
  const submitting = ref(false)
  const controlLevelOptions: Array<{ label: string; value: SmisRiskControlLevel }> = [
    { label: '公司级（厂级）', value: 'company' },
    { label: '车间（部门级）', value: 'department' },
    { label: '班组级', value: 'team' },
    { label: '岗位级', value: 'position' }
  ]
  const controlLevelLabel = new Map(controlLevelOptions.map((item) => [item.value, item.label]))
  const statusOptions = [
    { label: '管控中', value: 'active' },
    { label: '已停用', value: 'suspended' }
  ]
  const initial = (): ControlForm => ({
    id: null,
    riskPointId: '',
    controlStartAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    status: 'active',
    controlDescription: '',
    assignments: [],
    selectedLevels: []
  })
  const form = ref<ControlForm>(initial())
  const selectedLevels = computed({
    get: () => form.value.selectedLevels,
    set: (value: SmisRiskControlLevel[]) => {
      form.value.selectedLevels = value
    }
  })
  const rules: FormRules<ControlForm> = {
    riskPointId: [{ required: true, message: '请选择风险点', trigger: 'change' }],
    controlStartAt: [{ required: true, message: '请选择管控开始时间', trigger: 'change' }],
    selectedLevels: [
      {
        type: 'array',
        min: 1,
        required: true,
        message: '请至少选择一个管控层级',
        trigger: 'change'
      }
    ]
  }

  const emptyAssignment = (controlLevel: SmisRiskControlLevel, sort: number): AssignmentForm => ({
    controlLevel,
    responsibleEmployeeId: '',
    duplicateConfigurationId: '',
    controlMeasure: '',
    sort,
    employeeSelection: []
  })
  const syncAssignments = (): void => {
    const existing = new Map(form.value.assignments.map((item) => [item.controlLevel, item]))
    form.value.assignments = selectedLevels.value.map(
      (level, index) => existing.get(level) ?? emptyAssignment(level, index + 1)
    )
  }
  const toEmployee = (assignment: SmisRiskControlAssignment): EmployeeIntegrationItem[] =>
    assignment.responsibleEmployeeId && assignment.responsibleEmployeeName
      ? [
          {
            id: assignment.responsibleEmployeeId,
            tenantId: '',
            employeeNo: assignment.responsibleEmployeeNo || '',
            employeeName: assignment.responsibleEmployeeName,
            employmentStatus: 'active',
            organizationId: assignment.responsibleOrganizationId,
            organization: assignment.responsibleOrganizationId
              ? {
                  id: assignment.responsibleOrganizationId,
                  organizationCode: '',
                  organizationName: assignment.responsibleOrganizationName || '未分配组织'
                }
              : null
          }
        ]
      : []

  const formItems = computed<FormItem[]>(() => [
    { key: 'section-0', label: '管控对象', type: 'tab' },
    {
      key: 'objectSection',
      label: '管控对象',
      type: 'divider',
      span: 24,
      description: '可选择已维护有效危险源的风险点'
    },
    {
      key: 'riskPointId',
      label: '风险点',
      type: 'select',
      options: options.value.riskPoints.map((item) => ({
        label: item.pointName + ' · ' + item.pointNo,
        value: item.id
      })),
      props: {
        filterable: true,
        placeholder: '请选择风险点',
        noDataText: '暂无已维护有效危险源的风险点',
        disabled: Boolean(row.value)
      }
    },
    {
      key: 'controlStartAt',
      label: '管控开始时间',
      type: 'date',
      props: { type: 'datetime', valueFormat: 'YYYY-MM-DD HH:mm:ss' }
    },
    {
      key: 'status',
      label: '管控状态',
      type: 'segment',
      options: statusOptions,
      props: { block: true }
    },
    {
      key: 'controlDescription',
      label: '管控说明',
      type: 'textarea',
      props: { maxlength: 2000, placeholder: '说明总体管控要求、责任协同与升级规则' }
    },
    { key: 'section-1', label: '层级与责任', type: 'tab' },
    {
      key: 'levelSection',
      label: '管控层级',
      type: 'divider',
      span: 24,
      description: '可多选；每个层级独立设置责任人、频率和管控要求'
    },
    {
      key: 'selectedLevels',
      label: '管控层级',
      type: 'checkboxGroup',
      span: 24,
      options: controlLevelOptions,
      props: { optionType: 'button', onChange: syncAssignments }
    },
    ...form.value.assignments.flatMap((assignment, index): FormItem[] => [
      {
        key: 'assignmentSection' + assignment.controlLevel,
        label: controlLevelLabel.get(assignment.controlLevel) || assignment.controlLevel,
        type: 'divider',
        span: 24,
        description: '责任人、巡查频率与层级要求'
      },
      {
        key: 'assignments.' + index + '.responsibleEmployeeId',
        label: '管控责任人',
        type: 'employeeSelect',
        formItemProps: {
          required: true,
          rules: [{ required: true, message: '请选择管控责任人', trigger: 'change' }]
        },
        props: {
          title: '选择管控责任人',
          subtitle:
            (controlLevelLabel.get(assignment.controlLevel) || '') + '责任人来自当前租户员工花名册',
          selectedData: assignment.employeeSelection,
          'onUpdate:selectedData': (value: EmployeeIntegrationItem[]) => {
            assignment.employeeSelection = value
          }
        }
      },
      {
        key: 'assignments.' + index + '.duplicateConfigurationId',
        label: '管控频率',
        type: 'select',
        formItemProps: {
          required: true,
          rules: [{ required: true, message: '请选择管控频率', trigger: 'change' }]
        },
        options: options.value.duplicateConfigurations.map((item) => ({
          label: item.displayLabel,
          value: item.id
        })),
        props: { filterable: true, placeholder: '选择重复配置' }
      },
      {
        key: 'assignments.' + index + '.controlMeasure',
        label: '层级管控要求',
        type: 'textarea',
        props: { maxlength: 2000, placeholder: '补充该层级的巡查重点、升级条件或协同要求' }
      }
    ])
  ])

  const handleSubmit = async (): Promise<void> => {
    if (submitting.value) return
    try {
      await formRef.value?.validate()
      submitting.value = true
      await saveRiskControlPlan({
        id: form.value.id,
        riskPointId: form.value.riskPointId,
        controlStartAt: dayjs(form.value.controlStartAt).toISOString(),
        status: form.value.status,
        controlDescription: normalizeNullableText(form.value.controlDescription),
        assignments: form.value.assignments.map((item, index) => ({
          controlLevel: item.controlLevel,
          responsibleEmployeeId: item.responsibleEmployeeId,
          duplicateConfigurationId: item.duplicateConfigurationId,
          sort: index + 1,
          controlMeasure: normalizeNullableText(item.controlMeasure)
        }))
      })
      emit('success', row.value?.planId ? 'edit' : 'add')
      dialogRef.value?.handleClose(true)
    } catch {
      /* 表单和请求层统一提示 */
    } finally {
      submitting.value = false
    }
  }
  const handleOpen = async (data: RiskControlPlanDialogOpenData): Promise<void> => {
    row.value = data.row
    options.value = data.options
    Object.assign(form.value, initial())
    selectedLevels.value = []
    if (data.row) {
      Object.assign(form.value, {
        id: data.row.planId || null,
        riskPointId: data.row.riskPointId,
        controlStartAt: dayjs(data.row.controlStartAt || undefined).format('YYYY-MM-DD HH:mm:ss'),
        status: data.row.controlStatus === 'suspended' ? 'suspended' : 'active',
        controlDescription: data.row.controlDescription || '',
        assignments: data.row.assignments.map((item) => ({
          ...item,
          employeeSelection: toEmployee(item)
        }))
      })
      selectedLevels.value = data.row.assignments.map((item) => item.controlLevel)
    }
    await dialogRef.value?.handleOpen(data, {
      title: data.row?.planId ? '编辑风险管控设置' : '新增风险管控设置',
      subtitle: data.row
        ? `${data.row.riskPointNo} · ${data.row.riskPointName}`
        : '选择已维护危险源的风险点并落实分级责任',
      contentMaxHeight: 'calc(100vh - 150px)',
      loading: !data.options.riskPoints.length,
      loadingText: '正在加载风险点…',
      onOpen: async (_openData, api) => {
        formRef.value?.clearValidate()
        if (data.options.riskPoints.length || !data.loadOptions) return
        try {
          options.value = await data.loadOptions()
        } finally {
          api.setLoading(false)
        }
      }
    })
  }
  onDeactivated(() => dialogRef.value?.handleClose())
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .risk-control-dialog__footer {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .risk-control-dialog__footer > span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  @media (width <= 760px) {
    .risk-control-dialog__footer {
      flex-direction: column;
      align-items: flex-end;
    }
  }
</style>
