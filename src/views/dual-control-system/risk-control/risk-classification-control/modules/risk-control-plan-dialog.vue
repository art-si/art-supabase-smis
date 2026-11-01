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
        v-model:active-tab="activeFormTab"
        ref="formRef"
        v-model="form"
        :items="[]"
        :rules="rules"
        custom-layout
        root-class="p-0! md:p-0!"
      >
        <ElTabs v-model="activeFormTab"
          ><ElTabPane name="section-0" label="管控对象" data-art-form-tab="section-0"
            ><div class="min-w-0 space-y-4"
              ><ArtSectionTitle title="管控对象" subtitle="可选择已维护有效危险源的风险点" />
              <div class="risk-control-dialog__grid">
                <ElFormItem label="风险点" prop="riskPointId">
                  <ElSelect
                    v-model="form.riskPointId"
                    class="w-full"
                    filterable
                    placeholder="请选择风险点"
                    no-data-text="暂无已维护有效危险源的风险点"
                    :disabled="Boolean(row)"
                  >
                    <ElOption
                      v-for="item in options.riskPoints"
                      :key="item.id"
                      :label="`${item.pointName} · ${item.pointNo}`"
                      :value="item.id"
                    />
                  </ElSelect>
                </ElFormItem>
                <ElFormItem label="管控开始时间" prop="controlStartAt">
                  <ElDatePicker
                    v-model="form.controlStartAt"
                    class="!w-full"
                    type="datetime"
                    value-format="YYYY-MM-DD HH:mm:ss"
                  />
                </ElFormItem>
                <ElFormItem label="管控状态" prop="status">
                  <ElSegmented v-model="form.status" :options="statusOptions" block />
                </ElFormItem>
                <ElFormItem class="risk-control-dialog__wide" label="管控说明">
                  <ElInput
                    v-model="form.controlDescription"
                    type="textarea"
                    :rows="3"
                    maxlength="2000"
                    show-word-limit
                    placeholder="说明总体管控要求、责任协同与升级规则"
                  />
                </ElFormItem>
              </div> </div
          ></ElTabPane>
          <ElTabPane name="section-1" label="层级与责任" data-art-form-tab="section-1"
            ><div class="min-w-0 space-y-4"
              ><ArtSectionTitle
                title="管控层级"
                subtitle="可多选；每个层级独立设置责任人、频率和管控要求" />
              <ElFormItem prop="assignments" class="risk-control-dialog__levels-field">
                <ElCheckboxGroup
                  v-model="selectedLevels"
                  class="risk-control-dialog__level-picker"
                  @change="syncAssignments"
                >
                  <ElCheckboxButton
                    v-for="item in controlLevelOptions"
                    :key="item.value"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </ElCheckboxButton>
                </ElCheckboxGroup>
              </ElFormItem>

              <div v-if="form.assignments.length" class="risk-control-dialog__assignments">
                <section
                  v-for="(assignment, index) in form.assignments"
                  :key="assignment.controlLevel"
                  class="risk-control-dialog__assignment"
                >
                  <header>
                    <span :data-level="assignment.controlLevel"
                      ><ArtSvgIcon icon="ri:shield-user-line"
                    /></span>
                    <div
                      ><strong>{{ controlLevelLabel.get(assignment.controlLevel) }}</strong
                      ><small>责任人、巡查频率与层级要求</small></div
                    >
                  </header>
                  <div class="risk-control-dialog__grid risk-control-dialog__grid--assignment">
                    <ElFormItem
                      label="管控责任人"
                      :prop="`assignments.${index}.responsibleEmployeeId`"
                      :rules="[{ required: true, message: '请选择管控责任人', trigger: 'change' }]"
                      required
                    >
                      <ArtEmployeeSelect
                        v-model="assignment.responsibleEmployeeId"
                        v-model:selected-data="assignment.employeeSelection"
                        title="选择管控责任人"
                        :subtitle="`${controlLevelLabel.get(assignment.controlLevel)}责任人来自当前租户员工花名册`"
                      />
                    </ElFormItem>
                    <ElFormItem
                      label="管控频率"
                      :prop="`assignments.${index}.duplicateConfigurationId`"
                      :rules="[{ required: true, message: '请选择管控频率', trigger: 'change' }]"
                      required
                    >
                      <ElSelect
                        v-model="assignment.duplicateConfigurationId"
                        class="w-full"
                        filterable
                        placeholder="选择重复配置"
                      >
                        <ElOption
                          v-for="item in options.duplicateConfigurations"
                          :key="item.id"
                          :label="item.displayLabel"
                          :value="item.id"
                        />
                      </ElSelect>
                    </ElFormItem>
                    <ElFormItem class="risk-control-dialog__wide" label="层级管控要求">
                      <ElInput
                        v-model="assignment.controlMeasure"
                        type="textarea"
                        :rows="2"
                        maxlength="2000"
                        show-word-limit
                        placeholder="补充该层级的巡查重点、升级条件或协同要求"
                      />
                    </ElFormItem>
                  </div>
                </section>
              </div>
              <ArtEmptyState
                v-else
                title="请至少选择一个管控层级"
                description="选择层级后可继续配置责任人与排查周期。"
                :visual-size="96" /></div></ElTabPane
        ></ElTabs>
      </ArtForm>
    </div>

    <template #footer="{ api }">
      <div class="risk-control-dialog__footer">
        <span>保存后立即生成当前周期内到期的巡查任务</span>
        <div
          ><ElButton @click="api.handleClose()">取消</ElButton
          ><ElButton type="primary" :loading="submitting" @click="handleSubmit"
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
  import ArtForm from '@/components/core/forms/art-form/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
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
  const selectedLevels = ref<SmisRiskControlLevel[]>([])
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
    assignments: []
  })
  const form = ref<ControlForm>(initial())
  const rules: FormRules<ControlForm> = {
    riskPointId: [{ required: true, message: '请选择风险点', trigger: 'change' }],
    controlStartAt: [{ required: true, message: '请选择管控开始时间', trigger: 'change' }],
    assignments: [
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
  .risk-control-dialog {
    &__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0 24px;
      margin: 12px 0 20px;
    }

    &__grid--assignment {
      margin: 14px 0 0;
    }

    &__wide {
      grid-column: 1 / -1;
    }

    &__level-picker {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 12px 0 18px;
    }

    &__assignments {
      display: grid;
      gap: 12px;
    }

    &__assignment {
      padding: 16px 18px 0;
      background: var(--default-box-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__assignment header {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
    }

    &__assignment header > span {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
      border-radius: var(--el-border-radius-base);
    }

    &__assignment header strong,
    &__assignment header small {
      display: block;
    }

    &__assignment header small {
      margin-top: 2px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    &__footer {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    &__footer > span {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  @media (width <= 760px) {
    .risk-control-dialog__grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .risk-control-dialog__wide {
      grid-column: auto;
    }

    .risk-control-dialog__footer {
      flex-direction: column;
      align-items: flex-end;
    }
  }
</style>
