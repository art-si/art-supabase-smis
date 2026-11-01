<template>
  <ArtDialog
    @open="
      () => {
        activeFormTab = 'source'
      }
    "
    ref="dialogRef"
    size="xl"
  >
    <div class="drill-record-dialog">
      <ArtEntitySummary
        icon="ri:file-check-line"
        title="以演练记录兑现计划"
        description="选择计划后自动带入预案、类别、级别、组织、负责人、地点和科目；提交后计划转为已完成。"
        spaced
      />
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
        <template #planContext
          ><div v-if="selectedPlan" class="drill-record-dialog__plan"
            ><div
              ><small>应急救援预案</small><strong>{{ selectedPlan.sourcePlanName }}</strong></div
            ><div
              ><small>演练单位</small
              ><strong>{{ selectedPlan.applicableOrganizationName }}</strong></div
            ><div
              ><small>计划周期</small
              ><strong
                >{{ selectedPlan.planStartDate || '—' }} 至
                {{ selectedPlan.planEndDate || '—' }}</strong
              ></div
            ><div
              ><small>负责人</small
              ><strong>{{ selectedPlan.responsibleEmployeeName || '待完善' }}</strong></div
            ></div
          ><ArtEmptyState
            v-else
            title="尚未选择演练计划"
            description="选择演练计划后显示自动带入信息。"
            size="compact"
            :visual-size="48"
        /></template>
      </ArtForm>
    </div>

    <template #footer="{ api }">
      <div class="drill-record-dialog__footer"
        ><ElButton @click="api.handleClose()">关闭</ElButton
        ><ElButton
          :loading="submitting"
          :disabled="!formRef?.readyToSubmit"
          @click="handleSave(false)"
          >保存草稿</ElButton
        ><ElButton
          v-auth="'SmisEmergencyDrillRecord:Submit'"
          type="primary"
          :loading="submitting"
          :disabled="!formRef?.readyToSubmit"
          @click="handleSave(true)"
          >保存并提交</ElButton
        ></div
      >
    </template>
  </ArtDialog>
</template>

