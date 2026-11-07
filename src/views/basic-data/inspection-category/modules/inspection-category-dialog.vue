<template>
  <ArtDialog ref="dialogRef" size="md" :confirm-disabled="!formRef?.readyToSubmit">
    <div class="inspection-category-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:filter-3-line" /></template>
        <strong>{{ targetTenantName }} · 租户专属分类口径</strong>
        <p>编码用于系统识别，名称面向业务人员；停用后保留历史数据但不再用于新业务。</p>
      </ArtEntitySummary>

      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="isNarrow ? 24 : 12"
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
  import { useMediaQuery } from '@vueuse/core'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import {
    saveInspectionCategory,
    type SmisInspectionCategory,
    type SmisInspectionCategorySavePayload,
    type SmisInspectionCategoryStatus
  } from '@smis/api'

  export interface InspectionCategoryDialogOpenData {
    row?: SmisInspectionCategory
    tenantId?: string | null
    tenantName: string
  }

  interface InspectionCategoryForm {
    id?: string
    tenantId: string
    categoryCode: string
    categoryName: string
    remark: string
    status: SmisInspectionCategoryStatus
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const tenantScopeStore = useTenantScopeStore()
  const { getDictMap, isPlatformSuper } = storeToRefs(userStore)
  const { tenantOptions } = storeToRefs(tenantScopeStore)
  const dialogRef = ref<ArtDialogExpose<InspectionCategoryDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const isNarrow = useMediaQuery('(max-width: 520px)')
  const fallbackTenantName = ref('当前租户')
  const isCreating = ref(true)

  const initialForm = (): InspectionCategoryForm => ({
    id: undefined,
    tenantId: '',
    categoryCode: '',
    categoryName: '',
    remark: '',
    status: 'enabled'
  })

  const statusOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.commonEnabledStatus ?? []).map(toDictionaryOption)
  )

  const form = reactive<{
    model: InspectionCategoryForm
    items: ComputedRef<FormItem[]>
    rules: FormRules<InspectionCategoryForm>
  }>({
    model: initialForm(),
    items: computed(() => [
      ...(isPlatformSuper.value && isCreating.value
        ? [
            {
              label: '所属租户',
              key: 'tenantId',
              type: 'select' as const,
              options: tenantOptions.value.map((tenant) => ({
                label: `${tenant.tenantName}（${tenant.tenantCode}）`,
                value: tenant.id
              })),
              props: {
                clearable: false,
                filterable: true,
                placeholder: '请选择新增记录所属租户'
              },
              span: 24
            }
          ]
        : []),
      {
        label: '检验类别编码',
        key: 'categoryCode',
        type: 'input',
        props: {
          maxlength: 40,
          clearable: true,
          placeholder: '如 EXTERNAL'
        }
      },
      {
        label: '检验类别名称',
        key: 'categoryName',
        type: 'input',
        props: {
          maxlength: 80,
          clearable: true,
          placeholder: '如 外部检验'
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
          placeholder: '可补充适用范围、执行主体或使用说明'
        }
      }
    ]),
    rules: {
      tenantId: [{ required: true, message: '请选择所属租户', trigger: 'change' }],
      categoryCode: [
        { required: true, message: '请输入检验类别编码', trigger: 'blur' },
        {
          pattern: /^[A-Za-z][A-Za-z0-9_]*$/,
          message: '编码须以字母开头，仅支持字母、数字和下划线',
          trigger: 'blur'
        },
        { max: 40, message: '检验类别编码不能超过 40 个字符', trigger: 'blur' }
      ],
      categoryName: [
        { required: true, message: '请输入检验类别名称', trigger: 'blur' },
        { max: 80, message: '检验类别名称不能超过 80 个字符', trigger: 'blur' }
      ],
      status: [{ required: true, message: '请选择启用状态', trigger: 'change' }],
      remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }]
    }
  })

  const targetTenantName = computed(
    () =>
      tenantOptions.value.find((tenant) => tenant.id === form.model.tenantId)?.tenantName ||
      fallbackTenantName.value
  )

  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, initialForm())
    isCreating.value = true
    await nextTick()
    formRef.value?.clearValidate()
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '检验类别校验失败，请重试')
      return false
    }
    const payload: SmisInspectionCategorySavePayload = {
      id: form.model.id,
      tenantId: form.model.tenantId,
      categoryCode: form.model.categoryCode.trim().toUpperCase(),
      categoryName: form.model.categoryName.trim(),
      remark: form.model.remark.trim(),
      status: form.model.status
    }
    try {
      await saveInspectionCategory(payload)
    } catch (error) {
      notifyFriendlyError(error, '检验类别保存失败，请检查内容后重试')
      return false
    }
    emit('success', form.model.id ? 'edit' : 'add')
    return true
  }

  const handleOpen = async (data: InspectionCategoryDialogOpenData): Promise<void> => {
    await resetForm()
    fallbackTenantName.value = data.tenantName
    form.model.tenantId = data.tenantId || ''
    if (data.row) {
      isCreating.value = false
      Object.assign(form.model, {
        id: data.row.id,
        tenantId: data.row.tenantId,
        categoryCode: data.row.categoryCode,
        categoryName: data.row.categoryName,
        remark: data.row.remark || '',
        status: data.row.status
      })
    }

    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑检验类别' : '新增检验类别',
      subtitle: '维护类别编码、名称、备注与启用状态',
      confirmText: '保存检验类别',
      onOpen: async (_openData, api) => {
        api.setLoading(true)
        try {
          await Promise.all([
            userStore.ensureDictLoaded('commonEnabledStatus'),
            isPlatformSuper.value ? tenantScopeStore.loadTenantOptions() : Promise.resolve()
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

<style scoped lang="scss">
  @media (width <= 520px) {
    .inspection-category-dialog :deep(.art-entity-summary__content strong) {
      overflow: visible;
      text-overflow: clip;
      overflow-wrap: anywhere;
      white-space: normal;
    }
  }
</style>
