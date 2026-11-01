<template>
  <ArtDialog ref="dialogRef" size="md">
    <ArtForm
      ref="formRef"
      v-model="form.model"
      :items="form.items"
      :rules="form.rules"
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
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import {
    saveAnnouncementCategory,
    type SmisAnnouncementCategory,
    type SmisAnnouncementCategorySavePayload
  } from '@smis/api'

  export interface AnnouncementCategoryDialogOpenData {
    row?: SmisAnnouncementCategory
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const dialogRef = ref<ArtDialogExpose<AnnouncementCategoryDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const createInitialForm = (): SmisAnnouncementCategorySavePayload => ({
    id: undefined,
    categoryName: '',
    sort: 10,
    status: 'enabled',
    description: ''
  })
  const form = reactive<{
    model: SmisAnnouncementCategorySavePayload
    items: ComputedRef<FormItem[]>
    rules: FormRules<SmisAnnouncementCategorySavePayload>
  }>({
    model: createInitialForm(),
    items: computed(() => [
      {
        label: '分类名称',
        key: 'categoryName',
        type: 'input',
        span: 24,
        props: { maxlength: 100, placeholder: '请输入清晰、可复用的公告分类名称' }
      },
      {
        label: '启用状态',
        key: 'status',
        type: 'switch',
        span: 24,
        description: '停用后保留历史公告引用，但新建公告时不再提供该分类。',
        props: {
          activeValue: 'enabled',
          inactiveValue: 'disabled',
          activeText: '启用',
          inactiveText: '停用',
          inlinePrompt: true,
          style: { '--el-switch-on-color': 'var(--el-color-success)' }
        }
      },
      {
        label: '分类说明',
        key: 'description',
        type: 'input',
        span: 24,
        props: {
          type: 'textarea',
          rows: 3,
          maxlength: 500,
          showWordLimit: true,
          resize: 'none',
          placeholder: '说明该分类适用的公告内容'
        }
      }
    ]),
    rules: {
      categoryName: [
        { required: true, message: '请输入公告分类名称', trigger: 'blur' },
        { max: 100, message: '分类名称不能超过 100 个字符', trigger: 'blur' }
      ],
      status: [{ required: true, message: '请选择状态', trigger: 'change' }]
    }
  })
  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, createInitialForm())
    await nextTick()
    formRef.value?.clearValidate()
  }
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await saveAnnouncementCategory({
        ...toRaw(form.model),
        categoryName: form.model.categoryName.trim(),
        description: normalizeNullableText(form.model.description)
      })
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '公告分类保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: AnnouncementCategoryDialogOpenData): Promise<void> => {
    await resetForm()
    if (data.row)
      Object.assign(form.model, {
        id: data.row.id,
        categoryName: data.row.categoryName,
        sort: data.row.sort,
        status: data.row.status,
        description: data.row.description || ''
      })
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑公告分类' : '新增公告分类',
      subtitle: '分类用于公告检索、阅读识别与后续统计。',
      confirmText: '保存分类',
      onConfirm: handleSubmit
    })
  }
  defineExpose({ handleOpen })
</script>
