<template>
  <ArtDialog
    @open="
      () => {
        activeFormTab = 'identity'
      }
    "
    ref="dialogRef"
    size="xl"
  >
    <div class="drill-plan-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:calendar-check-line" /></template>
        <strong>从应急预案制定可兑现的演练计划</strong
        ><p>计划编号按月自动生成；演练级别随演练单位自动判定，预警状态由系统计算。</p>
      </ArtEntitySummary>
      <ArtForm
        v-model:active-tab="activeFormTab"
        ref="formRef"
        v-model="form"
        :items="items"
        :rules="rules"
        :span="12"
        :gutter="24"
        label-position="top"
      >
        <template #planLevel
          ><div class="drill-plan-dialog__derived"
            ><ArtDictDisplay
              dict-code="smisEmergencyPlanLevel"
              :value="derivedPlanLevel"
              display="tag"
            /><small>由演练单位自动联动</small></div
          ></template
        >
        <template #warningStatus
          ><div class="drill-plan-dialog__derived"
            ><ArtDictDisplay
              dict-code="commonWarningStatus"
              :value="currentWarningStatus"
              display="tag"
            /><small>由计划期限与演练记录自动计算</small></div
          ></template
        >
      </ArtForm>
    </div>

    <template #footer="{ api }">
      <div class="drill-plan-dialog__footer">
        <ElButton @click="api.handleClose()">关闭</ElButton>
        <ElButton :loading="submitting" @click="handleSave(false)">保存草稿</ElButton>
        <ElButton
          v-auth="'SmisEmergencyDrillPlan:Submit'"
          type="primary"
          :loading="submitting"
          @click="handleSave(true)"
          >保存并提交</ElButton
        >
      </div>
    </template>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { h } from 'vue'
  import { toDictionaryOption } from '@/utils/form/option'
  import type { FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtPickerEmpty from '@/components/core/feedback/art-picker-empty/index.vue'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import { useUserStore } from '@/store/modules/user'
  import TreeUtils from '@/utils/tree'
  import {
    fetchActiveEmergencyRescuePlanOptions,
    saveEmergencyDrillPlan,
    type SmisEmergencyDrillPlan,
    type SmisEmergencyDrillForm,
    type SmisEmergencyPlanCategory,
    type SmisEmergencyPlanLevel,
    type SmisEmergencyPlanWarningStatus,
    type SmisTreeOrganization
  } from '@smis/api'

  interface RescueOption {
    id: string
    planNo: string
    planName: string
    planCategory: SmisEmergencyPlanCategory
    applicableOrganizationId: string
  }
  export interface DrillPlanDialogOpenData {
    row?: SmisEmergencyDrillPlan
    organizations: SmisTreeOrganization[]
    presetSourcePlanId?: string
  }
  interface FormModel {
    id?: string
    planNo: string
    drillName: string
    sourcePlanId: string
    compilationOrganizationId: string
    applicableOrganizationId: string
    drillForm: SmisEmergencyDrillForm | ''
    planCategory: SmisEmergencyPlanCategory | ''
    responsibleEmployeeId?: string
    planStartDate: string
    planEndDate: string
    drillLocation: string
    drillSubject: string
    drillPurpose: string
    isSpecialEquipmentDrill: boolean
    attachmentUrls: string[]
    traineeIds: string[]
    remark: string
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const activeFormTab = ref('identity')
  const dialogRef = ref<ArtDialogExpose<DrillPlanDialogOpenData>>()
  const recordTenantId = ref<string>()
  const formRef = ref<FormExpose>()
  const numberRule = useDocumentNumberRule('smis.emergency_drill_plan')
  const submitting = ref(false)
  const currentWarningStatus = ref<SmisEmergencyPlanWarningStatus>('normal')
  const organizations = shallowRef<SmisTreeOrganization[]>([])
  const rescuePlans = shallowRef<RescueOption[]>([])
  const responsibleSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const traineeSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const organizationTree = new TreeUtils({
    idKey: 'id',
    parentKey: 'parentId',
    childrenKey: 'children'
  })
  onDeactivated(() => dialogRef.value?.handleClose())
  const initial = (): FormModel => ({
    id: undefined,
    planNo: '',
    drillName: '',
    sourcePlanId: '',
    compilationOrganizationId: '',
    applicableOrganizationId: '',
    drillForm: 'onsite',
    planCategory: '',
    responsibleEmployeeId: undefined,
    planStartDate: '',
    planEndDate: '',
    drillLocation: '',
    drillSubject: '',
    drillPurpose: '',
    isSpecialEquipmentDrill: false,
    attachmentUrls: [],
    traineeIds: [],
    remark: ''
  })
  const form = ref<FormModel>(initial())
  const orgProps = { label: 'organizationName', children: 'children' }
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const flatOrganizations = computed(
    () => organizationTree.treeToList(organizations.value) as SmisTreeOrganization[]
  )
  const derivedPlanLevel = computed<SmisEmergencyPlanLevel>(() => {
    const current = flatOrganizations.value.find(
      (item) => item.id === form.value.applicableOrganizationId
    )
    if (!current || current.organizationType === 'company') return 'company'
    if (current.organizationType === 'division') return 'operation_area'
    let depth = 1
    let parentId = current.parentId
    while (parentId) {
      depth += 1
      parentId = flatOrganizations.value.find((item) => item.id === parentId)?.parentId
    }
    return depth >= 4 ? 'team' : 'operation_department'
  })
  const booleanOptions = computed(() =>
    dictOptions('commonBoolean').map((item) => ({ ...item, value: item.value === 'true' }))
  )
  const items = computed<FormItem[]>(() => [
    { label: '预案与责任', key: 'identity', type: 'tab', span: 24 },
    {
      label: '计划编号',
      key: 'planNo',
      type: 'input',
      description: '系统保存时自动生成，流水号按月重置为 3 位。',
      props: {
        disabled: true,
        placeholder: numberRule.rule.value?.preview || '保存后自动生成'
      }
    },
    {
      label: '计划名称',
      key: 'drillName',
      type: 'input',
      props: { maxlength: 160, placeholder: '请输入演练计划名称' }
    },
    {
      label: '应急救援预案',
      key: 'sourcePlanId',
      span: 24,
      type: 'select',
      get options(): FormItem['options'] {
        return rescuePlans.value.map((item) => ({
          label: `${item.planName} · ${item.planNo}`,
          value: item.id
        }))
      },
      get props(): FormItem['props'] {
        return {
          filterable: true,
          placeholder: '选择已提交且有效的应急预案',
          onChange: handleSourceChange
        }
      },
      slots: {
        empty: () =>
          h(ArtPickerEmpty, { title: '暂无可选应急预案', description: '请先提交有效的应急预案。' })
      }
    },

    {
      label: '编制单位',
      key: 'compilationOrganizationId',
      type: 'treeSelect',
      get props(): FormItem['props'] {
        return {
          data: organizations.value,
          props: orgProps,
          nodeKey: 'id',
          valueKey: 'id',
          checkStrictly: true,
          filterable: true,
          defaultExpandAll: true,
          placeholder: '选择编制单位'
        }
      }
    },
    {
      label: '演练单位',
      key: 'applicableOrganizationId',
      type: 'treeSelect',
      get props(): FormItem['props'] {
        return {
          data: organizations.value,
          props: orgProps,
          nodeKey: 'id',
          valueKey: 'id',
          checkStrictly: true,
          filterable: true,
          defaultExpandAll: true,
          placeholder: '选择演练单位'
        }
      }
    },
    {
      label: '演练负责人',
      key: 'responsibleEmployeeId',
      type: 'employeeSelect',
      get props(): FormItem['props'] {
        return {
          selectedData: responsibleSelection.value,
          'onUpdate:selectedData': ($event: typeof responsibleSelection.value) => {
            responsibleSelection.value = $event
          },
          tenantId: recordTenantId.value,
          title: '选择演练负责人',
          subtitle: '数据来自当前租户员工花名册'
        }
      }
    },
    { label: '演练级别', key: 'planLevel', type: 'text' },
    { label: '预警状态', key: 'warningStatus', type: 'text' },
    { label: '计划安排', key: 'schedule', type: 'tab', span: 24 },
    {
      label: '演练形式',
      key: 'drillForm',
      type: 'select',
      options: dictOptions('smisEmergencyDrillForm'),
      props: { clearable: false }
    },
    {
      label: '计划类别',
      key: 'planCategory',
      type: 'select',
      options: dictOptions('smisEmergencyPlanCategory'),
      props: { clearable: false }
    },
    {
      label: '计划开始日期',
      key: 'planStartDate',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', clearable: true }
    },
    {
      label: '计划完成日期',
      key: 'planEndDate',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', clearable: true }
    },
    {
      label: '演练地点',
      key: 'drillLocation',
      type: 'input',
      props: { maxlength: 200, placeholder: '请输入计划演练地点' }
    },
    {
      label: '特种设备演练',
      key: 'isSpecialEquipmentDrill',
      type: 'segment',
      options: booleanOptions.value
    },
    {
      label: '演练科目',
      key: 'drillSubject',
      type: 'textarea',
      span: 24,
      props: { rows: 3, maxlength: 1000, showWordLimit: true, resize: 'none' }
    },
    {
      label: '演练目的',
      key: 'drillPurpose',
      type: 'textarea',
      span: 24,
      props: { rows: 3, maxlength: 1000, showWordLimit: true, resize: 'none' }
    },
    { label: '参训与资料', key: 'people', type: 'tab', span: 24 },
    {
      label: '参训人员',
      key: 'traineeIds',
      span: 24,
      type: 'employeeSelect',
      get props(): FormItem['props'] {
        return {
          multiple: true,
          modelValues: form.value.traineeIds,
          'onUpdate:modelValues': ($event: typeof form.value.traineeIds) => {
            form.value.traineeIds = $event
          },
          selectedData: traineeSelection.value,
          'onUpdate:selectedData': ($event: typeof traineeSelection.value) => {
            traineeSelection.value = $event
          },
          tenantId: recordTenantId.value,
          title: '批量选择参训人员',
          placeholder: '批量选择员工'
        }
      }
    },
    {
      label: '计划附件',
      key: 'attachmentUrls',
      span: 24,
      type: 'uploadFile',
      get props(): FormItem['props'] {
        return {
          multiple: true,
          limit: 8,
          accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,image/*',
          tip: '支持文档、压缩包和图片，单个文件不超过 20 MB'
        }
      }
    },
    {
      label: '备注',
      key: 'remark',
      type: 'textarea',
      span: 24,
      props: { rows: 4, maxlength: 2000, showWordLimit: true, resize: 'none' }
    }
  ])
  const rules: FormRules<FormModel> = {
    drillName: [{ required: true, message: '请输入计划名称', trigger: 'blur' }],
    sourcePlanId: [{ required: true, message: '请选择应急救援预案', trigger: 'change' }],
    compilationOrganizationId: [{ required: true, message: '请选择编制单位', trigger: 'change' }],
    applicableOrganizationId: [{ required: true, message: '请选择演练单位', trigger: 'change' }],
    drillForm: [{ required: true, message: '请选择演练形式', trigger: 'change' }],
    planCategory: [{ required: true, message: '请选择计划类别', trigger: 'change' }]
  }
  const handleSourceChange = (id: string) => {
    const source = rescuePlans.value.find((item) => item.id === id)
    if (!source) return
    form.value.planCategory = source.planCategory
    if (!form.value.compilationOrganizationId)
      form.value.compilationOrganizationId = source.applicableOrganizationId
    if (!form.value.applicableOrganizationId)
      form.value.applicableOrganizationId = source.applicableOrganizationId
    if (!form.value.drillName) form.value.drillName = `${source.planName}演练`
  }
  const toEmployee = (row: SmisEmergencyDrillPlan): EmployeeIntegrationItem[] =>
    row.responsibleEmployeeId
      ? [
          {
            id: row.responsibleEmployeeId,
            tenantId: row.trainees[0]?.tenantId || '',
            organizationId: row.applicableOrganizationId,
            employeeNo: row.responsibleEmployeeNo || '',
            employeeName: row.responsibleEmployeeName || '未命名员工',
            avatarUrl: null,
            jobTitle: null,
            employmentStatus: 'active'
          }
        ]
      : []
  const handleSave = async (submit: boolean) => {
    if (submitting.value) return
    try {
      await formRef.value?.validate()
      submitting.value = true
      await saveEmergencyDrillPlan(
        {
          ...toRaw(form.value),
          drillForm: form.value.drillForm as SmisEmergencyDrillForm,
          planCategory: form.value.planCategory as SmisEmergencyPlanCategory,
          responsibleEmployeeId: form.value.responsibleEmployeeId || null
        },
        submit
      )
      emit('success', form.value.id ? 'edit' : 'add')
      dialogRef.value?.handleClose(true)
    } catch {
      /* 表单或服务端会给出明确提示 */
    } finally {
      submitting.value = false
    }
  }
  const handleOpen = async (data: DrillPlanDialogOpenData) => {
    recordTenantId.value = data.row?.trainees[0]?.tenantId
    Object.assign(form.value, initial())
    organizations.value = data.organizations
    responsibleSelection.value = []
    traineeSelection.value = []
    currentWarningStatus.value = data.row?.warningStatus ?? 'normal'
    if (data.row) {
      const row = data.row
      Object.assign(form.value, {
        id: row.id,
        planNo: row.planNo,
        drillName: row.drillName,
        sourcePlanId: row.sourcePlanId,
        compilationOrganizationId: row.compilationOrganizationId,
        applicableOrganizationId: row.applicableOrganizationId,
        drillForm: row.drillForm,
        planCategory: row.planCategory,
        responsibleEmployeeId: row.responsibleEmployeeId || undefined,
        planStartDate: row.planStartDate || '',
        planEndDate: row.planEndDate || '',
        drillLocation: row.drillLocation || '',
        drillSubject: row.drillSubject || '',
        drillPurpose: row.drillPurpose || '',
        isSpecialEquipmentDrill: row.isSpecialEquipmentDrill,
        attachmentUrls: [...row.attachmentUrls],
        traineeIds: row.trainees.map((item) => item.id),
        remark: row.remark || ''
      })
      responsibleSelection.value = toEmployee(row)
      traineeSelection.value = row.trainees as EmployeeIntegrationItem[]
    } else if (data.presetSourcePlanId) form.value.sourcePlanId = data.presetSourcePlanId
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑应急演练计划' : '新增应急演练计划',
      subtitle: '关联应急预案，明确组织、负责人、日期、参训人员与计划证据',
      contentMaxHeight: 'calc(100vh - 140px)',
      loading: true,
      onOpen: async (_data, api) => {
        try {
          const [options] = await Promise.all([
            fetchActiveEmergencyRescuePlanOptions(),
            numberRule.loadRule(),
            ...[
              'commonBoolean',
              'smisEmergencyDrillForm',
              'smisEmergencyPlanCategory',
              'smisEmergencyPlanLevel',
              'commonWarningStatus'
            ].map((code) => userStore.ensureDictLoaded(code))
          ])
          rescuePlans.value = options as RescueOption[]
          if (data.presetSourcePlanId) handleSourceChange(data.presetSourcePlanId)
        } finally {
          api.setLoading(false)
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .drill-plan-dialog {
    &__derived {
      display: flex;
      gap: 10px;
      align-items: center;
      min-height: 32px;

      small {
        color: var(--el-text-color-secondary);
      }
    }

    &__footer {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: flex-end;
      width: 100%;
    }
  }
</style>