<script setup lang="ts">
  import type { FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import {
    saveEmergencyDrillRecord,
    type SmisEmergencyDrillPlanOption,
    type SmisEmergencyDrillRecord
  } from '@smis/api'

  export interface DrillRecordDialogOpenData {
    row?: SmisEmergencyDrillRecord
    planOptions: SmisEmergencyDrillPlanOption[]
    presetPlanId?: string
  }
  interface FormModel {
    id?: string
    drillPlanId: string
    actualStartDate: string
    actualEndDate: string
    drillLocation: string
    drillSubject: string
    drillPurpose: string
    drillProcess: string
    drillSummary: string
    drillEvaluation: string
    drillTeam: string
    equipmentMaterials: string
    imageUrls: string[]
    attachmentUrls: string[]
    participantIds: string[]
    remark: string
  }
  interface FormExpose {
    readyToSubmit: boolean
    validate: () => Promise<boolean>
    clearValidate: () => void
  }
  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const activeFormTab = ref('source')
  const dialogRef = ref<ArtDialogExpose<DrillRecordDialogOpenData>>()
  const recordTenantId = ref<string>()
  const formRef = ref<FormExpose>()
  const submitting = ref(false)
  const planOptions = shallowRef<SmisEmergencyDrillPlanOption[]>([])
  const participantSelection = shallowRef<EmployeeIntegrationItem[]>([])
  onDeactivated(() => dialogRef.value?.handleClose())
  const initial = (): FormModel => ({
    id: undefined,
    drillPlanId: '',
    actualStartDate: '',
    actualEndDate: '',
    drillLocation: '',
    drillSubject: '',
    drillPurpose: '',
    drillProcess: '',
    drillSummary: '',
    drillEvaluation: '',
    drillTeam: '',
    equipmentMaterials: '',
    imageUrls: [],
    attachmentUrls: [],
    participantIds: [],
    remark: ''
  })
  const form = ref<FormModel>(initial())
  const selectedPlan = computed(() =>
    planOptions.value.find((item) => item.id === form.value.drillPlanId)
  )
  const textArea = (placeholder: string, rows = 4) => ({
    rows,
    maxlength: 3000,
    showWordLimit: true,
    resize: 'none',
    placeholder
  })
  const items = computed<FormItem[]>(() => [
    { label: '计划与执行', key: 'source', type: 'tab', span: 24 },
    {
      label: '计划编号',
      key: 'drillPlanId',
      span: 24,
      type: 'select',
      get options(): FormItem['options'] {
        return planOptions.value.map((item) => ({
          label: `${item.planNo} · ${item.drillName}`,
          value: item.id
        }))
      },
      get props(): FormItem['props'] {
        return {
          filterable: true,
          disabled: Boolean(form.value.id),
          placeholder: '选择计划编号或演练名称',
          onChange: applyPlan
        }
      }
    },
    { label: '计划自动带入信息', key: 'planContext', type: 'text', span: 24 },

    {
      label: '实际开始日期',
      key: 'actualStartDate',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', clearable: true }
    },
    {
      label: '实际结束日期',
      key: 'actualEndDate',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', clearable: true }
    },
    { label: '演练地点', key: 'drillLocation', type: 'input', props: { maxlength: 200 } },
    { label: '演练队伍', key: 'drillTeam', type: 'input', props: { maxlength: 300 } },
    {
      label: '演练科目',
      key: 'drillSubject',
      type: 'textarea',
      span: 24,
      props: textArea('填写本次演练科目', 3)
    },
    {
      label: '演练目的',
      key: 'drillPurpose',
      type: 'textarea',
      span: 24,
      props: textArea('填写本次演练目的', 3)
    },
    { label: '过程与评价', key: 'review', type: 'tab', span: 24 },
    {
      label: '演练过程',
      key: 'drillProcess',
      type: 'textarea',
      span: 24,
      props: textArea('记录关键步骤、响应过程和时间节点', 5)
    },
    {
      label: '演练总结',
      key: 'drillSummary',
      type: 'textarea',
      span: 24,
      props: textArea('总结达成情况、问题和改进项', 4)
    },
    {
      label: '效果评价',
      key: 'drillEvaluation',
      type: 'textarea',
      span: 24,
      props: textArea('评价预案适用性、人员响应和协同效果', 4)
    },
    {
      label: '装备物资',
      key: 'equipmentMaterials',
      type: 'textarea',
      span: 24,
      props: textArea('记录投入的装备、器材和应急物资', 3)
    },
    { label: '人员与资料', key: 'evidence', type: 'tab', span: 24 },
    {
      label: '参演人员',
      key: 'participantIds',
      span: 24,
      type: 'employeeSelect',
      get props(): FormItem['props'] {
        return {
          multiple: true,
          modelValues: form.value.participantIds,
          'onUpdate:modelValues': ($event: typeof form.value.participantIds) => {
            form.value.participantIds = $event
          },
          selectedData: participantSelection.value,
          'onUpdate:selectedData': ($event: typeof participantSelection.value) => {
            participantSelection.value = $event
          },
          tenantId: recordTenantId.value,
          title: '批量选择参演人员',
          placeholder: '批量选择员工'
        }
      }
    },
    {
      label: '演练照片',
      key: 'imageUrls',
      span: 24,
      type: 'uploadImage',
      get props(): FormItem['props'] {
        return { multiple: true, limit: 12, size: 104, title: '上传演练照片' }
      }
    },
    {
      label: '记录附件',
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
      props: textArea('补充其他需要留档的信息', 3)
    }
  ])
  const rules: FormRules<FormModel> = {
    drillPlanId: [{ required: true, message: '请选择演练计划', trigger: 'change' }]
  }
  const applyPlan = (id: string) => {
    const plan = planOptions.value.find((item) => item.id === id)
    if (!plan) return
    form.value.drillLocation = plan.drillLocation || ''
    form.value.drillSubject = plan.drillSubject || ''
    form.value.drillPurpose = plan.drillPurpose || ''
  }
  const toEmployees = (row: SmisEmergencyDrillRecord): EmployeeIntegrationItem[] =>
    row.participants.map((item) => ({
      id: item.id,
      tenantId: item.tenantId,
      organizationId: item.organizationId,
      employeeNo: item.employeeNo,
      employeeName: item.employeeName,
      avatarUrl: null,
      jobTitle: item.jobTitle,
      phone: item.phone || undefined,
      employmentStatus: item.employmentStatus,
      organization: item.organization
        ? {
            id: item.organization.id || '',
            organizationCode: item.organization.organizationCode || '',
            organizationName: item.organization.organizationName || ''
          }
        : null
    }))
  const handleSave = async (submit: boolean) => {
    if (submitting.value) return
    try {
      await formRef.value?.validate()
      submitting.value = true
      await saveEmergencyDrillRecord(toRaw(form.value), submit)
      emit('success', form.value.id ? 'edit' : 'add')
      dialogRef.value?.handleClose(true)
    } catch {
      /* 表单或服务端会给出明确提示 */
    } finally {
      submitting.value = false
    }
  }
  const handleOpen = async (data: DrillRecordDialogOpenData) => {
    recordTenantId.value = data.row?.participants[0]?.tenantId
    Object.assign(form.value, initial())
    planOptions.value = data.planOptions
    participantSelection.value = []
    if (data.row) {
      const row = data.row
      Object.assign(form.value, {
        id: row.id,
        drillPlanId: row.drillPlanId,
        actualStartDate: row.actualStartDate || '',
        actualEndDate: row.actualEndDate || '',
        drillLocation: row.drillLocation || '',
        drillSubject: row.drillSubject || '',
        drillPurpose: row.drillPurpose || '',
        drillProcess: row.drillProcess || '',
        drillSummary: row.drillSummary || '',
        drillEvaluation: row.drillEvaluation || '',
        drillTeam: row.drillTeam || '',
        equipmentMaterials: row.equipmentMaterials || '',
        imageUrls: [...row.imageUrls],
        attachmentUrls: [...row.attachmentUrls],
        participantIds: row.participants.map((item) => item.id),
        remark: row.remark || ''
      })
      participantSelection.value = toEmployees(row)
    } else if (data.presetPlanId) {
      form.value.drillPlanId = data.presetPlanId
      applyPlan(data.presetPlanId)
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑应急演练记录' : '新增应急演练记录',
      subtitle: '关联演练计划，记录实际执行、参演人员、过程、评价与证据',
      contentMaxHeight: 'calc(100vh - 140px)'
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .drill-record-dialog {
    &__plan {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      padding: 14px;
      background: var(--el-fill-color-lighter);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);

      > div {
        display: grid;
        gap: 4px;
        min-width: 0;
      }

      small {
        color: var(--el-text-color-secondary);
      }

      strong {
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 13px;
        white-space: nowrap;
      }
    }

    &__footer {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: flex-end;
      width: 100%;
    }

    @media (width <= 900px) {
      &__plan {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  }
</style>
