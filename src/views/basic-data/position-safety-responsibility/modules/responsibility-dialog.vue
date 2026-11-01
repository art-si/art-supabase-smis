<template>
  <ArtDialog ref="dialogRef" size="lg" @focus-change="isFocusMode = $event">
    <ArtForm
      ref="formRef"
      v-model="form"
      :items="formItems"
      :rules="formRules"
      :span="12"
      :gutter="24"
      label-position="top"
    >
      <template #context>
        <div class="responsibility-dialog__context">
          <span class="responsibility-dialog__context-icon" aria-hidden="true">
            <ArtSvgIcon icon="ri:shield-user-line" />
          </span>
          <div class="responsibility-dialog__context-copy">
            <small>当前维护岗位</small>
            <strong>{{ context.positionName || '未选择岗位' }}</strong>
            <div class="responsibility-dialog__context-meta">
              <span class="art-icon-label">
                <ArtSvgIcon icon="ri:node-tree" aria-hidden="true" />
                {{ context.organizationName || '未选择组织' }}
              </span>
              <span class="art-icon-label" translate="no">
                <ArtSvgIcon icon="ri:hashtag" aria-hidden="true" />
                {{ context.positionCode || '--' }}
              </span>
            </div>
          </div>
          <div class="responsibility-dialog__context-source">
            <ArtSvgIcon icon="ri:link-m" aria-hidden="true" />
            <span>关联 HR 岗位主数据</span>
          </div>
        </div>
      </template>
    </ArtForm>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import { computed, nextTick, reactive, ref, toRaw } from 'vue'
  import { storeToRefs } from 'pinia'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import { formatWithDayjs } from '@/utils/time'
  import { findDictionaryItem, getChildDictionaryItems } from '@smis/domain/hazard-dictionary'
  import {
    addPositionSafetyResponsibility,
    editPositionSafetyResponsibility,
    type PositionSafetyResponsibility,
    type PositionSafetyResponsibilitySavePayload
  } from '@smis/api'

  const DICTIONARY_CODES = [
    'smisPrimaryHazardCategory',
    'smisSecondaryHazardCategory',
    'smisHazardContent',
    'smisHazardLevel',
    'smisFrequencyUnit',
    'smisInspectionFrequency',
    'smisRiskLevel'
  ] as const

  export interface ResponsibilityDialogOpenData {
    organizationId: string
    organizationName: string
    positionId: string
    positionName: string
    positionCode: string
    row?: PositionSafetyResponsibility
  }

  interface DialogFormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  interface DialogContext {
    organizationName: string
    positionName: string
    positionCode: string
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<ResponsibilityDialogOpenData>>()
  const formRef = ref<DialogFormExpose>()
  const isFocusMode = ref(false)
  const context = reactive<DialogContext>({
    organizationName: '',
    positionName: '',
    positionCode: ''
  })

  const createInitialForm = (): PositionSafetyResponsibility => ({
    id: undefined,
    organizationId: '',
    positionId: '',
    primaryHazardCategory: 'basic_management',
    secondaryHazardCategory: 'safety_rules',
    hazardContent: '',
    hazardLevel: 'general_d',
    riskLevel: 'low_d',
    inspectionItem: '',
    inspectionStandard: '',
    inspectionFrequency: 1,
    frequencyUnit: 'day',
    revisionDate: formatWithDayjs(new Date(), 'YYYY-MM-DD') || ''
  })
  const form = ref<PositionSafetyResponsibility>(createInitialForm())

  const primaryCategoryItems = computed(() => getDictMap.value.smisPrimaryHazardCategory ?? [])
  const secondaryCategoryItems = computed(() => getDictMap.value.smisSecondaryHazardCategory ?? [])
  const hazardContentItems = computed(() => getDictMap.value.smisHazardContent ?? [])
  const selectedPrimaryCategory = computed(() =>
    findDictionaryItem(primaryCategoryItems.value, form.value.primaryHazardCategory)
  )
  const selectedSecondaryCategory = computed(() =>
    findDictionaryItem(secondaryCategoryItems.value, form.value.secondaryHazardCategory)
  )
  const secondaryCategoryOptions = computed<FormItemOption[]>(() => {
    return getChildDictionaryItems(secondaryCategoryItems.value, selectedPrimaryCategory.value).map(
      toDictionaryOption
    )
  })
  const hazardContentOptions = computed<FormItemOption[]>(() => {
    const options = getChildDictionaryItems(
      hazardContentItems.value,
      selectedSecondaryCategory.value
    ).map(toDictionaryOption)
    const currentValue = form.value.hazardContent?.trim() ?? ''

    if (currentValue && !options.some((item) => item.value === currentValue)) {
      options.unshift({ label: `${currentValue}（历史值）`, value: currentValue })
    }
    return options
  })
  const frequencyOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.smisInspectionFrequency ?? []).map((item) => ({
      label: item.label || item.name,
      value: Number(item.value)
    }))
  )

  const formRules = computed<FormRules<PositionSafetyResponsibility>>(() => ({
    primaryHazardCategory: [{ required: true, message: '请选择一级隐患类别', trigger: 'change' }],
    secondaryHazardCategory: [{ required: true, message: '请选择二级隐患类别', trigger: 'change' }],
    hazardContent: [{ max: 500, message: '隐患内容不能超过 500 个字符', trigger: 'change' }],
    hazardLevel: [{ required: true, message: '请选择隐患级别', trigger: 'change' }],
    riskLevel: [{ required: true, message: '请选择隐患风险等级', trigger: 'change' }],
    inspectionItem: [
      { required: true, message: '请输入排查项目', trigger: 'blur' },
      { max: 1000, message: '排查项目不能超过 1000 个字符', trigger: 'blur' }
    ],
    inspectionStandard: [
      { required: true, message: '请输入排查标准', trigger: 'blur' },
      { max: 2000, message: '排查标准不能超过 2000 个字符', trigger: 'blur' }
    ],
    inspectionFrequency: [{ required: true, message: '请选择排查频次', trigger: 'change' }],
    frequencyUnit: [{ required: true, message: '请选择频次单位', trigger: 'change' }],
    revisionDate: [{ required: true, message: '请选择修订日期', trigger: 'change' }]
  }))

  const formItems = computed<FormItem[]>(() => [
    ...(!isFocusMode.value
      ? [{ label: '适用岗位', key: 'context', type: 'text', span: 24 } as FormItem]
      : []),
    { label: '隐患分类', key: 'categorySection', type: 'divider', span: 24 },
    {
      label: '一级隐患类别',
      key: 'primaryHazardCategory',
      type: 'select',
      options: (getDictMap.value.smisPrimaryHazardCategory ?? []).map(toDictionaryOption),
      props: {
        placeholder: '请选择一级隐患类别',
        onChange: () => {
          form.value.secondaryHazardCategory = ''
          form.value.hazardContent = ''
        }
      }
    },
    {
      label: '二级隐患类别',
      key: 'secondaryHazardCategory',
      type: 'select',
      options: secondaryCategoryOptions.value,
      props: {
        disabled: !form.value.primaryHazardCategory,
        placeholder: form.value.primaryHazardCategory ? '请选择二级隐患类别' : '请先选择一级类别',
        onChange: () => {
          form.value.hazardContent = ''
        }
      }
    },
    {
      label: '隐患内容',
      key: 'hazardContent',
      type: 'select',
      span: 24,
      options: hazardContentOptions.value,
      props: {
        clearable: true,
        filterable: true,
        disabled: !form.value.secondaryHazardCategory,
        placeholder: form.value.secondaryHazardCategory
          ? '请选择隐患内容（可选）'
          : '请先选择二级类别'
      }
    },
    {
      label: '隐患级别',
      key: 'hazardLevel',
      type: 'select',
      options: (getDictMap.value.smisHazardLevel ?? []).map(toDictionaryOption),
      props: { placeholder: '请选择隐患级别' }
    },
    {
      label: '隐患风险等级',
      key: 'riskLevel',
      type: 'select',
      options: (getDictMap.value.smisRiskLevel ?? []).map(toDictionaryOption),
      props: { placeholder: '请选择风险等级' }
    },
    { label: '排查要求', key: 'inspectionSection', type: 'divider', span: 24 },
    {
      label: '排查频次',
      key: 'inspectionFrequency',
      type: 'select',
      options: frequencyOptions.value,
      props: { placeholder: '请选择排查频次' }
    },
    {
      label: '频次单位',
      key: 'frequencyUnit',
      type: 'select',
      options: (getDictMap.value.smisFrequencyUnit ?? []).map(toDictionaryOption),
      props: { placeholder: '请选择频次单位' }
    },
    {
      label: '排查项目',
      key: 'inspectionItem',
      type: 'input',
      span: 24,
      props: {
        type: 'textarea',
        rows: 3,
        maxlength: 1000,
        showWordLimit: true,
        placeholder: '填写具体排查项目'
      }
    },
    {
      label: '排查标准',
      key: 'inspectionStandard',
      type: 'input',
      span: 24,
      props: {
        type: 'textarea',
        rows: 4,
        maxlength: 2000,
        showWordLimit: true,
        placeholder: '填写可执行、可核验的排查标准'
      }
    },
    {
      label: '修订日期',
      key: 'revisionDate',
      type: 'date',
      props: { type: 'date', valueFormat: 'YYYY-MM-DD', class: '!w-full' }
    }
  ])

  const resetForm = async (): Promise<void> => {
    isFocusMode.value = false
    Object.assign(form.value, createInitialForm())
    Object.assign(context, { organizationName: '', positionName: '', positionCode: '' })
    await nextTick()
    formRef.value?.clearValidate()
  }

  const buildPayload = (): PositionSafetyResponsibilitySavePayload => ({
    organizationId: form.value.organizationId,
    positionId: form.value.positionId,
    primaryHazardCategory: form.value.primaryHazardCategory,
    secondaryHazardCategory: form.value.secondaryHazardCategory,
    hazardContent: normalizeNullableText(form.value.hazardContent),
    hazardLevel: form.value.hazardLevel,
    riskLevel: form.value.riskLevel,
    inspectionItem: form.value.inspectionItem.trim(),
    inspectionStandard: form.value.inspectionStandard.trim(),
    inspectionFrequency: Number(form.value.inspectionFrequency),
    frequencyUnit: form.value.frequencyUnit,
    revisionDate: form.value.revisionDate
  })

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const type = form.value.id ? 'edit' : 'add'
      if (type === 'edit') await editPositionSafetyResponsibility(form.value.id!, buildPayload())
      else await addPositionSafetyResponsibility(buildPayload())
      emit('success', type)
      return true
    } catch (error) {
      notifyFriendlyError(error, '岗位安全责任保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: ResponsibilityDialogOpenData): Promise<void> => {
    await resetForm()
    Object.assign(context, {
      organizationName: data.organizationName,
      positionName: data.positionName,
      positionCode: data.positionCode
    })
    Object.assign(form.value, {
      ...createInitialForm(),
      organizationId: data.organizationId,
      positionId: data.positionId,
      ...(data.row ? structuredClone(toRaw(data.row)) : {})
    })

    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑隐患排查标准' : '新增隐患排查标准',
      subtitle: `${data.organizationName} · ${data.positionName}`,
      confirmText: '保存',
      contentMaxHeight: 'calc(100vh - 184px)',
      onOpen: async (_openData, api) => {
        const missingCodes = DICTIONARY_CODES.filter(
          (code) => !(getDictMap.value[code]?.length ?? 0)
        )
        if (!missingCodes.length) return
        api.setLoading(true)
        try {
          await Promise.all(missingCodes.map((code) => userStore.ensureDictLoaded(code)))
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit,
      onReset: () => void resetForm()
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .responsibility-dialog {
    &__context {
      display: flex;
      gap: 12px;
      align-items: center;
      width: 100%;
      min-width: 0;
      padding: 12px 14px;
      background: var(--art-gray-100);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__context-icon {
      display: inline-flex;
      flex: 0 0 42px;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
      border-radius: var(--el-border-radius-base);
    }

    &__context-copy {
      display: grid;
      flex: 1;
      min-width: 0;

      > small,
      > strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      > small {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      > strong {
        margin: 2px 0 4px;
        font-size: 15px;
        color: var(--el-text-color-primary);
      }
    }

    &__context-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
      min-width: 0;

      span {
        display: inline-flex;
        gap: 5px;
        align-items: center;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 12px;
        color: var(--el-text-color-secondary);
        white-space: nowrap;
      }
    }

    &__context-source {
      display: inline-flex;
      flex: none;
      gap: 5px;
      align-items: center;
      padding: 5px 9px;
      font-size: 11px;
      color: var(--el-color-success-dark-2);
      background: var(--el-color-success-light-9);
      border-radius: 999px;
    }

    @media (width <= 640px) {
      &__context {
        align-items: flex-start;
      }

      &__context-source {
        display: none;
      }
    }
  }
</style>
