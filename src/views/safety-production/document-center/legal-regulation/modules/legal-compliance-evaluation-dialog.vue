<template>
  <ArtDialog ref="dialogRef" size="md">
    <ArtForm
      ref="formRef"
      v-model="form"
      :items="items"
      :rules="rules"
      :span="12"
      :gutter="24"
      label-position="top"
    />
  </ArtDialog>
</template>

<script setup lang="ts">
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    saveLegalComplianceEvaluation,
    type SmisLegalComplianceEvaluation,
    type SmisLegalComplianceEvaluationSavePayload
  } from '@smis/api'

  export type LegalComplianceEvaluationDialogMode = 'add' | 'copy' | 'edit'
  export interface LegalComplianceEvaluationDialogOpenData {
    mode: LegalComplianceEvaluationDialogMode
    documentId: string
    row?: SmisLegalComplianceEvaluation
  }

  interface FormModel {
    id?: string
    documentId: string
    relatedClause: string
    controlStatus: string
    evaluationConclusion: string
    evaluationDate: string
    evaluatorName: string
    remark: string
    copySourceId?: string
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getUserInfo } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<LegalComplianceEvaluationDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const mode = ref<LegalComplianceEvaluationDialogMode>('add')
  const initial = (): FormModel => ({
    id: undefined,
    documentId: '',
    relatedClause: '',
    controlStatus: '',
    evaluationConclusion: '',
    evaluationDate: dayjs().format('YYYY-MM-DD'),
    evaluatorName:
      getUserInfo.value.hrEmployee?.employeeName ||
      getUserInfo.value.nickName ||
      getUserInfo.value.userName ||
      '',
    remark: '',
    copySourceId: undefined
  })
  const form = ref<FormModel>(initial())
  const items: FormItem[] = [
    {
      label: '相关条款',
      key: 'relatedClause',
      type: 'textarea',
      span: 24,
      props: {
        rows: 3,
        maxlength: 1000,
        showWordLimit: true,
        resize: 'none',
        placeholder: '摘录或概述本次评价涉及的法律法规条款'
      }
    },
    {
      label: '控制现状',
      key: 'controlStatus',
      type: 'textarea',
      span: 24,
      props: {
        rows: 3,
        maxlength: 1000,
        showWordLimit: true,
        resize: 'none',
        placeholder: '说明公司目前的制度、流程、设施或执行情况'
      }
    },
    {
      label: '评价结论',
      key: 'evaluationConclusion',
      type: 'textarea',
      span: 24,
      props: {
        rows: 3,
        maxlength: 500,
        showWordLimit: true,
        resize: 'none',
        placeholder: '填写符合、部分符合、不符合及后续改进结论'
      }
    },
    {
      label: '评价日期',
      key: 'evaluationDate',
      type: 'date',
      span: 12,
      props: { valueFormat: 'YYYY-MM-DD', clearable: false, class: '!w-full' }
    },
    {
      label: '评价人',
      key: 'evaluatorName',
      type: 'input',
      span: 12,
      props: { maxlength: 100, showWordLimit: true, placeholder: '请输入评价人' }
    },
    {
      label: '备注',
      key: 'remark',
      type: 'textarea',
      span: 24,
      props: {
        rows: 3,
        maxlength: 1000,
        showWordLimit: true,
        resize: 'none',
        placeholder: '补充整改计划、证据位置或其他说明'
      }
    }
  ]
  const rules: FormRules<FormModel> = {
    relatedClause: [{ required: true, message: '请输入相关条款', trigger: 'blur' }],
    controlStatus: [{ required: true, message: '请输入控制现状', trigger: 'blur' }],
    evaluationConclusion: [{ required: true, message: '请输入评价结论', trigger: 'blur' }],
    evaluationDate: [{ required: true, message: '请选择评价日期', trigger: 'change' }],
    evaluatorName: [{ required: true, message: '请输入评价人', trigger: 'blur' }]
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const payload: SmisLegalComplianceEvaluationSavePayload = {
        id: form.value.id,
        documentId: form.value.documentId,
        relatedClause: form.value.relatedClause.trim(),
        controlStatus: form.value.controlStatus.trim(),
        evaluationConclusion: form.value.evaluationConclusion.trim(),
        evaluationDate: form.value.evaluationDate,
        evaluatorName: form.value.evaluatorName.trim(),
        remark: normalizeNullableText(form.value.remark),
        copySourceId: form.value.copySourceId || null
      }
      await saveLegalComplianceEvaluation(payload)
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '法规符合性评价保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: LegalComplianceEvaluationDialogOpenData): Promise<void> => {
    Object.assign(form.value, initial(), { documentId: data.documentId })
    mode.value = data.mode
    if (data.row) {
      Object.assign(form.value, {
        id: data.mode === 'edit' ? data.row.id : undefined,
        relatedClause: data.row.relatedClause,
        controlStatus: data.row.controlStatus,
        evaluationConclusion: data.row.evaluationConclusion,
        evaluationDate: data.row.evaluationDate,
        evaluatorName: data.row.evaluatorName,
        remark: data.row.remark || '',
        copySourceId: data.mode === 'copy' ? data.row.id : undefined
      })
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title:
        data.mode === 'copy'
          ? '复制并新增评价'
          : data.mode === 'edit'
            ? '编辑合规性评价'
            : '新增合规性评价',
      subtitle: '评价记录独立留痕，不覆盖历史评价结论',
      confirmText:
        data.mode === 'copy' ? '复制并新增' : data.mode === 'edit' ? '保存评价更改' : '新增评价',
      contentMaxHeight: 'calc(100vh - 170px)',
      onConfirm: handleSubmit
    })
  }

  defineExpose({ handleOpen })
</script>
