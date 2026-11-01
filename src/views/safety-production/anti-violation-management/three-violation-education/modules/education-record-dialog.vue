<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="education-record-dialog">
      <div v-if="currentRow" class="education-record-dialog__subject">
        <ElAvatar :size="56" :src="currentRow.avatarUrl || undefined">
          {{ currentRow.employeeName.slice(-1) }}
        </ElAvatar>
        <div class="education-record-dialog__identity">
          <div>
            <strong>{{ currentRow.employeeName }}</strong>
            <ArtDictDisplay
              dict-code="commonWarningStatus"
              :value="currentRow.warningStatus"
              display="tag"
            />
          </div>
          <p>
            {{
              [currentRow.employeeNo, currentRow.organizationName, currentRow.positionName]
                .filter(Boolean)
                .join(' · ')
            }}
          </p>
          <blockquote>{{ currentRow.violationDescription }}</blockquote>
        </div>
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
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import {
    recordThreeViolationEducation,
    type SmisThreeViolationEducation,
    type SmisThreeViolationEducationRecordPayload
  } from '@smis/api'

  interface FormModel {
    educationContent: string
    educationResult: string
    educationStartTime: string
    educationCompletedAt: string
    trainingHours: number
    examScore?: number
    responsibleEmployeeIds: string[]
    attachmentUrls: string[]
    educationRemark: string
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<SmisThreeViolationEducation>>()
  const formRef = ref<FormExpose>()
  const currentRow = shallowRef<SmisThreeViolationEducation>()
  const responsibleSelection = ref<EmployeeIntegrationItem[]>([])

  const initial = (): FormModel => ({
    educationContent: '',
    educationResult: '',
    educationStartTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    educationCompletedAt: dayjs().add(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
    trainingHours: 1,
    examScore: undefined,
    responsibleEmployeeIds: [],
    attachmentUrls: [],
    educationRemark: ''
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
    items: FormItem[]
    rules: FormRules<FormModel>
  }>({
    model: initial(),
    items: [
      { label: '教育实施', key: 'implementation', type: 'divider', span: 24 },
      {
        label: '教育负责人',
        key: 'responsibleEmployeeIds',
        span: 24,
        type: 'employeeSelect',
        get props(): FormItem['props'] {
          return {
            multiple: true,
            modelValues: form.model.responsibleEmployeeIds,
            'onUpdate:modelValues': ($event: typeof form.model.responsibleEmployeeIds) => {
              form.model.responsibleEmployeeIds = $event
            },
            selectedData: responsibleSelection.value,
            'onUpdate:selectedData': ($event: typeof responsibleSelection.value) => {
              responsibleSelection.value = $event
            },
            tenantId: currentRow.value?.tenantId,
            title: '选择教育负责人',
            subtitle: '支持多选，提交后同步更新安全教育台账',
            placeholder: '请选择一名或多名教育负责人'
          }
        }
      },
      {
        label: '教育开始时间',
        key: 'educationStartTime',
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
        label: '教育完成时间',
        key: 'educationCompletedAt',
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
        label: '培训课时',
        key: 'trainingHours',
        type: 'number',
        props: { min: 0.1, max: 1000, precision: 1, step: 0.5, class: '!w-full' }
      },
      {
        label: '考核分数',
        key: 'examScore',
        type: 'number',
        props: { min: 0, max: 100, precision: 1, class: '!w-full', placeholder: '选填' }
      },
      {
        label: '教育培训内容',
        key: 'educationContent',
        type: 'textarea',
        span: 24,
        props: textareaProps('记录规程学习、案例警示、现场讲解等实际教育内容', 5000, 5)
      },
      {
        label: '教育培训结果',
        key: 'educationResult',
        type: 'textarea',
        span: 24,
        props: textareaProps('记录考核结论、认识改进、班组通报或后续要求', 2000, 4)
      },
      { label: '教育证据', key: 'evidence', type: 'divider', span: 24 },
      {
        label: '教育相关材料',
        key: 'attachmentUrls',
        span: 24,
        type: 'uploadFile',
        get props(): FormItem['props'] {
          return {
            multiple: true,
            limit: 20,
            accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,image/*',
            tip: '上传签到表、试卷、照片或教育材料，最多 20 个文件'
          }
        }
      },
      {
        label: '教育备注',
        key: 'educationRemark',
        type: 'textarea',
        span: 24,
        props: textareaProps('补充说明（选填）', 1000, 3)
      }
    ],
    rules: {
      responsibleEmployeeIds: [
        {
          required: true,
          type: 'array',
          min: 1,
          message: '请至少选择一名教育负责人',
          trigger: 'change'
        }
      ],
      educationStartTime: [{ required: true, message: '请选择教育开始时间', trigger: 'change' }],
      educationCompletedAt: [{ required: true, message: '请选择教育完成时间', trigger: 'change' }],
      trainingHours: [{ required: true, message: '请输入培训课时', trigger: 'blur' }],
      educationContent: [{ required: true, message: '请输入教育培训内容', trigger: 'blur' }],
      educationResult: [{ required: true, message: '请输入教育培训结果', trigger: 'blur' }]
    }
  })

  const handleSubmit = async (): Promise<boolean> => {
    const row = currentRow.value
    if (!row) return false
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (dayjs(form.model.educationCompletedAt).isBefore(dayjs(form.model.educationStartTime))) {
        ElMessage.warning('教育完成时间不能早于教育开始时间')
        return false
      }
      const payload: SmisThreeViolationEducationRecordPayload = {
        educationContent: form.model.educationContent.trim(),
        educationResult: form.model.educationResult.trim(),
        educationStartTime: dayjs(form.model.educationStartTime).toISOString(),
        educationCompletedAt: dayjs(form.model.educationCompletedAt).toISOString(),
        trainingHours: Number(form.model.trainingHours),
        examScore:
          form.model.examScore === undefined || form.model.examScore === null
            ? null
            : Number(form.model.examScore),
        responsibleEmployeeIds: [...form.model.responsibleEmployeeIds],
        attachmentUrls: [...form.model.attachmentUrls],
        educationRemark: normalizeNullableText(form.model.educationRemark)
      }
      await recordThreeViolationEducation(row.id, payload)
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '违章教育记录保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (row: SmisThreeViolationEducation): Promise<void> => {
    currentRow.value = row
    Object.assign(form.model, initial(), {
      educationContent: row.educationContent || row.plannedEducationContent || '',
      educationResult: row.educationResult || '',
      educationStartTime: row.educationStartTime
        ? dayjs(row.educationStartTime).format('YYYY-MM-DD HH:mm:ss')
        : dayjs().format('YYYY-MM-DD HH:mm:ss'),
      educationCompletedAt: row.educationCompletedAt
        ? dayjs(row.educationCompletedAt).format('YYYY-MM-DD HH:mm:ss')
        : dayjs().add(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      trainingHours: row.trainingHours ?? 1,
      examScore: row.examScore ?? undefined,
      responsibleEmployeeIds: row.responsibleEmployees.map((item) => item.id),
      attachmentUrls: [...row.attachmentUrls],
      educationRemark: row.educationRemark || ''
    })
    responsibleSelection.value = row.responsibleEmployees.map((item) => ({
      id: item.id,
      tenantId: row.tenantId,
      employeeNo: item.employeeNo,
      employeeName: item.employeeName,
      jobTitle: item.positionName,
      employmentStatus: 'active',
      organization: null
    }))
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(row, {
      title: row.educationStatus === 'educated' ? '补充教育信息' : '记录教育信息',
      subtitle: '记录教育实施过程、结果和材料，提交后形成可打印安全教育台账',
      confirmText: row.educationStatus === 'educated' ? '更新教育记录' : '完成教育记录',
      contentMaxHeight: 'calc(100vh - 150px)',
      onConfirm: handleSubmit
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .education-record-dialog {
    &__subject {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 14px;
      align-items: start;
      padding: 15px 16px;
      margin-bottom: 18px;
      background: color-mix(in srgb, var(--el-color-warning) 7%, var(--default-box-color));
      border-left: 3px solid var(--el-color-warning);
      border-radius: var(--el-border-radius-base);
    }

    &__identity {
      min-width: 0;

      > div {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      strong {
        font-size: 16px;
      }

      p {
        margin: 3px 0 8px;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }

      blockquote {
        padding: 8px 10px;
        margin: 0;
        font-size: 13px;
        line-height: 1.55;
        color: var(--el-text-color-regular);
        background: var(--default-box-color);
        border-radius: var(--el-border-radius-small);
      }
    }
  }
</style>
