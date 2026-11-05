<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="equipment-category-dialog">
      <ArtEntitySummary
        class="equipment-category-dialog__context"
        icon="ri:node-tree"
        title="共享设备台账分类口径"
        description="分类按租户隔离；停用后保留历史层级与检验规则，但不再用于新增设备。"
        compact
      />

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
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import { useTenantScopeFormPolicy } from '@/hooks/core/useTenantScopeFormPolicy'
  import { useUserStore } from '@/store/modules/user'
  import TreeUtils from '@/utils/tree'
  import { EQUIPMENT_PROFILE_OPTIONS } from '@smis/domain/equipment-profile'
  import {
    saveEquipmentCategory,
    type SmisEquipmentCategory,
    type SmisEquipmentCategorySavePayload,
    type SmisEquipmentCategoryStatus,
    type SmisEquipmentInspectionCategory
  } from '@smis/api'

  interface ParentTreeOption extends SmisEquipmentCategory {
    categoryLabel: string
    disabled?: boolean
    children?: ParentTreeOption[]
  }

  export interface EquipmentCategoryDialogOpenData {
    row?: SmisEquipmentCategory
    tenantId: string
    allTenants: boolean
    tree: SmisEquipmentCategory[]
    inspectionOptions: SmisEquipmentInspectionCategory[]
    presetParentId?: string
  }

  interface EquipmentCategoryForm {
    id?: string
    parentId?: string
    categoryCode: string
    categoryName: string
    categoryShortName: string
    profileType: SmisEquipmentCategory['profileType']
    inspectionCategoryIds: string[]
    remark: string
    status: SmisEquipmentCategoryStatus
    sort: number
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const { defaultWriteTenantId } = useTenantScopeFormPolicy()
  const dialogRef = ref<ArtDialogExpose<EquipmentCategoryDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const treeUtils = new TreeUtils({
    idKey: 'id',
    parentKey: 'parentId',
    childrenKey: 'children'
  })

  const source = reactive<{
    tree: SmisEquipmentCategory[]
    inspectionOptions: SmisEquipmentInspectionCategory[]
  }>({ tree: [], inspectionOptions: [] })
  const targetTenantId = ref(defaultWriteTenantId.value || '')

  const initialForm = (): EquipmentCategoryForm => ({
    id: undefined,
    parentId: undefined,
    categoryCode: '',
    categoryName: '',
    categoryShortName: '',
    profileType: 'general',
    inspectionCategoryIds: [],
    remark: '',
    status: 'enabled',
    sort: 10
  })
  const formModel = reactive<EquipmentCategoryForm>(initialForm())

  const form = reactive<{
    model: EquipmentCategoryForm
    items: ComputedRef<FormItem[]>
    rules: FormRules<EquipmentCategoryForm>
  }>({
    model: formModel,
    items: computed(() => [
      {
        label: '设备分类编码',
        key: 'categoryCode',
        type: 'input',
        props: {
          maxlength: 40,
          clearable: true,
          placeholder: '如 PRESSURE_VESSEL'
        }
      },
      {
        label: '设备分类名称',
        key: 'categoryName',
        type: 'input',
        props: {
          maxlength: 80,
          clearable: true,
          placeholder: '如 压力容器'
        }
      },
      {
        label: '设备分类简称',
        key: 'categoryShortName',
        type: 'input',
        props: {
          maxlength: 40,
          clearable: true,
          placeholder: '用于紧凑列表或标签展示'
        }
      },
      {
        label: '上级设备分类',
        key: 'parentId',
        type: 'treeSelect',
        props: {
          data: parentOptions.value,
          clearable: true,
          checkStrictly: true,
          nodeKey: 'id',
          placeholder: '不选择表示一级分类',
          props: {
            label: 'categoryLabel',
            value: 'id',
            children: 'children',
            disabled: 'disabled'
          }
        }
      },
      {
        label: '设备档案模板',
        key: 'profileType',
        type: 'select',
        options: EQUIPMENT_PROFILE_OPTIONS,
        description: '设备选中本分类后，新增/编辑页自动加载对应专用字段',
        props: { clearable: false, placeholder: '选择设备档案模板' }
      },
      {
        label: '适用检验类别',
        key: 'inspectionCategoryIds',
        type: 'select',
        span: 24,
        options: inspectionOptions.value,
        props: {
          multiple: true,
          filterable: true,
          clearable: true,
          collapseTags: true,
          collapseTagsTooltip: true,
          maxCollapseTags: 3,
          placeholder: '可选择外部检验、内部检验、年度检验等多个规则'
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
        label: '排序',
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
        label: '备注',
        key: 'remark',
        type: 'input',
        span: 24,
        props: {
          type: 'textarea',
          rows: 4,
          maxlength: 500,
          showWordLimit: true,
          resize: 'none',
          placeholder: '可补充分类适用范围、管理要求或设备示例'
        }
      }
    ]),
    rules: {
      categoryCode: [
        { required: true, message: '请输入设备分类编码', trigger: 'blur' },
        {
          pattern: /^[A-Za-z][A-Za-z0-9_]*$/,
          message: '编码须以字母开头，仅支持字母、数字和下划线',
          trigger: 'blur'
        },
        { max: 40, message: '设备分类编码不能超过 40 个字符', trigger: 'blur' }
      ],
      categoryName: [
        { required: true, message: '请输入设备分类名称', trigger: 'blur' },
        { max: 80, message: '设备分类名称不能超过 80 个字符', trigger: 'blur' }
      ],
      categoryShortName: [{ max: 40, message: '设备分类简称不能超过 40 个字符', trigger: 'blur' }],
      status: [{ required: true, message: '请选择启用状态', trigger: 'change' }],
      profileType: [{ required: true, message: '请选择设备档案模板', trigger: 'change' }],
      sort: [{ required: true, message: '请输入排序', trigger: 'change' }],
      remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }]
    }
  })

  const statusOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.commonEnabledStatus ?? []).map(toDictionaryOption)
  )

  const parentOptions = computed<ParentTreeOption[]>(() => {
    const blockedIds: string[] = formModel.id
      ? treeUtils
          .getDescendants(source.tree, formModel.id, true)
          .map((item) => item.id)
          .filter((id): id is string => Boolean(id))
      : []

    return treeUtils.mapTree(source.tree as ParentTreeOption[], (item) => ({
      ...item,
      categoryLabel: `${item.categoryName} · ${item.categoryCode}${
        item.status === 'disabled' ? '（停用）' : ''
      }`,
      disabled: Boolean(item.id && blockedIds.includes(item.id))
    }))
  })

  const inspectionOptions = computed<FormItemOption[]>(() => {
    const selectedIds: string[] = formModel.inspectionCategoryIds
    return source.inspectionOptions
      .filter((item) => item.status === 'enabled' || selectedIds.includes(item.id))
      .map((item) => ({
        label: `${item.categoryName} · ${item.categoryCode}${
          item.status === 'disabled' ? '（已停用）' : ''
        }`,
        value: item.id
      }))
  })

  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, initialForm())
    targetTenantId.value = defaultWriteTenantId.value || ''
    Object.assign(source, { tree: [], inspectionOptions: [] })
    await nextTick()
    formRef.value?.clearValidate()
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const payload: SmisEquipmentCategorySavePayload = {
        id: form.model.id,
        parentId: form.model.parentId || null,
        categoryCode: form.model.categoryCode.trim().toUpperCase(),
        categoryName: form.model.categoryName.trim(),
        categoryShortName: form.model.categoryShortName.trim(),
        profileType: form.model.profileType,
        inspectionCategoryIds: [...form.model.inspectionCategoryIds],
        remark: form.model.remark.trim(),
        status: form.model.status,
        sort: Number(form.model.sort || 0)
      }
      await saveEquipmentCategory(payload)
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '设备类别保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: EquipmentCategoryDialogOpenData): Promise<void> => {
    await resetForm()
    targetTenantId.value = data.row?.tenantId || data.tenantId || defaultWriteTenantId.value || ''
    Object.assign(source, {
      tree: data.allTenants
        ? data.tree.filter((item) => !item.tenantId || item.tenantId === targetTenantId.value)
        : data.tree,
      inspectionOptions: data.allTenants
        ? data.inspectionOptions.filter(
            (item) => !item.tenantId || item.tenantId === targetTenantId.value
          )
        : data.inspectionOptions
    })

    if (data.row) {
      Object.assign(form.model, {
        id: data.row.id,
        parentId: data.row.parentId || undefined,
        categoryCode: data.row.categoryCode,
        categoryName: data.row.categoryName,
        categoryShortName: data.row.categoryShortName || '',
        profileType: data.row.profileType || 'general',
        inspectionCategoryIds: data.row.inspectionCategories.map((item) => item.id),
        remark: data.row.remark || '',
        status: data.row.status,
        sort: data.row.sort ?? 0
      })
    } else {
      form.model.parentId = data.presetParentId
      const siblings = treeUtils
        .treeToList(source.tree)
        .filter((item) => (item.parentId || undefined) === data.presetParentId)
      form.model.sort = Math.max(0, ...siblings.map((item) => Number(item.sort || 0))) + 10
    }

    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑设备分类' : '新增设备分类',
      subtitle: '维护设备分类层级、基本信息与适用检验规则',
      confirmText: '保存设备分类',
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

<style scoped lang="scss">
  .equipment-category-dialog {
    &__context {
      margin-bottom: 18px;
    }
  }
</style>
