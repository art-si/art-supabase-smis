<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="material-category-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:node-tree" /></template>
        <strong>维护统一的物料分类口径</strong>
        <p>停用类别会保留现有层级和历史物料，但不能再用于新增物料。</p>
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
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useTenantScopeFormPolicy } from '@/hooks/core/useTenantScopeFormPolicy'
  import { useUserStore } from '@/store/modules/user'
  import TreeUtils from '@/utils/tree'
  import {
    saveMaterialCategory,
    type SmisMaterialCategory,
    type SmisMaterialCategorySavePayload,
    type SmisMaterialStatus
  } from '@smis/api'

  interface ParentTreeOption extends SmisMaterialCategory {
    categoryLabel: string
    disabled?: boolean
    children?: ParentTreeOption[]
  }
  export interface MaterialCategoryDialogOpenData {
    row?: SmisMaterialCategory
    tenantId: string
    allTenants: boolean
    tree: SmisMaterialCategory[]
    presetParentId?: string
  }
  interface MaterialCategoryForm {
    id?: string
    parentId?: string
    categoryCode: string
    categoryName: string
    sort: number
    status: SmisMaterialStatus
    description: string
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const { effectiveTenantId } = useTenantScopeFormPolicy()
  const dialogRef = ref<ArtDialogExpose<MaterialCategoryDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const sourceTree = ref<SmisMaterialCategory[]>([])
  const targetTenantId = ref(effectiveTenantId.value || '')
  const initialForm = (): MaterialCategoryForm => ({
    id: undefined,
    parentId: undefined,
    categoryCode: '',
    categoryName: '',
    sort: 10,
    status: 'enabled',
    description: ''
  })
  const formModel = reactive<MaterialCategoryForm>(initialForm())
  const statusOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.commonEnabledStatus ?? []).map(toDictionaryOption)
  )
  const parentOptions = computed<ParentTreeOption[]>(() => {
    const blockedIds = formModel.id
      ? treeUtils
          .getDescendants(sourceTree.value, formModel.id, true)
          .map((item) => item.id)
          .filter((id): id is string => Boolean(id))
      : []
    return treeUtils.mapTree(sourceTree.value as ParentTreeOption[], (item) => ({
      ...item,
      categoryLabel: `${item.categoryName} · ${item.categoryCode}${item.status === 'disabled' ? '（停用）' : ''}`,
      disabled: Boolean(item.id && blockedIds.includes(item.id))
    }))
  })
  const form = reactive<{
    model: MaterialCategoryForm
    items: ComputedRef<FormItem[]>
    rules: FormRules<MaterialCategoryForm>
  }>({
    model: formModel,
    items: computed(() => [
      {
        label: '物料类别编码',
        key: 'categoryCode',
        type: 'input',
        props: { maxlength: 40, clearable: true, placeholder: '如 HEAD_PROTECTION' }
      },
      {
        label: '物料类别名称',
        key: 'categoryName',
        type: 'input',
        props: { maxlength: 80, clearable: true, placeholder: '如 头部防护' }
      },
      {
        label: '上级物料类别',
        key: 'parentId',
        type: 'treeSelect',
        props: {
          data: parentOptions.value,
          clearable: true,
          checkStrictly: true,
          nodeKey: 'id',
          placeholder: '不选择表示一级类别',
          props: { label: 'categoryLabel', value: 'id', children: 'children', disabled: 'disabled' }
        }
      },
      {
        label: '显示顺序',
        key: 'sort',
        type: 'number',
        props: {
          min: 0,
          max: 999999,
          step: 1,
          precision: 0,
          controlsPosition: 'right',
          class: '!w-full'
        }
      },
      {
        label: '启用状态',
        key: 'status',
        type: 'select',
        options: statusOptions.value,
        props: { clearable: false, placeholder: '请选择启用状态' }
      },
      {
        label: '说明',
        key: 'description',
        type: 'input',
        span: 24,
        props: {
          type: 'textarea',
          rows: 4,
          maxlength: 500,
          showWordLimit: true,
          resize: 'none',
          placeholder: '补充类别适用范围或管理说明'
        }
      }
    ]),
    rules: {
      categoryCode: [
        { required: true, message: '请输入物料类别编码', trigger: 'blur' },
        {
          pattern: /^[A-Za-z][A-Za-z0-9_]*$/,
          message: '编码须以字母开头，仅支持字母、数字和下划线',
          trigger: 'blur'
        },
        { max: 40, message: '物料类别编码不能超过 40 个字符', trigger: 'blur' }
      ],
      categoryName: [
        { required: true, message: '请输入物料类别名称', trigger: 'blur' },
        { max: 80, message: '物料类别名称不能超过 80 个字符', trigger: 'blur' }
      ],
      sort: [{ required: true, message: '请输入显示顺序', trigger: 'change' }],
      status: [{ required: true, message: '请选择启用状态', trigger: 'change' }],
      description: [{ max: 500, message: '说明不能超过 500 个字符', trigger: 'blur' }]
    }
  })
  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, initialForm())
    sourceTree.value = []
    targetTenantId.value = effectiveTenantId.value || ''
    await nextTick()
    formRef.value?.clearValidate()
  }
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const payload: SmisMaterialCategorySavePayload = {
        id: form.model.id,
        parentId: form.model.parentId || null,
        categoryCode: form.model.categoryCode.trim().toUpperCase(),
        categoryName: form.model.categoryName.trim(),
        sort: Number(form.model.sort || 0),
        status: form.model.status,
        description: form.model.description.trim()
      }
      await saveMaterialCategory(payload)
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '防护用品类别保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: MaterialCategoryDialogOpenData): Promise<void> => {
    await resetForm()
    targetTenantId.value = data.row?.tenantId || data.tenantId || effectiveTenantId.value || ''
    sourceTree.value = data.allTenants
      ? data.tree.filter((item) => !item.tenantId || item.tenantId === targetTenantId.value)
      : data.tree
    if (data.row)
      Object.assign(form.model, {
        id: data.row.id,
        parentId: data.row.parentId || undefined,
        categoryCode: data.row.categoryCode,
        categoryName: data.row.categoryName,
        sort: data.row.sort,
        status: data.row.status,
        description: data.row.description || ''
      })
    else {
      form.model.parentId = data.presetParentId
      const siblings = treeUtils
        .treeToList(sourceTree.value)
        .filter((item) => (item.parentId || undefined) === data.presetParentId)
      form.model.sort = Math.max(0, ...siblings.map((item) => Number(item.sort || 0))) + 10
    }
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑物料类别' : '新增物料类别',
      subtitle: '维护类别编码、层级、显示顺序和启用状态',
      confirmText: '保存物料类别',
      contentMaxHeight: '72vh',
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
