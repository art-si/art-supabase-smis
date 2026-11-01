<template>
  <ArtDialog ref="dialogRef" size="md">
    <div class="qualification-catalog-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:node-tree" /></template>
        <strong>维护{{ config.title }}层级</strong>
        <p>
          {{
            isPermittedOperationItem
              ? '准操项目按作业类别归集，并可在类别内继续维护上下级。'
              : '编码用于业务联动；停用节点保留历史引用，不再用于新增证件。'
          }}
        </p>
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
    saveQualificationCatalog,
    type SmisQualificationCatalog,
    type SmisQualificationCatalogSavePayload,
    type SmisQualificationMaintenanceCatalogType,
    type SmisQualificationStatus
  } from '@smis/api'
  import { qualificationCatalogConfig } from './qualification-catalog-meta'

  export interface QualificationCatalogDialogOpenData {
    catalogType: SmisQualificationMaintenanceCatalogType
    row?: SmisQualificationCatalog
    tree: SmisQualificationCatalog[]
    workCategories: SmisQualificationCatalog[]
    presetParentId?: string
    presetWorkCategoryId?: string
  }

  interface FormModel {
    id?: string
    parentId?: string
    workCategoryId?: string
    itemCode: string
    itemName: string
    sort: number
    status: SmisQualificationStatus
    remark: string
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const dialogRef = ref<ArtDialogExpose<QualificationCatalogDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const catalogType = ref<SmisQualificationMaintenanceCatalogType>('work_item')
  const sourceTree = shallowRef<SmisQualificationCatalog[]>([])
  const workCategories = shallowRef<SmisQualificationCatalog[]>([])
  const config = computed(() => qualificationCatalogConfig[catalogType.value])
  const isPermittedOperationItem = computed(() => catalogType.value === 'permitted_operation_item')
  const initial = (): FormModel => ({
    id: undefined,
    parentId: undefined,
    workCategoryId: undefined,
    itemCode: '',
    itemName: '',
    sort: 10,
    status: 'enabled',
    remark: ''
  })
  const formModel = reactive<FormModel>(initial())
  const statusOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.commonEnabledStatus ?? []).map(toDictionaryOption)
  )
  const parentTree = computed(() =>
    isPermittedOperationItem.value
      ? treeUtils.removeNodesByCondition(
          sourceTree.value,
          (item) => item.workCategoryId !== formModel.workCategoryId
        ).tree
      : sourceTree.value
  )
  const form = reactive<{
    model: FormModel
    items: ComputedRef<FormItem[]>
    rules: FormRules<FormModel>
  }>({
    model: formModel,
    items: computed(() => [
      ...(isPermittedOperationItem.value
        ? [
            {
              label: '作业类别',
              key: 'workCategoryId',
              type: 'treeSelect',
              span: 24,
              props: {
                data: workCategories.value,
                nodeKey: 'id',
                checkStrictly: true,
                clearable: true,
                defaultExpandAll: true,
                props: { label: 'itemName', value: 'id', children: 'children' },
                placeholder: '请选择准操项目所属作业类别'
              }
            } as FormItem
          ]
        : []),
      {
        label: `上级${config.value.title}`,
        key: 'parentId',
        type: 'treeSelect',
        span: 24,
        props: {
          data: parentTree.value,
          nodeKey: 'id',
          checkStrictly: true,
          clearable: true,
          defaultExpandAll: true,
          props: { label: 'itemName', value: 'id', children: 'children' },
          placeholder: isPermittedOperationItem.value
            ? '不选择则创建该类别下的一级项目'
            : '不选择则创建一级节点'
        }
      },
      {
        label: `${config.value.title}${isPermittedOperationItem.value ? '代号' : '编码'}`,
        key: 'itemCode',
        type: 'input',
        props: { maxlength: 50, clearable: true, placeholder: config.value.codePlaceholder }
      },
      {
        label: `${config.value.title}名称`,
        key: 'itemName',
        type: 'input',
        props: { maxlength: 120, clearable: true, placeholder: config.value.namePlaceholder }
      },
      {
        label: '显示顺序',
        key: 'sort',
        type: 'number',
        props: { min: 0, max: 999999, precision: 0, controlsPosition: 'right', class: '!w-full' }
      },
      { label: '启用状态', key: 'status', type: 'segment', options: statusOptions.value },
      {
        label: '备注',
        key: 'remark',
        type: 'textarea',
        span: 24,
        props: {
          rows: 4,
          maxlength: 1000,
          showWordLimit: true,
          resize: 'none',
          placeholder: `补充${config.value.title}适用范围或管理说明`
        }
      }
    ]),
    rules: {
      workCategoryId: [{ required: true, message: '请选择作业类别', trigger: 'change' }],
      itemCode: [
        {
          required: true,
          message: '请输入代号或编码',
          trigger: 'blur'
        }
      ],
      itemName: [{ required: true, message: '请输入名称', trigger: 'blur' }],
      status: [{ required: true, message: '请选择启用状态', trigger: 'change' }]
    }
  })

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const payload: SmisQualificationCatalogSavePayload = {
        id: form.model.id,
        catalogType: catalogType.value,
        parentId: form.model.parentId || null,
        workCategoryId: isPermittedOperationItem.value ? form.model.workCategoryId || null : null,
        itemCode: form.model.itemCode.trim().toUpperCase(),
        itemName: form.model.itemName.trim(),
        sort: Number(form.model.sort),
        status: form.model.status,
        remark: normalizeNullableText(form.model.remark)
      }
      await saveQualificationCatalog(payload)
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '安全资质目录保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: QualificationCatalogDialogOpenData): Promise<void> => {
    catalogType.value = data.catalogType
    Object.assign(form.model, initial())
    sourceTree.value = data.tree
    workCategories.value = data.workCategories
    if (data.row) {
      const blocked = new Set(
        treeUtils.getDescendants(data.tree, data.row.id, true).map((item) => item.id)
      )
      sourceTree.value = treeUtils.removeNodesByCondition(data.tree, (item) =>
        blocked.has(item.id)
      ).tree
      Object.assign(form.model, {
        id: data.row.id,
        parentId: data.row.parentId || undefined,
        workCategoryId: data.row.workCategoryId || undefined,
        itemCode: data.row.itemCode,
        itemName: data.row.itemName,
        sort: data.row.sort,
        status: data.row.status,
        remark: data.row.remark || ''
      })
    } else {
      form.model.workCategoryId = data.presetWorkCategoryId
      form.model.parentId = data.presetParentId
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? `编辑${config.value.title}` : `新增${config.value.title}`,
      subtitle: '维护业务编码、树形层级、启用状态和备注',
      confirmText: `保存${config.value.title}`,
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
  watch(
    () => form.model.workCategoryId,
    (workCategoryId) => {
      if (!isPermittedOperationItem.value || !form.model.parentId) return
      const parent = treeUtils.findNode(sourceTree.value, form.model.parentId)
      if (parent?.workCategoryId !== workCategoryId) form.model.parentId = undefined
    }
  )
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss"></style>
