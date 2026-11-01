<template>
  <ArtDialog ref="dialogRef" size="sm">
    <ElAlert
      class="mb-4"
      title="发放后领用人未主动确认时，系统将在设定天数到期后自动确认，并记录确认来源为“系统”。"
      type="info"
      :closable="false"
      show-icon
    />
    <ArtForm
      ref="formRef"
      v-model="form"
      :rules="rules"
      :items="formItems"
      :span="24"
      label-position="top"
    />
  </ArtDialog>
</template>

<script setup lang="ts">
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import type { FormRules } from 'element-plus'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import type { FormItem } from '@/components/core/forms/art-form/index.vue'
  import { fetchToolSetting, saveToolSetting } from '@smis/api'

  interface SettingForm {
    autoConfirmDays: number
  }

  const emit = defineEmits<{ success: [days: number] }>()
  const dialogRef = ref<ArtDialogExpose>()
  const formRef = ref<{ validate: () => Promise<boolean>; clearValidate: () => void }>()
  const form = ref<SettingForm>({ autoConfirmDays: 3 })
  const formItems: FormItem[] = [
    {
      label: '自动确认等待天数',
      key: 'autoConfirmDays',
      type: 'number',
      span: 24,
      description: '可配置 1–30 天，默认 3 天；修改后仅影响尚未确认的领用明细。',
      props: { min: 1, max: 30, precision: 0, controlsPosition: 'right', class: '!w-full' }
    }
  ]
  const rules: FormRules<SettingForm> = {
    autoConfirmDays: [{ required: true, message: '请输入自动确认等待天数', trigger: 'change' }]
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await saveToolSetting(form.value.autoConfirmDays)
      emit('success', form.value.autoConfirmDays)
      return true
    } catch (error) {
      notifyFriendlyError(error, '自动确认设置保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (): Promise<void> => {
    await dialogRef.value?.handleOpen(undefined, {
      title: '自动确认规则',
      subtitle: '配置领用人未操作时的系统确认时限',
      confirmText: '保存规则',
      onOpen: async (_data, api) => {
        api.setLoading(true)
        try {
          const result = await fetchToolSetting()
          form.value.autoConfirmDays = result.data?.autoConfirmDays ?? 3
          await nextTick()
          formRef.value?.clearValidate()
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit
    })
  }

  defineExpose({ handleOpen })
</script>
