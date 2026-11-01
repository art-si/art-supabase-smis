<template>
  <ArtDialog ref="dialogRef" size="md">
    <div class="violation-category-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:node-tree" /></template>
        <strong>统一违章分类口径</strong>
        <p>分类用于标准库归档和三违教育追溯；停用后保留历史关联，不再用于新增标准。</p>
      </ArtEntitySummary>

      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="24"
        label-position="top"
      />
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'

  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import TreeUtils from '@/utils/tree'
  import {
    saveViolationCategory,
    type SmisAntiViolationStatus,
    type SmisViolationCategory,
    type SmisViolationCategorySavePayload
  } from '@smis/api'

  export interface ViolationCategoryDialogOpenData {
    row?: SmisViolationCategory
    tree: SmisViolationCategory[]
    presetParentId?: string
  }

  interface FormModel {
    id?: string
    parentId?: string
    categoryCode: string
    categoryName: string
    sort: number
    status: SmisAntiViolationStatus
    description: string
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const dialogRef = ref<ArtDialogExpose<ViolationCategoryDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const categoryTree = shallowRef<SmisViolationCategory[]>([])

  const initial = (): FormModel => ({
    id: undefined,
    parentId: undefined,
    categoryCode: '',
    categoryName: '',
    sort: 10,
    status: 'enabled',
    description: ''
  })

  const statusOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.commonEnabledStatus ?? []).map(toDictionaryOption)
  )

  const form = reactive<{
    model: FormModel
    items: ComputedRef<FormItem[]>
    rules: FormRules<FormModel>
  }>({
    model: initial(),
    items: computed(() => [
      {
        label: '上级违章分类',
        key: 'parentId',
        type: 'treeSelect',
        span: 24,
        props: {
          data: categoryTree.value,
          nodeKey: 'id',
          checkStrictly: true,
          clearable: true,
          defaultExpandAll: true,
          props: { label: 'categoryName', value: 'id', children: 'children' },
          placeholder: '不选择则创建一级分类'
        }
      },
      {
        label: '分类编码',
        key: 'categoryCode',
        type: 'input',
        props: { maxlength: 40, clearable: true, placeholder: '如 OPERATION' }
      },
      {
        label: '分类名称',
        key: 'categoryName',
        type: 'input',
        props: { maxlength: 100, clearable: true, placeholder: '如 作业行为类' }
      },
      {
        label: '显示顺序',
        key: 'sort',
        type: 'number',
        props: { min: 0, max: 999999, precision: 0, controlsPosition: 'right', class: '!w-full' }
      },
      {
        label: '启用状态',
        key: 'status',
        type: 'select',
        options: statusOptions.value,
        props: { clearable: false, placeholder: '请选择启用状态' }
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
          placeholder: '说明分类边界、适用场景或归类原则'
        }
      }
    ]),
    rules: {
      categoryCode: [
        { required: true, message: '请输入分类编码', trigger: 'blur' },
        {
          pattern: /^[A-Za-z][A-Za-z0-9_-]*$/,
          message: '编码须以字母开头，仅支持字母、数字、横线和下划线',
          trigger: 'blur'
        }
      ],
      categoryName: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
      status: [{ required: true, message: '请选择启用状态', trigger: 'change' }]
    }
  })

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const payload: SmisViolationCategorySavePayload = {
        id: form.model.id,
        parentId: form.model.parentId || null,
        categoryCode: form.model.categoryCode.trim().toUpperCase(),
        categoryName: form.model.categoryName.trim(),
        sort: Number(form.model.sort),
        status: form.model.status,
        description: normalizeNullableText(form.model.description)
      }
      await saveViolationCategory(payload)
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '违章类别保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: ViolationCategoryDialogOpenData): Promise<void> => {
    Object.assign(form.model, initial())
    categoryTree.value = data.tree
    if (data.row?.id) {
      const disabledIds = new Set(
        treeUtils
          .getDescendants(data.tree, data.row.id, true)
          .flatMap((item) => (item.id ? [item.id] : []))
      )
      categoryTree.value = treeUtils.removeNodesByCondition(data.tree, (item) =>
        Boolean(item.id && disabledIds.has(item.id))
      ).tree
      Object.assign(form.model, {
        id: data.row.id,
        parentId: data.row.parentId || undefined,
        categoryCode: data.row.categoryCode,
        categoryName: data.row.categoryName,
        sort: data.row.sort,
        status: data.row.status,
        description: data.row.description || ''
      })
    } else {
      form.model.parentId = data.presetParentId
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑违章分类' : '新增违章分类',
      subtitle: '维护分类层级、业务编码和启用状态',
      confirmText: '保存违章分类',
      onOpen: async (_openData, api) => {
        api.setLoading(true)
        try {
          await userStore.ensureDictLoaded('commonEnabledStatus')
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit
    })
  }

  defineExpose({ handleOpen })
</script>
