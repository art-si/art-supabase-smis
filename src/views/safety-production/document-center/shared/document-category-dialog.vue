<template>
  <ArtDialog ref="dialogRef" size="md">
    <div class="document-category-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:folder-settings-line" /></template>
        <strong>维护清晰稳定的分类层级</strong>
        <p>同一上级下分类名称不可重复，移动分类会保留下级和文档归属。</p>
      </ArtEntitySummary>

      <ArtForm
        ref="formRef"
        v-model="form"
        :items="items"
        :rules="rules"
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
  import type { FormRules } from 'element-plus'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import {
    saveDocumentCategory,
    type SmisDocumentCategory,
    type SmisDocumentCategorySavePayload
  } from '@smis/api'

  export interface DocumentCategoryDialogOpenData {
    categories: SmisDocumentCategory[]
    row?: SmisDocumentCategory
    parentId?: string
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<DocumentCategoryDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const categories = shallowRef<SmisDocumentCategory[]>([])
  const categoryProps = { label: 'categoryName', children: 'children' }
  const initial = (): SmisDocumentCategorySavePayload => ({
    id: undefined,
    parentId: null,
    categoryName: '',
    sort: 10,
    status: 'enabled',
    description: ''
  })
  const form = ref<SmisDocumentCategorySavePayload>(initial())
  const items: FormItem[] = [
    {
      label: '分类名称',
      key: 'categoryName',
      type: 'input',
      span: 12,
      props: { maxlength: 100, showWordLimit: true, placeholder: '请输入分类名称' }
    },
    {
      label: '上级分类',
      key: 'parentId',
      span: 12,
      type: 'treeSelect',
      get props(): FormItem['props'] {
        return {
          data: categories.value,
          props: categoryProps,
          nodeKey: 'id',
          valueKey: 'id',
          checkStrictly: true,
          defaultExpandAll: true,
          filterable: true,
          clearable: true,
          placeholder: '留空表示一级分类'
        }
      }
    },
    {
      label: '排序权重',
      key: 'sort',
      type: 'number',
      span: 12,
      description: '数值越小越靠前，仅用于分类树排序。',
      props: { min: 0, max: 999999, step: 10, controlsPosition: 'right', class: '!w-full' }
    },
    {
      label: '启用状态',
      key: 'status',
      type: 'switch',
      span: 12,
      props: {
        activeValue: 'enabled',
        inactiveValue: 'disabled',
        activeText: '启用',
        inactiveText: '停用',
        inlinePrompt: true
      }
    },
    {
      label: '分类说明',
      key: 'description',
      type: 'textarea',
      span: 24,
      props: {
        rows: 4,
        maxlength: 1000,
        showWordLimit: true,
        resize: 'none',
        placeholder: '说明该分类收录范围，便于维护人员保持一致口径'
      }
    }
  ]
  const rules: FormRules<SmisDocumentCategorySavePayload> = {
    categoryName: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
    sort: [{ required: true, message: '请输入排序权重', trigger: 'change' }]
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await saveDocumentCategory({
        ...toRaw(form.value),
        parentId: form.value.parentId || null,
        categoryName: form.value.categoryName.trim(),
        description: normalizeNullableText(form.value.description)
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '文档分类保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: DocumentCategoryDialogOpenData): Promise<void> => {
    Object.assign(form.value, initial())
    categories.value = data.categories
    if (data.row) {
      Object.assign(form.value, {
        id: data.row.id,
        parentId: data.row.parentId || null,
        categoryName: data.row.categoryName,
        sort: data.row.sort,
        status: data.row.status,
        description: data.row.description || ''
      })
    } else if (data.parentId) {
      form.value.parentId = data.parentId
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑文档分类' : '新增文档分类',
      subtitle: '分类树由当前租户统一维护，并供各类文档台账参选',
      confirmText: data.row ? '保存分类更改' : '创建分类',
      contentMaxHeight: 'calc(100vh - 180px)',
      onConfirm: handleSubmit
    })
  }

  defineExpose({ handleOpen })
</script>
