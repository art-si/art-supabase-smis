<template>
  <ArtDialog ref="dialogRef" size="sm" :show-confirm-button="false">
    <ElAlert
      :title="prompt"
      :type="action === 'void' ? 'warning' : 'info'"
      :closable="false"
      show-icon
    />
    <ArtForm
      ref="formRef"
      v-model="form"
      :items="[]"
      :rules="rules"
      :validate-on-rule-change="false"
      custom-layout
      scroll-to-error
      root-class="workflow-form p-0! md:p-0!"
    >
      <ElFormItem v-if="action === 'start'" label="审批结果" prop="result" required>
        <ElRadioGroup v-model="form.result"
          ><ElRadio value="approved">审批通过并开始作业</ElRadio
          ><ElRadio value="rejected">拒绝申请</ElRadio></ElRadioGroup
        >
      </ElFormItem>
      <ElFormItem v-if="action === 'accept'" label="验收结果" prop="result" required>
        <ElRadioGroup v-model="form.result"
          ><ElRadio value="passed">验收通过</ElRadio
          ><ElRadio value="returned">退回整改</ElRadio></ElRadioGroup
        >
      </ElFormItem>
      <ElFormItem
        :label="action === 'void' ? '作废原因' : '处理说明'"
        prop="description"
        :required="action === 'void'"
      >
        <ElInput
          v-model="form.description"
          type="textarea"
          :rows="4"
          maxlength="500"
          show-word-limit
          :placeholder="descriptionPlaceholder"
        />
      </ElFormItem>
    </ArtForm>
    <template #footer="{ api }">
      <ElButton :disabled="submitting" @click="api.handleClose()">取消</ElButton>
      <ElButton
        :type="action === 'void' ? 'danger' : 'primary'"
        :loading="submitting"
        @click="submit"
        >{{ confirmLabel }}</ElButton
      >
    </template>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, shallowRef } from 'vue'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import ArtForm from '@/components/core/forms/art-form/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import {
    transitionSpecialOperationPermit,
    type SmisSpecialOperationPermit,
    type SmisSpecialOperationTransitionAction
  } from '@smis/api'

  interface OpenData {
    row: Pick<SmisSpecialOperationPermit, 'id' | 'permitNo' | 'tenantId'>
    action: SmisSpecialOperationTransitionAction
  }
  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<OpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const current = shallowRef<OpenData>()
  const action = computed(() => current.value?.action || 'start')
  const form = ref({ result: 'approved', description: '' })
  const rules = computed<FormRules>(() => ({
    ...(action.value === 'start' || action.value === 'accept'
      ? { result: [{ required: true, message: '请选择审批结果', trigger: 'change' }] }
      : {}),
    ...(action.value === 'void'
      ? {
          description: [
            { required: true, whitespace: true, message: '请填写作废原因', trigger: 'blur' }
          ]
        }
      : {})
  }))
  const submitting = ref(false)
  const titleMap: Record<SmisSpecialOperationTransitionAction, string> = {
    start: '审批作业票',
    request_acceptance: '申请验收',
    accept: '作业验收',
    void: '作废作业票'
  }
  const promptMap: Record<SmisSpecialOperationTransitionAction, string> = {
    start: '审批通过后，作业票将进入“作业中”；拒绝后可修改并重新提交。',
    request_acceptance: '提交后作业票进入“待验收”，由有验收权限的人员完成闭环。',
    accept: '验收通过后作业票完成；退回后回到“作业中”继续整改。',
    void: '作废后仅保留历史记录，不能恢复或继续流转。'
  }
  const prompt = computed(() => promptMap[action.value])
  const confirmLabel = computed(
    () =>
      ({
        start: '确认审批',
        request_acceptance: '提交验收申请',
        accept: '确认验收',
        void: '确认作废'
      })[action.value]
  )
  const descriptionPlaceholder = computed(() =>
    action.value === 'void' ? '请填写具体作废原因' : '可填写审批、验收或整改说明'
  )

  const submit = async (): Promise<void> => {
    if (!current.value) return
    try {
      await formRef.value?.validate()
    } catch {
      return
    }
    submitting.value = true
    try {
      await transitionSpecialOperationPermit(current.value.row.id, action.value, {
        result: ['start', 'accept'].includes(action.value) ? form.value.result : null,
        description: form.value.description,
        tenantId: current.value.row.tenantId
      })
      await dialogRef.value?.handleClose()
      emit('success')
    } finally {
      submitting.value = false
    }
  }
  const handleOpen = async (data: OpenData): Promise<void> => {
    current.value = data
    form.value.result = data.action === 'accept' ? 'passed' : 'approved'
    form.value.description = ''
    void nextTick(() => formRef.value?.clearValidate())
    await dialogRef.value?.handleOpen(data, {
      title: titleMap[data.action],
      subtitle: data.row.permitNo
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .workflow-form {
    margin-top: 16px;
  }

  :deep(.el-radio-group) {
    display: grid;
    gap: 8px;
  }
</style>
