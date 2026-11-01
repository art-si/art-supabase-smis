<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="hazard-workflow-dialog">
      <div class="hazard-workflow-dialog__identity">
        <span aria-hidden="true"><ArtSvgIcon :icon="modeConfig.icon" /></span>
        <div>
          <small>{{ modeConfig.eyebrow }}</small>
          <strong>{{ currentRow?.hazardNo }}</strong>
          <p>{{ currentRow?.location }} · {{ currentRow?.description }}</p>
        </div>
      </div>
      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="formItems"
        :rules="formRules"
        :span="12"
        :gutter="24"
        label-position="top"
      >
        <template #approvalResult>
          <ElRadioGroup v-model="form.model.approvalResult" class="hazard-workflow-dialog__choice">
            <ElRadioButton v-for="item in approvalOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </ElRadioButton>
          </ElRadioGroup>
        </template>
        <template #acceptanceResult>
          <ElRadioGroup
            v-model="form.model.acceptanceResult"
            class="hazard-workflow-dialog__choice"
          >
            <ElRadioButton v-for="item in acceptanceOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </ElRadioButton>
          </ElRadioGroup>
        </template>
        <template #responsibleEmployeeId>
          <ArtEmployeeSelect
            v-model="form.model.responsibleEmployeeId"
            v-model:selected-data="form.responsibleSelection"
            :tenant-id="getUserInfo.tenantId"
            title="选择整改责任人"
            subtitle="数据来自当前租户员工花名册"
            placeholder="点击选择整改责任人"
          />
        </template>
        <template #imageUrls>
          <ArtUploadImage
            v-model="form.model.imageUrls"
            :title="mode === 'accept' ? '上传验收照片' : '上传整改照片'"
            multiple
            :limit="9"
            :size="104"
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
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    acceptHiddenHazard,
    approveHiddenHazard,
    rectifyHiddenHazard,
    type SmisHiddenHazardAcceptanceResult,
    type SmisHiddenHazardApprovalResult,
    type SmisHiddenHazardGovernanceRecord
  } from '@smis/api'

  export type HazardWorkflowMode = 'approve' | 'rectify' | 'accept'
  export interface HazardWorkflowDialogOpenData {
    mode: HazardWorkflowMode
    row: SmisHiddenHazardGovernanceRecord
  }
  interface WorkflowFormModel {
    approvalResult: SmisHiddenHazardApprovalResult
    acceptanceResult: SmisHiddenHazardAcceptanceResult
    responsibleEmployeeId: string
    rectificationDeadline: string
    rectificationMeasures: string
    approvalDescription: string
    completedAt: string
    description: string
    imageUrls: string[]
  }
  interface WorkflowFormGroup {
    model: WorkflowFormModel
    responsibleSelection: EmployeeIntegrationItem[]
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap, getUserInfo } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<HazardWorkflowDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const mode = ref<HazardWorkflowMode>('approve')
  const currentRow = shallowRef<SmisHiddenHazardGovernanceRecord | null>(null)
  const initialModel = (): WorkflowFormModel => ({
    approvalResult: 'rectify',
    acceptanceResult: 'passed',
    responsibleEmployeeId: '',
    rectificationDeadline: dayjs().add(7, 'day').format('YYYY-MM-DD HH:mm:ss'),
    rectificationMeasures: '',
    approvalDescription: '',
    completedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    description: '',
    imageUrls: []
  })
  const form = reactive<WorkflowFormGroup>({
    model: initialModel(),
    responsibleSelection: []
  })
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const approvalOptions = computed(() => dictOptions('smisHiddenHazardApprovalResult'))
  const acceptanceOptions = computed(() => dictOptions('smisHiddenHazardAcceptanceResult'))
  const modeConfig = computed(() => {
    const config = {
      approve: {
        title: '隐患核准',
        subtitle: '确认是否进入整改，并明确责任人、时限与措施',
        confirmText: '提交核准',
        eyebrow: 'APPROVAL DECISION',
        icon: 'ri:shield-check-line'
      },
      rectify: {
        title: '隐患整改',
        subtitle: '记录整改完成情况和现场照片，提交后进入待验收',
        confirmText: '提交整改',
        eyebrow: 'RECTIFICATION EVIDENCE',
        icon: 'ri:tools-line'
      },
      accept: {
        title: '隐患验收',
        subtitle: '核验整改成效，补充验收说明和验收照片',
        confirmText: '提交验收',
        eyebrow: 'ACCEPTANCE REVIEW',
        icon: 'ri:checkbox-circle-line'
      }
    }
    return config[mode.value]
  })
  const formItems = computed<FormItem[]>(() => {
    if (mode.value === 'approve') {
      const items: FormItem[] = [
        { label: '核准结论', key: 'approvalResult', type: 'text', span: 24 }
      ]
      if (form.model.approvalResult === 'rectify') {
        items.push(
          { label: '整改责任人', key: 'responsibleEmployeeId', type: 'text', span: 12 },
          {
            label: '整改时限',
            key: 'rectificationDeadline',
            type: 'date',
            span: 12,
            props: {
              type: 'datetime',
              valueFormat: 'YYYY-MM-DD HH:mm:ss',
              class: '!w-full',
              clearable: false,
              placeholder: '请选择整改时限'
            }
          },
          {
            label: '整改措施',
            key: 'rectificationMeasures',
            type: 'textarea',
            span: 24,
            props: {
              rows: 4,
              maxlength: 1000,
              showWordLimit: true,
              resize: 'none',
              placeholder: '说明必须落实的控制措施、整改标准和完成要求'
            }
          }
        )
      }
      items.push({
        label: form.model.approvalResult === 'close' ? '关闭原因' : '核准说明',
        key: 'approvalDescription',
        type: 'textarea',
        span: 24,
        props: {
          rows: 3,
          maxlength: 500,
          showWordLimit: true,
          resize: 'none',
          placeholder:
            form.model.approvalResult === 'close'
              ? '请说明关闭原因，例如误报、重复或不构成隐患'
              : '补充核准判断或整改关注事项'
        }
      })
      return items
    }
    if (mode.value === 'rectify') {
      return [
        {
          label: '整改完成时间',
          key: 'completedAt',
          type: 'date',
          span: 12,
          props: {
            type: 'datetime',
            valueFormat: 'YYYY-MM-DD HH:mm:ss',
            class: '!w-full',
            clearable: false
          }
        },
        {
          label: '整改完成说明',
          key: 'description',
          type: 'textarea',
          span: 24,
          props: {
            rows: 4,
            maxlength: 1000,
            showWordLimit: true,
            resize: 'none',
            placeholder: '说明已采取的措施、整改结果和现场状态'
          }
        },
        { label: '整改照片', key: 'imageUrls', type: 'text', span: 24 }
      ]
    }
    return [
      { label: '验收结论', key: 'acceptanceResult', type: 'text', span: 24 },
      {
        label: '验收说明',
        key: 'description',
        type: 'textarea',
        span: 24,
        props: {
          rows: 4,
          maxlength: 1000,
          showWordLimit: true,
          resize: 'none',
          placeholder:
            form.model.acceptanceResult === 'passed'
              ? '说明验收依据与整改效果'
              : '说明未通过原因和需继续整改的事项'
        }
      },
      {
        label: '验收照片',
        key: 'imageUrls',
        type: 'text',
        span: 24,
        description: '支持上传整改后现场、检测结果或验收记录照片'
      }
    ]
  })
  const formRules = computed<FormRules<WorkflowFormModel>>(() => {
    if (mode.value === 'approve') {
      return {
        approvalResult: [{ required: true, message: '请选择核准结论', trigger: 'change' }],
        responsibleEmployeeId:
          form.model.approvalResult === 'rectify'
            ? [{ required: true, message: '请选择整改责任人', trigger: 'change' }]
            : [],
        rectificationDeadline:
          form.model.approvalResult === 'rectify'
            ? [{ required: true, message: '请选择整改时限', trigger: 'change' }]
            : [],
        rectificationMeasures:
          form.model.approvalResult === 'rectify'
            ? [{ required: true, message: '请输入整改措施', trigger: 'blur' }]
            : [],
        approvalDescription:
          form.model.approvalResult === 'close'
            ? [{ required: true, message: '请输入关闭原因', trigger: 'blur' }]
            : []
      }
    }
    if (mode.value === 'rectify') {
      return {
        completedAt: [{ required: true, message: '请选择整改完成时间', trigger: 'change' }],
        description: [{ required: true, message: '请输入整改完成说明', trigger: 'blur' }]
      }
    }
    return {
      acceptanceResult: [{ required: true, message: '请选择验收结论', trigger: 'change' }],
      description: [{ required: true, message: '请输入验收说明', trigger: 'blur' }]
    }
  })

  const responsibleSelection = (
    row: SmisHiddenHazardGovernanceRecord
  ): EmployeeIntegrationItem[] =>
    row.rectificationResponsibleEmployeeId
      ? [
          {
            id: row.rectificationResponsibleEmployeeId,
            tenantId: getUserInfo.value.tenantId || '',
            employeeNo: row.rectificationResponsibleEmployeeNo || '',
            employeeName: row.rectificationResponsibleEmployeeName || '未命名员工',
            employmentStatus: 'active'
          }
        ]
      : []
  const handleSubmit = async (): Promise<boolean> => {
    const row = currentRow.value
    if (!row) return false
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (mode.value === 'approve') {
        await approveHiddenHazard({
          id: row.id,
          result: form.model.approvalResult,
          approvalDescription: normalizeNullableText(form.model.approvalDescription),
          rectificationResponsibleEmployeeId:
            form.model.approvalResult === 'rectify' ? form.model.responsibleEmployeeId : null,
          rectificationDeadline:
            form.model.approvalResult === 'rectify' ? form.model.rectificationDeadline : null,
          rectificationMeasures:
            form.model.approvalResult === 'rectify' ? form.model.rectificationMeasures.trim() : null
        })
      } else if (mode.value === 'rectify') {
        await rectifyHiddenHazard({
          id: row.id,
          completedAt: form.model.completedAt,
          description: form.model.description.trim(),
          imageUrls: [...form.model.imageUrls]
        })
      } else {
        await acceptHiddenHazard({
          id: row.id,
          result: form.model.acceptanceResult,
          description: form.model.description.trim(),
          imageUrls: [...form.model.imageUrls]
        })
      }
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '隐患治理失败，请稍后重试')
      return false
    }
  }
  const handleOpen = async (data: HazardWorkflowDialogOpenData): Promise<void> => {
    mode.value = data.mode
    currentRow.value = data.row
    Object.assign(form.model, initialModel(), {
      responsibleEmployeeId: data.row.rectificationResponsibleEmployeeId || '',
      rectificationDeadline:
        data.row.rectificationDeadline || dayjs().add(7, 'day').format('YYYY-MM-DD HH:mm:ss'),
      rectificationMeasures: data.row.rectificationMeasures || ''
    })
    form.responsibleSelection = responsibleSelection(data.row)
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: modeConfig.value.title,
      subtitle: modeConfig.value.subtitle,
      confirmText: modeConfig.value.confirmText,
      contentMaxHeight: 'calc(100vh - 170px)',
      loading: true,
      onOpen: async (_openData, api) => {
        try {
          await Promise.all([
            userStore.ensureDictLoaded('smisHiddenHazardApprovalResult'),
            userStore.ensureDictLoaded('smisHiddenHazardAcceptanceResult')
          ])
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit,
      onReset: () => {
        currentRow.value = null
        Object.assign(form.model, initialModel())
        form.responsibleSelection = []
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .hazard-workflow-dialog {
    min-width: 0;

    &__identity {
      display: grid;
      grid-template-columns: 46px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      padding: 14px 16px;
      margin-bottom: 18px;
      background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-base);
    }

    &__identity > span {
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      color: var(--theme-color);
      background: var(--default-box-color);
      border-radius: var(--el-border-radius-base);
    }

    &__identity small,
    &__identity strong,
    &__identity p {
      display: block;
      min-width: 0;
      margin: 0;
    }

    &__identity small {
      font-size: 11px;
      color: var(--theme-color);
      letter-spacing: 0.08em;
    }

    &__identity strong {
      margin: 2px 0;
    }

    &__identity p {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
    }

    &__choice {
      display: flex;
      width: 100%;
    }

    &__choice :deep(.el-radio-button) {
      flex: 1;
    }

    &__choice :deep(.el-radio-button__inner) {
      width: 100%;
    }
  }
</style>
