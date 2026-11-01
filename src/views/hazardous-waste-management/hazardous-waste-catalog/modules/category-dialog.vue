<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="hazardous-category-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:node-tree" /></template>
        <strong>维护危废分类口径</strong><p>分类停用后保留历史关联，但不可再用于新增危废名录。</p>
      </ArtEntitySummary>
      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="24"
        label-position="top"
      >
        <template #presentation>
          <DisplayStyleField
            v-model:text-color="form.model.textColor"
            v-model:tag-style="form.model.tagStyle"
            :options="tagStyleOptions"
            :preview-text="form.model.categoryName || '分类预览'"
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
  import DisplayStyleField from '../../shared/display-style-field.vue'
  import {
    saveHazardousWasteCategory,
    type SmisHazardousWasteCategory,
    type SmisHazardousWasteCategorySavePayload
  } from '@smis/api'
  export interface CategoryDialogOpenData {
    row?: SmisHazardousWasteCategory
    tree: SmisHazardousWasteCategory[]
    presetParentId?: string
  }
  interface FormModel extends SmisHazardousWasteCategorySavePayload {
    presentation?: undefined
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }
  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<CategoryDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const sourceTree = ref<SmisHazardousWasteCategory[]>([])
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const initial = (): FormModel => ({
    id: undefined,
    categoryCode: '',
    categoryName: '',
    parentId: null,
    sort: 10,
    textColor: null,
    tagStyle: '',
    status: 'enabled',
    description: '',
    presentation: undefined
  })
  const model = reactive<FormModel>(initial())
  const statusOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.commonEnabledDisabledStatus ?? []).map(toDictionaryOption)
  )
  const tagStyleOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.smisTagStyle ?? []).map(toDictionaryOption)
  )
  const parentOptions = computed(() => {
    const blocked = model.id
      ? treeUtils.getDescendants(sourceTree.value, model.id, true).map((item) => item.id)
      : []
    return treeUtils.mapTree(sourceTree.value, (item) => ({
      ...item,
      categoryLabel: `${item.categoryName} · ${item.categoryCode}`,
      disabled: blocked.includes(item.id)
    }))
  })
  const form = reactive<{
    model: FormModel
    items: ComputedRef<FormItem[]>
    rules: FormRules<FormModel>
  }>({
    model,
    items: computed(() => [
      {
        label: '分类编码',
        key: 'categoryCode',
        type: 'input',
        props: { maxlength: 40, clearable: true, placeholder: '如 HW01' }
      },
      {
        label: '分类名称',
        key: 'categoryName',
        type: 'input',
        props: { maxlength: 100, clearable: true, placeholder: '如 废矿物油' }
      },
      {
        label: '上级分类',
        key: 'parentId',
        type: 'treeSelect',
        props: {
          data: parentOptions.value,
          clearable: true,
          checkStrictly: true,
          nodeKey: 'id',
          placeholder: '不选择表示一级分类',
          props: { label: 'categoryLabel', value: 'id', children: 'children', disabled: 'disabled' }
        }
      },
      {
        label: '显示顺序',
        key: 'sort',
        type: 'number',
        props: { min: 0, max: 999999, precision: 0, controlsPosition: 'right', class: '!w-full' }
      },
      { label: '启用状态', key: 'status', type: 'select', options: statusOptions.value },
      { label: '显示效果', key: 'presentation', type: 'input', span: 24 },
      {
        label: '分类说明',
        key: 'description',
        type: 'input',
        span: 24,
        props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true, resize: 'none' }
      }
    ]),
    rules: {
      categoryCode: [{ required: true, message: '请输入分类编码', trigger: 'blur' }],
      categoryName: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
      sort: [{ required: true, message: '请输入显示顺序', trigger: 'change' }],
      status: [{ required: true, message: '请选择启用状态', trigger: 'change' }]
    }
  })
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const { presentation: _presentation, ...payload } = toRaw(model)
      void _presentation
      await saveHazardousWasteCategory({
        ...payload,
        parentId: payload.parentId || null,
        categoryCode: payload.categoryCode.trim().toUpperCase(),
        categoryName: payload.categoryName.trim(),
        description: normalizeNullableText(payload.description)
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '危废类别保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: CategoryDialogOpenData): Promise<void> => {
    Object.assign(model, initial())
    sourceTree.value = data.tree
    if (data.row) Object.assign(model, data.row)
    else model.parentId = data.presetParentId || null
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑危废分类' : '新增危废分类',
      subtitle: '维护分类层级、标识与显示效果',
      confirmText: '保存分类',
      onOpen: async (_data, api) => {
        api.setLoading(true)
        try {
          await Promise.all([
            userStore.ensureDictLoaded('commonEnabledDisabledStatus'),
            userStore.ensureDictLoaded('smisTagStyle')
          ])
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit
    })
  }
  defineExpose({ handleOpen })
</script>
