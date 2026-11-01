<template>
  <ArtDialog ref="dialogRef" size="md">
    <div class="hazard-factor-category-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:shield-check-line" /></template>
        <strong>{{ targetTenantName }} · 风险辨识基础口径</strong>
        <p>因素类型用于一级分组，类别用于具体风险项；禁用后保留历史数据。</p>
      </ArtEntitySummary>

      <div class="hazard-factor-category-dialog__preview" aria-live="polite">
        <span class="hazard-factor-category-dialog__preview-label">标签预览</span>
        <ArtDictDisplay
          v-if="form.model.factorType"
          dict-code="smisHazardFactorType"
          :value="form.model.factorType"
          display="tag"
        />
        <ElTag v-if="form.model.tagStyle" :type="form.model.tagStyle">
          {{ previewName }}
        </ElTag>
        <span
          v-else
          class="hazard-factor-category-dialog__plain-preview"
          :style="{ color: form.model.textColor || undefined }"
        >
          <i :style="{ backgroundColor: form.model.textColor || 'var(--el-color-info)' }" />
          {{ previewName }}
        </span>
        <small>标签样式用于统一业务状态呈现；文字颜色用于列表与看板中的辅助识别。</small>
      </div>

      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="24"
        label-position="top"
      >
      </ArtForm>
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
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import {
    saveHazardFactorCategory,
    type SmisHazardFactorCategory,
    type SmisHazardFactorCategorySavePayload,
    type SmisHazardFactorCategoryStatus,
    type SmisHazardFactorCategoryTagStyle,
    type SmisHazardFactorType
  } from '@smis/api'

  export interface HazardFactorCategoryDialogOpenData {
    row?: SmisHazardFactorCategory
    tenantId?: string | null
    tenantName: string
  }

  interface HazardFactorCategoryForm {
    id?: string
    tenantId: string
    factorType: SmisHazardFactorType | ''
    categoryCode: string
    categoryName: string
    sort: number
    textColor: string
    tagStyle: SmisHazardFactorCategoryTagStyle
    status: SmisHazardFactorCategoryStatus
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const presetColors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399']
  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const tenantScopeStore = useTenantScopeStore()
  const { getDictMap, isPlatformSuper } = storeToRefs(userStore)
  const { tenantOptions } = storeToRefs(tenantScopeStore)
  const dialogRef = ref<ArtDialogExpose<HazardFactorCategoryDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const fallbackTenantName = ref('当前租户')
  const isCreating = ref(true)

  const initialForm = (): HazardFactorCategoryForm => ({
    id: undefined,
    tenantId: '',
    factorType: '',
    categoryCode: '',
    categoryName: '',
    sort: 1,
    textColor: '',
    tagStyle: 'primary',
    status: 'enabled'
  })

  const statusOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.commonEnabledDisabledStatus ?? []).map(toDictionaryOption)
  )

  const factorTypeOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.smisHazardFactorType ?? []).map(toDictionaryOption)
  )

  const tagStyleOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.smisTagStyle ?? []).map(toDictionaryOption)
  )

  const form = reactive<{
    model: HazardFactorCategoryForm
    items: ComputedRef<FormItem[]>
    rules: FormRules<HazardFactorCategoryForm>
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
        label: '因素类型',
        key: 'factorType',
        type: 'select',
        options: factorTypeOptions.value,
        props: { clearable: false, placeholder: '请选择人的、物的、环境或管理因素' }
      },
      {
        label: '危害因素类别编号',
        key: 'categoryCode',
        type: 'input',
        props: { maxlength: 20, clearable: true, placeholder: '如 1、HF-001' }
      },
      {
        label: '危害因素类别',
        key: 'categoryName',
        type: 'input',
        span: 24,
        props: { maxlength: 200, clearable: true, placeholder: '请输入具体危害因素类别' }
      },
      {
        label: '排序',
        key: 'sort',
        type: 'number',
        help: '数值越小，在风险辨识选项中越靠前',
        props: { min: 0, max: 9999, controlsPosition: 'right', placeholder: '请输入排序' }
      },
      {
        label: '状态',
        key: 'status',
        type: 'segment',
        options: statusOptions.value
      },
      {
        label: '文字颜色',
        key: 'textColor',
        type: 'colorPicker',
        get description(): string {
          return form.model.textColor?.toUpperCase() || '未设置颜色'
        },
        props: { predefine: presetColors }
      },
      {
        label: '标签样式',
        key: 'tagStyle',
        type: 'tagStyleSelect',
        options: tagStyleOptions.value,
        props: { clearable: false, placeholder: '请选择标签样式' }
      }
    ]),
    rules: {
      tenantId: [{ required: true, message: '请选择所属租户', trigger: 'change' }],
      factorType: [{ required: true, message: '请选择因素类型', trigger: 'change' }],
      categoryCode: [
        { required: true, message: '请输入危害因素类别编号', trigger: 'blur' },
        {
          pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/,
          message: '编号仅支持字母、数字、连字符和下划线，且不能以符号开头',
          trigger: 'blur'
        }
      ],
      categoryName: [
        { required: true, message: '请输入危害因素类别', trigger: 'blur' },
        { max: 200, message: '危害因素类别不能超过 200 个字符', trigger: 'blur' }
      ],
      sort: [{ required: true, message: '请输入排序', trigger: 'change' }],
      textColor: [
        {
          pattern: /^(#[0-9A-Fa-f]{6})?$/,
          message: '文字颜色须为 6 位十六进制颜色值',
          trigger: 'change'
        }
      ],
      tagStyle: [{ required: true, message: '请选择标签样式', trigger: 'change' }],
      status: [{ required: true, message: '请选择状态', trigger: 'change' }]
    }
  })

  const previewName = computed(() => form.model.categoryName.trim() || '危害因素类别预览')
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
      const factorType = form.model.factorType
      if (!factorType) return false
      const payload: SmisHazardFactorCategorySavePayload = {
        id: form.model.id,
        tenantId: form.model.tenantId,
        factorType,
        categoryCode: form.model.categoryCode.trim().toUpperCase(),
        categoryName: form.model.categoryName.trim(),
        sort: form.model.sort,
        textColor: form.model.textColor || null,
        tagStyle: form.model.tagStyle,
        status: form.model.status
      }
      await saveHazardFactorCategory(payload)
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '危害因素分类保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: HazardFactorCategoryDialogOpenData): Promise<void> => {
    await resetForm()
    fallbackTenantName.value = data.tenantName
    form.model.tenantId = data.tenantId || ''
    if (data.row) {
      isCreating.value = false
      Object.assign(form.model, {
        id: data.row.id,
        tenantId: data.row.tenantId,
        factorType: data.row.factorType,
        categoryCode: data.row.categoryCode,
        categoryName: data.row.categoryName,
        sort: data.row.sort,
        textColor: data.row.textColor || '',
        tagStyle: data.row.tagStyle,
        status: data.row.status
      })
    }

    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑危害因素类别' : '新增危害因素类别',
      subtitle: '选择因素类型，并维护具体类别、排序、视觉标识与启停状态',
      confirmText: '保存危害因素类别',
      onOpen: async (_openData, api) => {
        api.setLoading(true)
        try {
          await Promise.all([
            userStore.ensureDictLoaded('commonEnabledDisabledStatus'),
            userStore.ensureDictLoaded('smisHazardFactorType'),
            userStore.ensureDictLoaded('smisTagStyle'),
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
  .hazard-factor-category-dialog {
    &__preview {
      display: flex;
      gap: 10px;
      align-items: center;
      min-width: 0;
      padding: 10px 14px;
      margin-bottom: 18px;
      background: var(--art-gray-100);
      border-radius: var(--el-border-radius-base);

      small {
        min-width: 0;
        margin-left: auto;
        color: var(--el-text-color-secondary);
      }
    }

    &__preview-label {
      flex: 0 0 auto;
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-secondary);
    }

    &__plain-preview,
    &__color-field {
      display: inline-flex;
      gap: 8px;
      align-items: center;
    }

    &__plain-preview {
      min-width: 0;
      font-weight: 600;

      i {
        flex: 0 0 auto;
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
    }

    &__color-field {
      min-height: 32px;

      span {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    @media only screen and (width <= 720px) {
      &__preview {
        flex-wrap: wrap;

        small {
          flex-basis: 100%;
          margin-left: 0;
        }
      }
    }
  }
</style>
