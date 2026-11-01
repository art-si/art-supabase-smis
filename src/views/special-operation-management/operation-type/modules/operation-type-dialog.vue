<template>
  <ArtDialog
    ref="dialogRef"
    size="xl"
    :confirm-disabled="!formRef?.readyToSubmit"
    @open="
      () => {
        activeFormTab = 'basicSection'
      }
    "
  >
    <div class="operation-type-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:tools-line" /></template>
        <strong>{{ targetTenantName }} · 作业类型主数据</strong>
        <p>基础信息统一作业票入口；专有字段仅对当前作业类型生效，可按现场业务继续扩展。</p>
      </ArtEntitySummary>

      <div class="operation-type-dialog__preview" aria-live="polite">
        <span>标签预览</span>
        <ElTag v-if="form.model.tagStyle" :type="form.model.tagStyle">
          {{ previewName }}
        </ElTag>
        <strong v-else :style="{ color: form.model.textColor || undefined }">
          <i :style="{ backgroundColor: form.model.textColor || 'var(--theme-color)' }" />
          {{ previewName }}
        </strong>
        <small>{{ form.model.fieldDefinitions.length }} 个专有字段</small>
      </div>

      <ArtForm
        v-model:active-tab="activeFormTab"
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="24"
        label-position="top"
      >
        <template #fieldDefinitions>
          <div class="operation-type-dialog__field-editor">
            <div class="operation-type-dialog__field-toolbar">
              <div>
                <strong>字段定义</strong>
                <span>配置字段编码、录入类型、必填规则、单位和选项。</span>
              </div>
              <ElButton type="primary" plain @click="addFieldDefinition">
                <ArtSvgIcon icon="ri:add-line" />
                添加字段
              </ElButton>
            </div>

            <ArtEmptyState
              v-if="!form.model.fieldDefinitions.length"
              class="operation-type-dialog__field-empty"
              title="暂无专有字段"
              description="当前类型将只使用作业票通用字段，也可以点击“添加字段”扩展。"
              size="compact"
              :visual-size="64"
            />

            <div v-else class="operation-type-dialog__field-list">
              <section
                v-for="(definition, index) in form.model.fieldDefinitions"
                :key="definition._key"
                class="operation-type-dialog__field-card"
                :aria-label="`专有字段 ${index + 1}`"
              >
                <header>
                  <span class="operation-type-dialog__field-index">{{ index + 1 }}</span>
                  <div>
                    <strong>{{ definition.fieldLabel || '未命名字段' }}</strong>
                    <small>{{ definition.fieldCode || '等待填写字段编码' }}</small>
                  </div>
                  <div class="operation-type-dialog__field-actions">
                    <button
                      type="button"
                      :disabled="index === 0"
                      :aria-label="`上移${definition.fieldLabel || `字段 ${index + 1}`}`"
                      title="上移字段"
                      @click="moveField(index, -1)"
                    >
                      <ArtSvgIcon icon="ri:arrow-up-line" />
                    </button>
                    <button
                      type="button"
                      :disabled="index === form.model.fieldDefinitions.length - 1"
                      :aria-label="`下移${definition.fieldLabel || `字段 ${index + 1}`}`"
                      title="下移字段"
                      @click="moveField(index, 1)"
                    >
                      <ArtSvgIcon icon="ri:arrow-down-line" />
                    </button>
                    <button
                      type="button"
                      class="is-danger"
                      :aria-label="`移除${definition.fieldLabel || `字段 ${index + 1}`}`"
                      title="移除字段"
                      @click="removeField(index)"
                    >
                      <ArtSvgIcon icon="ri:delete-bin-5-line" />
                    </button>
                  </div>
                </header>

                <div class="operation-type-dialog__field-grid">
                  <label>
                    <span>字段名称 <em>*</em></span>
                    <ElInput
                      v-model="definition.fieldLabel"
                      maxlength="60"
                      clearable
                      placeholder="例如：动火级别"
                    />
                  </label>
                  <label>
                    <span>字段编码 <em>*</em></span>
                    <ElInput
                      v-model="definition.fieldCode"
                      maxlength="40"
                      clearable
                      placeholder="例如：hot_work_level"
                    />
                  </label>
                  <label>
                    <span>录入类型 <em>*</em></span>
                    <ElSelect v-model="definition.fieldType" class="!w-full">
                      <ElOption
                        v-for="option in fieldTypeOptions"
                        :key="option.value"
                        :label="option.label"
                        :value="option.value"
                      />
                    </ElSelect>
                  </label>
                  <label>
                    <span>单位</span>
                    <ElInput
                      v-model="definition.unit"
                      maxlength="20"
                      clearable
                      placeholder="例如：m、mg/L"
                    />
                  </label>
                  <label class="operation-type-dialog__field-wide">
                    <span>输入提示</span>
                    <ElInput
                      v-model="definition.placeholder"
                      maxlength="120"
                      clearable
                      placeholder="说明填写口径或示例"
                    />
                  </label>
                  <label
                    v-if="['single', 'multiple'].includes(definition.fieldType)"
                    class="operation-type-dialog__field-wide"
                  >
                    <span>可选项 <em>*</em></span>
                    <ElInput
                      v-model="definition.optionsText"
                      maxlength="500"
                      clearable
                      placeholder="多个选项请用逗号或换行分隔"
                    />
                  </label>
                  <label class="operation-type-dialog__required-switch">
                    <span>录入要求</span>
                    <ElSwitch
                      v-model="definition.required"
                      inline-prompt
                      active-text="必填"
                      inactive-text="选填"
                    />
                  </label>
                </div>
              </section>
            </div>
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
  import { cloneDeep } from 'lodash-es'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    saveSpecialOperationType,
    type SmisSpecialOperationEditableStatus,
    type SmisSpecialOperationFieldDefinition,
    type SmisSpecialOperationFieldType,
    type SmisSpecialOperationTagStyle,
    type SmisSpecialOperationType,
    type SmisSpecialOperationTypeSavePayload
  } from '@smis/api'

  export interface OperationTypeDialogOpenData {
    row?: SmisSpecialOperationType
    tenantId?: string | null
    tenantName: string
  }

  interface FieldDefinitionForm {
    _key: string
    id?: string
    fieldCode: string
    fieldLabel: string
    fieldType: SmisSpecialOperationFieldType
    required: boolean
    placeholder: string
    unit: string
    optionsText: string
    sort: number
  }

  interface FormModel {
    id?: string
    typeCode: string
    typeName: string
    remark: string
    sort: number
    textColor: string
    tagStyle: SmisSpecialOperationTagStyle
    status: SmisSpecialOperationEditableStatus
    fieldDefinitions: FieldDefinitionForm[]
  }

  interface FormExpose {
    readyToSubmit: boolean
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const activeFormTab = ref('basicSection')
  const dialogRef = ref<ArtDialogExpose<OperationTypeDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const targetTenantId = ref<string | null>()
  const targetTenantName = ref('当前租户')
  const presetColors = ['#2563EB', '#0891B2', '#059669', '#D97706', '#DC2626', '#7C3AED']

  const createFieldDefinition = (): FieldDefinitionForm => ({
    _key: crypto.randomUUID(),
    id: undefined,
    fieldCode: '',
    fieldLabel: '',
    fieldType: 'text',
    required: false,
    placeholder: '',
    unit: '',
    optionsText: '',
    sort: 10
  })
  const createInitialModel = (): FormModel => ({
    id: undefined,
    typeCode: '',
    typeName: '',
    remark: '',
    sort: 10,
    textColor: '',
    tagStyle: '',
    status: 'enabled',
    fieldDefinitions: []
  })
  const formModel = reactive<FormModel>(createInitialModel())
  const previewName = computed(() => form.model.typeName.trim() || '示例作业类型')
  const statusOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.commonEnabledDisabledVoidedStatus ?? [])
      .filter((item) => item.value !== 'voided')
      .map(toDictionaryOption)
  )
  const tagStyleOptions = computed<FormItemOption[]>(() => [
    { label: '不使用标签', value: '' },
    ...(getDictMap.value.smisTagStyle ?? []).map(toDictionaryOption)
  ])
  const fieldTypeOptions = computed<Array<{ label: string; value: SmisSpecialOperationFieldType }>>(
    () =>
      (getDictMap.value.smisSpecialOperationFieldType ?? []).map((item) => ({
        label: item.label || item.name,
        value: item.value as SmisSpecialOperationFieldType
      }))
  )

  const validateFieldDefinitions = (
    _rule: unknown,
    value: FieldDefinitionForm[],
    callback: (error?: Error) => void
  ): void => {
    const codes = new Set<string>()
    for (const [index, definition] of value.entries()) {
      const position = `第 ${index + 1} 个专有字段`
      if (!definition.fieldLabel.trim()) return callback(new Error(`${position}缺少字段名称`))
      const code = definition.fieldCode.trim().toLocaleLowerCase('en-US')
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(code)) {
        return callback(new Error(`${position}编码须以字母开头，仅使用小写字母、数字和下划线`))
      }
      if (codes.has(code)) return callback(new Error(`专有字段编码“${code}”重复`))
      codes.add(code)
      if (['single', 'multiple'].includes(definition.fieldType) && !definition.optionsText.trim()) {
        return callback(new Error(`${position}为选择类型，请至少配置一个可选项`))
      }
    }
    callback()
  }

  const form = reactive<{
    model: FormModel
    items: ComputedRef<FormItem[]>
    rules: FormRules<FormModel>
  }>({
    model: formModel,
    items: computed(() => [
      { label: '类型信息', key: 'basicSection', type: 'tab' },
      {
        label: '作业类型编号',
        key: 'typeCode',
        type: 'input',
        span: 8,
        description: '用于接口和作业票规则关联，创建后仍可按权限维护。',
        props: { maxlength: 30, clearable: true, placeholder: '例如：HOT_WORK' }
      },
      {
        label: '作业类型',
        key: 'typeName',
        type: 'input',
        span: 8,
        props: { maxlength: 80, clearable: true, placeholder: '例如：动火作业' }
      },
      {
        label: '显示顺序',
        key: 'sort',
        type: 'number',
        span: 8,
        props: { min: 0, max: 9999, precision: 0, controlsPosition: 'right', class: '!w-full' }
      },
      {
        label: '文字颜色',
        key: 'textColor',
        span: 8,
        type: 'colorPicker',
        get description(): string {
          return form.model.textColor?.toUpperCase() || '未设置颜色'
        },
        get props(): FormItem['props'] {
          return { predefine: presetColors }
        }
      },
      {
        label: '标签样式',
        key: 'tagStyle',
        type: 'tagStyleSelect',
        span: 8,
        options: tagStyleOptions.value,
        props: { clearable: false }
      },
      {
        label: '启用状态',
        key: 'status',
        type: 'segment',
        span: 8,
        options: statusOptions.value
      },
      {
        label: '备注',
        key: 'remark',
        type: 'textarea',
        span: 24,
        props: {
          rows: 3,
          maxlength: 500,
          showWordLimit: true,
          resize: 'none',
          placeholder: '补充适用范围或管理说明'
        }
      },
      { label: '作业专有字段', key: 'fieldDivider', type: 'tab', span: 24 },
      {
        label: '',
        key: 'fieldDefinitions',
        type: 'input',
        span: 24
      }
    ]),
    rules: {
      typeCode: [
        { required: true, message: '请输入作业类型编号', trigger: 'blur' },
        {
          pattern: /^[A-Za-z][A-Za-z0-9_-]{0,29}$/,
          message: '编号须以字母开头，仅支持字母、数字、连字符和下划线',
          trigger: 'blur'
        }
      ],
      typeName: [{ required: true, message: '请输入作业类型', trigger: 'blur' }],
      status: [{ required: true, message: '请选择启用状态', trigger: 'change' }],
      fieldDefinitions: [{ validator: validateFieldDefinitions, trigger: 'change' }]
    }
  })

  const addFieldDefinition = (): void => {
    const definition = createFieldDefinition()
    definition.sort = (form.model.fieldDefinitions.length + 1) * 10
    form.model.fieldDefinitions.push(definition)
  }

  const removeField = (index: number): void => {
    form.model.fieldDefinitions.splice(index, 1)
  }

  const moveField = (index: number, offset: -1 | 1): void => {
    const target = index + offset
    if (target < 0 || target >= form.model.fieldDefinitions.length) return
    const [definition] = form.model.fieldDefinitions.splice(index, 1)
    if (!definition) return
    form.model.fieldDefinitions.splice(target, 0, definition)
  }

  const toDefinitionForm = (
    definition: SmisSpecialOperationFieldDefinition
  ): FieldDefinitionForm => ({
    _key: definition.id || crypto.randomUUID(),
    id: definition.id,
    fieldCode: definition.fieldCode,
    fieldLabel: definition.fieldLabel,
    fieldType: definition.fieldType,
    required: definition.required,
    placeholder: definition.placeholder || '',
    unit: definition.unit || '',
    optionsText: definition.options.join('、'),
    sort: definition.sort
  })

  const normalizeOptions = (value: string): string[] =>
    value
      .split(/[，,、\n]/)
      .map((item) => item.trim())
      .filter((item, index, values) => Boolean(item) && values.indexOf(item) === index)

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const fieldDefinitions: SmisSpecialOperationFieldDefinition[] =
        form.model.fieldDefinitions.map((definition, index) => ({
          id: definition.id,
          fieldCode: definition.fieldCode.trim().toLocaleLowerCase('en-US'),
          fieldLabel: definition.fieldLabel.trim(),
          fieldType: definition.fieldType,
          required: definition.required,
          placeholder: normalizeNullableText(definition.placeholder),
          unit: normalizeNullableText(definition.unit),
          options: ['single', 'multiple'].includes(definition.fieldType)
            ? normalizeOptions(definition.optionsText)
            : [],
          sort: (index + 1) * 10
        }))
      const payload: SmisSpecialOperationTypeSavePayload = {
        id: form.model.id,
        tenantId: targetTenantId.value,
        typeCode: form.model.typeCode.trim().toUpperCase(),
        typeName: form.model.typeName.trim(),
        remark: normalizeNullableText(form.model.remark),
        sort: Number(form.model.sort),
        textColor: form.model.textColor || null,
        tagStyle: form.model.tagStyle,
        status: form.model.status,
        fieldDefinitions
      }
      await saveSpecialOperationType(payload)
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '特殊作业类型保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: OperationTypeDialogOpenData): Promise<void> => {
    Object.assign(form.model, createInitialModel())
    targetTenantId.value = data.tenantId
    targetTenantName.value = data.tenantName
    if (data.row) {
      Object.assign(form.model, {
        id: data.row.id,
        typeCode: data.row.typeCode,
        typeName: data.row.typeName,
        remark: data.row.remark || '',
        sort: data.row.sort,
        textColor: data.row.textColor || '',
        tagStyle: data.row.tagStyle,
        status: data.row.status === 'voided' ? 'disabled' : data.row.status,
        fieldDefinitions: cloneDeep(data.row.fieldDefinitions).map(toDefinitionForm)
      })
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑作业类型' : '新增作业类型',
      subtitle: '维护基础标识与该类型独有的作业票字段',
      confirmText: data.row ? '保存更改' : '创建作业类型',
      contentMaxHeight: '74vh',
      onOpen: async (_openData, api) => {
        api.setLoading(true)
        try {
          await Promise.all([
            userStore.ensureDictLoaded('commonEnabledDisabledVoidedStatus'),
            userStore.ensureDictLoaded('smisSpecialOperationFieldType'),
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
  .operation-type-dialog {
    &__preview {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 10px 14px;
      margin-bottom: 4px;
      background: var(--art-gray-100);
      border-radius: var(--el-border-radius-base);

      > span,
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
        margin-left: auto;
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

    &__field-editor {
      display: grid;
      gap: 12px;
      width: 100%;
    }

    &__field-toolbar {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;

      > div {
        display: grid;
      }

      span {
        margin-top: 2px;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    &__field-empty {
      min-height: 150px;
      background: var(--art-gray-100);
      border: 1px dashed var(--el-border-color);
      border-radius: var(--el-border-radius-base);
    }

    &__field-list {
      display: grid;
      gap: 10px;
    }

    &__field-card {
      padding: 12px;
      background: var(--art-gray-100);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);

      header {
        display: grid;
        grid-template-columns: 32px minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
        margin-bottom: 12px;

        > div:nth-child(2) {
          display: grid;
          min-width: 0;
        }

        small {
          font-size: 11px;
          color: var(--el-text-color-secondary);
        }
      }
    }

    &__field-index {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      font-weight: 700;
      color: var(--theme-color);
      background: var(--default-box-color);
      border-radius: var(--el-border-radius-base);
    }

    &__field-actions {
      display: flex;
      gap: 4px;

      button {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        padding: 0;
        color: var(--el-text-color-secondary);
        cursor: pointer;
        background: var(--default-box-color);
        border: 1px solid var(--el-border-color-lighter);
        border-radius: var(--el-border-radius-small);

        &:hover:not(:disabled),
        &:focus-visible {
          color: var(--theme-color);
          border-color: color-mix(in srgb, var(--theme-color) 42%, transparent);
        }

        &:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--theme-color) 35%, transparent);
          outline-offset: 1px;
        }

        &:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }

        &.is-danger:hover,
        &.is-danger:focus-visible {
          color: var(--el-color-danger);
          border-color: color-mix(in srgb, var(--el-color-danger) 42%, transparent);
        }
      }
    }

    &__field-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;

      label {
        display: grid;
        gap: 6px;
        min-width: 0;

        > span {
          font-size: 12px;
          color: var(--el-text-color-regular);
        }

        em {
          font-style: normal;
          color: var(--el-color-danger);
        }
      }
    }

    &__field-wide {
      grid-column: span 2;
    }

    &__required-switch {
      align-content: end;
    }

    @media (width <= 900px) {
      &__field-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (width <= 560px) {
      &__field-toolbar {
        flex-direction: column;
        align-items: stretch;
      }

      &__field-grid {
        grid-template-columns: minmax(0, 1fr);
      }

      &__field-wide {
        grid-column: auto;
      }
    }
  }
</style>
