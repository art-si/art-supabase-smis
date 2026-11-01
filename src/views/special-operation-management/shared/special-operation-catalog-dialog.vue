<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="special-operation-catalog-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon :icon="contextIcon" /></template>
        <strong>{{ targetTenantName }} · {{ title }}</strong>
        <p>{{ contextDescription }}</p>
      </ArtEntitySummary>

      <div class="special-operation-catalog-dialog__preview" aria-live="polite">
        <span>显示预览</span>
        <ElTag v-if="form.model.tagStyle" :type="form.model.tagStyle">
          {{ previewName }}
        </ElTag>
        <strong v-else :style="{ color: form.model.textColor || undefined }">
          <i :style="{ backgroundColor: form.model.textColor || 'var(--theme-color)' }" />
          {{ previewName }}
        </strong>
        <small>颜色和标签样式用于列表快速辨识，状态仍会同时显示文字。</small>
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
        <template #textColor>
          <div class="special-operation-catalog-dialog__color-field">
            <ElColorPicker v-model="form.model.textColor" :predefine="presetColors" />
            <span>{{ form.model.textColor?.toUpperCase() || '未设置颜色' }}</span>
          </div>
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
  import {
    saveSpecialOperationCatalogItem,
    type SmisSpecialOperationCatalogItem,
    type SmisSpecialOperationCatalogKind,
    type SmisSpecialOperationCatalogSavePayload,
    type SmisSpecialOperationEditableStatus,
    type SmisSpecialOperationRecordType,
    type SmisSpecialOperationTagStyle,
    type SmisSpecialOperationType
  } from '@smis/api'

  export interface SpecialOperationCatalogDialogOpenData {
    row?: SmisSpecialOperationCatalogItem
    operationTypes: SmisSpecialOperationType[]
    presetOperationTypeId?: string | null
    tenantId?: string | null
    tenantName: string
  }

  interface FormModel {
    id?: string
    operationTypeId: string
    itemName: string
    recordType: SmisSpecialOperationRecordType
    normalValue: string
    abnormalValue: string
    sort: number
    textColor: string
    tagStyle: SmisSpecialOperationTagStyle
    status: SmisSpecialOperationEditableStatus
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const props = defineProps<{
    catalogKind: SmisSpecialOperationCatalogKind
    title: string
    singular: string
    itemLabel: string
  }>()
  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<SpecialOperationCatalogDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const operationTypes = shallowRef<SmisSpecialOperationType[]>([])
  const targetTenantId = ref<string | null>()
  const targetTenantName = ref('当前租户')

  const createInitialModel = (): FormModel => ({
    id: undefined,
    operationTypeId: '',
    itemName: '',
    recordType: 'text',
    normalValue: '',
    abnormalValue: '',
    sort: 10,
    textColor: '',
    tagStyle: '',
    status: 'enabled'
  })
  const formModel = reactive<FormModel>(createInitialModel())
  const presetColors = ['#2563EB', '#0891B2', '#059669', '#D97706', '#DC2626', '#7C3AED']
  const isSiteAnalysis = computed(() => props.catalogKind === 'site_analysis')
  const previewName = computed(() => form.model.itemName.trim() || `示例${props.singular}`)
  const contextIcon = computed(() => {
    if (props.catalogKind === 'safety_checklist') return 'ri:shield-check-line'
    if (props.catalogKind === 'hazard_factor') return 'ri:alert-line'
    return 'ri:flask-line'
  })
  const contextDescription = computed(() => {
    if (props.catalogKind === 'safety_checklist')
      return '排查项按作业类型归集，禁用后不再用于新增作业票。'
    if (props.catalogKind === 'hazard_factor') return '危害因素用于作业前辨识，禁用后保留历史引用。'
    return '分析项可配置文本、数值或单选记录方式，并定义正常与异常判定值。'
  })

  const operationTypeOptions = computed<FormItemOption[]>(() =>
    operationTypes.value
      .filter((item) => item.status !== 'voided')
      .map((item) => ({
        label: `${item.typeName}（${item.typeCode}）${item.status === 'disabled' ? ' · 已禁用' : ''}`,
        value: item.id,
        disabled: item.status !== 'enabled'
      }))
  )
  const recordTypeOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.smisSpecialOperationRecordType ?? []).map(toDictionaryOption)
  )
  const statusOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.commonEnabledDisabledVoidedStatus ?? [])
      .filter((item) => item.value !== 'voided')
      .map(toDictionaryOption)
  )
  const tagStyleOptions = computed<FormItemOption[]>(() => [
    { label: '不使用标签', value: '' },
    ...(getDictMap.value.smisTagStyle ?? []).map(toDictionaryOption)
  ])

  const form = reactive<{
    model: FormModel
    items: ComputedRef<FormItem[]>
    rules: FormRules<FormModel>
  }>({
    model: formModel,
    items: computed(() => [
      {
        label: '作业类型',
        key: 'operationTypeId',
        type: 'select',
        span: 12,
        options: operationTypeOptions.value,
        props: { clearable: false, filterable: true, placeholder: '请选择作业类型' }
      },
      {
        label: props.itemLabel,
        key: 'itemName',
        type: 'input',
        span: 12,
        props: { maxlength: 200, clearable: true, placeholder: `请输入${props.itemLabel}` }
      },
      {
        label: '记录类型',
        key: 'recordType',
        type: 'select',
        span: 8,
        hidden: !isSiteAnalysis.value,
        options: recordTypeOptions.value,
        props: { clearable: false, placeholder: '请选择记录类型' }
      },
      {
        label: '正常值',
        key: 'normalValue',
        type: 'textarea',
        span: 8,
        hidden: !isSiteAnalysis.value,
        description: '单选类型可用逗号或换行分隔多个正常选项。',
        props: {
          rows: 3,
          maxlength: 500,
          showWordLimit: true,
          resize: 'none',
          placeholder: '输入正常范围或选项'
        }
      },
      {
        label: '异常值',
        key: 'abnormalValue',
        type: 'textarea',
        span: 8,
        hidden: !isSiteAnalysis.value,
        description: '用于明确触发异常处置的值或选项。',
        props: {
          rows: 3,
          maxlength: 500,
          showWordLimit: true,
          resize: 'none',
          placeholder: '输入异常范围或选项'
        }
      },
      {
        label: '显示顺序',
        key: 'sort',
        type: 'number',
        span: 8,
        props: { min: 0, max: 9999, precision: 0, controlsPosition: 'right', class: '!w-full' }
      },
      { label: '文字颜色', key: 'textColor', type: 'input', span: 8 },
      {
        label: '标签样式',
        key: 'tagStyle',
        type: 'tagStyleSelect',
        span: 8,
        options: tagStyleOptions.value,
        props: { clearable: false, placeholder: '请选择标签样式' }
      },
      {
        label: '启用状态',
        key: 'status',
        type: 'segment',
        span: 24,
        options: statusOptions.value
      }
    ]),
    rules: {
      operationTypeId: [{ required: true, message: '请选择作业类型', trigger: 'change' }],
      itemName: [{ required: true, message: `请输入${props.itemLabel}`, trigger: 'blur' }],
      recordType: [{ required: true, message: '请选择记录类型', trigger: 'change' }],
      status: [{ required: true, message: '请选择启用状态', trigger: 'change' }]
    }
  })

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const payload: SmisSpecialOperationCatalogSavePayload = {
        id: form.model.id,
        tenantId: targetTenantId.value,
        catalogKind: props.catalogKind,
        operationTypeId: form.model.operationTypeId,
        itemName: form.model.itemName.trim(),
        recordType: isSiteAnalysis.value ? form.model.recordType : null,
        normalValue: isSiteAnalysis.value ? normalizeNullableText(form.model.normalValue) : null,
        abnormalValue: isSiteAnalysis.value
          ? normalizeNullableText(form.model.abnormalValue)
          : null,
        sort: Number(form.model.sort),
        textColor: form.model.textColor || null,
        tagStyle: form.model.tagStyle,
        status: form.model.status
      }
      await saveSpecialOperationCatalogItem(payload)
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '特殊作业目录保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: SpecialOperationCatalogDialogOpenData): Promise<void> => {
    Object.assign(form.model, createInitialModel())
    operationTypes.value = data.operationTypes
    targetTenantId.value = data.tenantId
    targetTenantName.value = data.tenantName
    if (data.row) {
      Object.assign(form.model, {
        id: data.row.id,
        operationTypeId: data.row.operationTypeId,
        itemName: data.row.itemName,
        recordType: data.row.recordType || 'text',
        normalValue: data.row.normalValue || '',
        abnormalValue: data.row.abnormalValue || '',
        sort: data.row.sort,
        textColor: data.row.textColor || '',
        tagStyle: data.row.tagStyle,
        status: data.row.status === 'voided' ? 'disabled' : data.row.status
      })
    } else if (data.presetOperationTypeId) {
      form.model.operationTypeId = data.presetOperationTypeId
    } else {
      form.model.operationTypeId =
        (operationTypeOptions.value.find((item) => !item.disabled)?.value as string | undefined) ||
        ''
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? `编辑${props.singular}` : `新增${props.singular}`,
      subtitle: `维护${props.itemLabel}、显示规则和启用状态`,
      confirmText: data.row ? '保存更改' : `创建${props.singular}`,
      contentMaxHeight: '72vh',
      onOpen: async (_openData, api) => {
        api.setLoading(true)
        try {
          await Promise.all([
            userStore.ensureDictLoaded('commonEnabledDisabledVoidedStatus'),
            userStore.ensureDictLoaded('smisSpecialOperationRecordType'),
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

<style scoped lang="scss">
  .special-operation-catalog-dialog {
    &__preview {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      padding: 10px 14px;
      margin-bottom: 4px;
      background: var(--art-gray-100);
      border-radius: var(--el-border-radius-base);

      > span:first-child,
      small {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }

      strong {
        display: inline-flex;
        gap: 7px;
        align-items: center;

        i {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
      }

      small {
        flex: 1 1 280px;
        text-align: right;
      }
    }

    &__color-field {
      display: flex;
      gap: 10px;
      align-items: center;
      width: 100%;
      min-height: 32px;

      span {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    @media (width <= 640px) {
      &__preview small {
        text-align: left;
      }
    }
  }
</style>
