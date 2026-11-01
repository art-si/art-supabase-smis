<template>
  <ArtDialog
    @open="
      () => {
        activeFormTab = 'basicSection'
      }
    "
    ref="dialogRef"
    size="xl"
  >
    <div class="training-plan-dialog">
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
        <template #organizerOrganizationId>
          <ElTreeSelect
            v-model="form.organizerOrganizationId"
            :data="organizations"
            :props="organizationProps"
            node-key="id"
            value-key="id"
            check-strictly
            filterable
            default-expand-all
            class="w-full"
            placeholder="选择培训组织单位"
          />
        </template>
        <template #targetOrganizationId>
          <ElTreeSelect
            v-model="form.targetOrganizationId"
            :data="organizations"
            :props="organizationProps"
            node-key="id"
            value-key="id"
            check-strictly
            filterable
            clearable
            default-expand-all
            class="w-full"
            placeholder="选择主要覆盖组织（可选）"
          />
        </template>
        <template #responsibleEmployeeId>
          <ArtEmployeeSelect
            v-model="form.responsibleEmployeeId"
            v-model:selected-data="responsibleSelection"
            :tenant-id="recordTenantId"
            title="选择计划负责人"
            subtitle="负责人来自当前租户员工花名册"
          />
        </template>
        <template #participantIds>
          <ArtEmployeeSelect
            multiple
            v-model:model-values="form.participantIds"
            v-model:selected-data="participantSelection"
            :tenant-id="recordTenantId"
            title="选择计划参训人员"
            placeholder="批量选择参训员工"
          />
          <small class="training-plan-dialog__helper">
            已选择 {{ form.participantIds.length }} 人；发布后作为培训记录的默认签到名单。
          </small>
        </template>
        <template #attachmentUrls>
          <ArtUploadFile
            v-model="form.attachmentUrls"
            multiple
            :limit="8"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,image/*"
            tip="支持计划文件、课件和图片，单个文件不超过 20 MB"
          />
        </template>
      </ArtForm>
    </div>

    <template #footer="{ api }">
      <div class="training-plan-dialog__footer">
        <span>{{ numberDescription }}</span>
        <div>
          <ElButton @click="api.handleClose()">关闭</ElButton>
          <ElButton :loading="submitting" @click="handleSave(false)">保存草稿</ElButton>
          <ElButton
            v-auth="'SmisSafetyTrainingPlan:Publish'"
            type="primary"
            :loading="submitting"
            @click="handleSave(true)"
            >发布计划</ElButton
          >
        </div>
      </div>
    </template>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import dayjs from 'dayjs'
  import { ElMessage, type FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import { useUserStore } from '@/store/modules/user'
  import {
    saveSafetyTrainingPlan,
    type SmisSafetyTrainingOrganizationOption,
    type SmisSafetyTrainingPlan,
    type SmisSafetyTrainingPlanSavePayload
  } from '@smis/api'

  interface FormModel {
    id?: string
    planNo: string
    subject: string
    trainingCategory: string
    trainingType: string
    trainingForm: string
    trainingLevel: string
    organizerOrganizationId: string
    targetOrganizationId?: string
    responsibleEmployeeId?: string
    instructorName: string
    plannedStartAt: string
    plannedEndAt: string
    location: string
    content: string
    requirements: string
    trainingHours: number
    assessmentMethod: string
    warningStatus: 'normal' | 'warning'
    attachmentUrls: string[]
    remark: string
    participantIds: string[]
  }

  export interface TrainingPlanDialogOpenData {
    row?: SmisSafetyTrainingPlan
    copy?: boolean
    organizations: SmisSafetyTrainingOrganizationOption[]
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const activeFormTab = ref('basicSection')
  const dialogRef = ref<ArtDialogExpose<TrainingPlanDialogOpenData>>()
  const recordTenantId = ref<string>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const organizations = shallowRef<SmisSafetyTrainingOrganizationOption[]>([])
  const responsibleSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const participantSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const submitting = ref(false)
  const numberRule = useDocumentNumberRule('smis.safety_training_plan')
  const numberDescription = numberRule.description
  const organizationProps = { label: 'organizationName', children: 'children' }

  const createInitialForm = (): FormModel => ({
    id: undefined,
    planNo: '',
    subject: '',
    trainingCategory: 'annual',
    trainingType: 'safety_education',
    trainingForm: 'centralized_lecture',
    trainingLevel: 'company',
    organizerOrganizationId: '',
    targetOrganizationId: undefined,
    responsibleEmployeeId: undefined,
    instructorName: '',
    plannedStartAt: dayjs().add(1, 'day').hour(9).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss'),
    plannedEndAt: dayjs().add(1, 'day').hour(17).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss'),
    location: '',
    content: '',
    requirements: '',
    trainingHours: 4,
    assessmentMethod: 'none',
    warningStatus: 'normal',
    attachmentUrls: [],
    remark: '',
    participantIds: []
  })
  const form = ref<FormModel>(createInitialForm())
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const items = computed<FormItem[]>(() => [
    { label: '计划与组织', key: 'basicSection', type: 'tab', span: 24 },
    {
      label: '培训主题',
      key: 'subject',
      type: 'input',
      props: { maxlength: 200, showWordLimit: true }
    },
    {
      label: '预警状态',
      key: 'warningStatus',
      type: 'select',
      props: {
        options: dictOptions('commonWarningStatus'),
        clearable: false,
        placeholder: '请选择预警状态'
      }
    },
    {
      label: '培训类别',
      key: 'trainingCategory',
      type: 'select',
      props: { options: dictOptions('smisSafetyTrainingCategory') }
    },
    {
      label: '培训类型',
      key: 'trainingType',
      type: 'select',
      props: { options: dictOptions('smisSafetyTrainingType') }
    },

    { label: '组织单位', key: 'organizerOrganizationId', span: 12 },
    { label: '覆盖组织', key: 'targetOrganizationId', span: 12 },
    { label: '计划负责人', key: 'responsibleEmployeeId', span: 12 },
    { label: '培训讲师', key: 'instructorName', type: 'input', props: { maxlength: 100 } },
    {
      label: '计划开始时间',
      key: 'plannedStartAt',
      type: 'date',
      props: { type: 'datetime', valueFormat: 'YYYY-MM-DD HH:mm:ss', class: '!w-full' }
    },
    {
      label: '计划结束时间',
      key: 'plannedEndAt',
      type: 'date',
      props: { type: 'datetime', valueFormat: 'YYYY-MM-DD HH:mm:ss', class: '!w-full' }
    },
    { label: '培训地点', key: 'location', type: 'input', props: { maxlength: 200 } },
    {
      label: '培训级别',
      key: 'trainingLevel',
      type: 'select',
      props: { options: dictOptions('smisSafetyTrainingLevel') }
    },
    { label: '内容与考核', key: 'contentSection', type: 'tab', span: 24 },
    {
      label: '培训形式',
      key: 'trainingForm',
      type: 'select',
      props: { options: dictOptions('smisSafetyTrainingForm') }
    },
    {
      label: '培训学时',
      key: 'trainingHours',
      type: 'inputNumber',
      props: { min: 0, max: 9999, precision: 1, class: '!w-full' }
    },
    {
      label: '考核方式',
      key: 'assessmentMethod',
      type: 'select',
      props: { options: dictOptions('smisSafetyTrainingAssessmentMethod') }
    },
    {
      label: '培训内容',
      key: 'content',
      type: 'textarea',
      span: 24,
      props: { rows: 4, maxlength: 4000, showWordLimit: true }
    },
    {
      label: '培训要求',
      key: 'requirements',
      type: 'textarea',
      span: 24,
      props: { rows: 3, maxlength: 2000, showWordLimit: true }
    },
    { label: '参训与资料', key: 'participantSection', type: 'tab', span: 24 },
    { label: '参训人员', key: 'participantIds', span: 24 },
    { label: '计划附件', key: 'attachmentUrls', span: 24 },
    {
      label: '备注',
      key: 'remark',
      type: 'textarea',
      span: 24,
      props: { rows: 2, maxlength: 1000, showWordLimit: true }
    }
  ])
  const rules: FormRules<FormModel> = {
    subject: [{ required: true, message: '请输入培训主题', trigger: 'blur' }],
    trainingCategory: [{ required: true, message: '请选择培训类别', trigger: 'change' }],
    trainingType: [{ required: true, message: '请选择培训类型', trigger: 'change' }],
    trainingForm: [{ required: true, message: '请选择培训形式', trigger: 'change' }],
    trainingLevel: [{ required: true, message: '请选择培训级别', trigger: 'change' }],
    organizerOrganizationId: [{ required: true, message: '请选择组织单位', trigger: 'change' }],
    plannedStartAt: [{ required: true, message: '请选择计划开始时间', trigger: 'change' }],
    plannedEndAt: [{ required: true, message: '请选择计划结束时间', trigger: 'change' }],
    content: [{ required: true, message: '请输入培训内容', trigger: 'blur' }],
    participantIds: [{ type: 'array', min: 1, message: '至少选择一名参训人员', trigger: 'change' }]
  }

  const toEmployeeSelection = (
    participant: SmisSafetyTrainingPlan['participants'][number],
    tenantId: string
  ): EmployeeIntegrationItem => ({
    id: participant.employeeId,
    tenantId,
    employeeNo: participant.employeeNo,
    employeeName: participant.employeeName,
    employmentStatus: 'active',
    organizationId: participant.organizationId,
    organization: participant.organizationId
      ? {
          id: participant.organizationId,
          organizationCode: '',
          organizationName: participant.organizationName || '未分配组织'
        }
      : null,
    jobTitle: participant.jobTitle,
    phone: participant.phone
  })

  const initialize = (data: TrainingPlanDialogOpenData): void => {
    recordTenantId.value = data.row?.tenantId
    Object.assign(form.value, createInitialForm())
    organizations.value = data.organizations
    responsibleSelection.value = []
    participantSelection.value = []
    if (!data.row) return
    const row = data.row
    Object.assign(form.value, {
      id: data.copy ? undefined : row.id,
      planNo: data.copy ? '' : row.planNo,
      subject: data.copy ? `${row.subject}（复制）` : row.subject,
      trainingCategory: row.trainingCategory,
      trainingType: row.trainingType,
      trainingForm: row.trainingForm,
      trainingLevel: row.trainingLevel,
      organizerOrganizationId: row.organizerOrganizationId,
      targetOrganizationId: row.targetOrganizationId || undefined,
      responsibleEmployeeId: row.responsibleEmployeeId || undefined,
      instructorName: row.instructorName || '',
      plannedStartAt: dayjs(row.plannedStartAt).format('YYYY-MM-DD HH:mm:ss'),
      plannedEndAt: dayjs(row.plannedEndAt).format('YYYY-MM-DD HH:mm:ss'),
      location: row.location || '',
      content: row.content,
      requirements: row.requirements || '',
      trainingHours: Number(row.trainingHours || 0),
      assessmentMethod: row.assessmentMethod,
      warningStatus: row.warningStatus,
      attachmentUrls: [...row.attachmentUrls],
      remark: row.remark || '',
      participantIds: row.participants.map((item) => item.employeeId)
    })
    participantSelection.value = row.participants.map((participant) =>
      toEmployeeSelection(participant, row.tenantId)
    )
    if (row.responsibleEmployeeId && row.responsibleEmployeeName) {
      responsibleSelection.value = [
        {
          id: row.responsibleEmployeeId,
          tenantId: row.tenantId,
          employeeNo: row.responsibleEmployeeNo || '',
          employeeName: row.responsibleEmployeeName,
          employmentStatus: 'active'
        }
      ]
    }
  }

  const buildPayload = (): SmisSafetyTrainingPlanSavePayload => ({
    id: form.value.id,
    subject: form.value.subject.trim(),
    trainingCategory: form.value.trainingCategory,
    trainingType: form.value.trainingType,
    trainingForm: form.value.trainingForm,
    trainingLevel: form.value.trainingLevel,
    organizerOrganizationId: form.value.organizerOrganizationId,
    targetOrganizationId: form.value.targetOrganizationId || null,
    responsibleEmployeeId: form.value.responsibleEmployeeId || null,
    instructorName: normalizeNullableText(form.value.instructorName),
    plannedStartAt: dayjs(form.value.plannedStartAt).toISOString(),
    plannedEndAt: dayjs(form.value.plannedEndAt).toISOString(),
    location: normalizeNullableText(form.value.location),
    content: form.value.content.trim(),
    requirements: normalizeNullableText(form.value.requirements),
    trainingHours: Number(form.value.trainingHours || 0),
    assessmentMethod: form.value.assessmentMethod,
    warningStatus: form.value.warningStatus,
    attachmentUrls: [...form.value.attachmentUrls],
    remark: normalizeNullableText(form.value.remark),
    participantIds: [...form.value.participantIds]
  })

  const handleSave = async (publish: boolean): Promise<void> => {
    if (submitting.value) return
    try {
      await formRef.value?.validate()
      if (dayjs(form.value.plannedEndAt).isBefore(dayjs(form.value.plannedStartAt))) {
        await formRef.value?.focusField('plannedEndAt')
        ElMessage.warning('计划结束时间不能早于开始时间')
        return
      }
      submitting.value = true
      const type = form.value.id ? 'edit' : 'add'
      await saveSafetyTrainingPlan(buildPayload(), publish)
      emit('success', type)
      await dialogRef.value?.handleClose(true)
    } catch {
      // 表单校验或 API 层已提供业务提示，保留输入供修正。
    } finally {
      submitting.value = false
    }
  }

  const handleOpen = async (data: TrainingPlanDialogOpenData): Promise<void> => {
    initialize(data)
    await dialogRef.value?.handleOpen(data, {
      title: data.copy ? '复制并新增培训计划' : data.row ? '编辑培训计划' : '新增培训计划',
      subtitle: '按企业培训制度编制计划，发布后下推实施记录、签到与归档数据',
      contentMaxHeight: '72vh',
      confirmText: '保存计划',
      onOpen: async () => {
        await Promise.all([
          numberRule.loadRule(),
          ...[
            'commonWarningStatus',
            'smisSafetyTrainingCategory',
            'smisSafetyTrainingType',
            'smisSafetyTrainingForm',
            'smisSafetyTrainingLevel',
            'smisSafetyTrainingAssessmentMethod'
          ].map((code) => userStore.ensureDictLoaded(code))
        ])
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .training-plan-dialog {
    display: grid;

    &__helper {
      display: block;
      margin-top: var(--art-space-2);
      color: var(--el-text-color-secondary);
    }

    &__footer {
      display: flex;
      gap: var(--art-space-4);
      align-items: center;
      justify-content: space-between;
      width: 100%;

      > span {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }

      > div {
        display: flex;
        gap: var(--art-space-2);
      }
    }

    @media (width <= 760px) {
      &__footer {
        flex-direction: column;
        align-items: flex-end;
      }

      &__footer > span {
        max-width: 100%;
      }
    }
  }
</style>
