<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="anti-violation-standard-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:shield-check-line" /></template>
        <strong>标准条目决定三违认定口径</strong>
        <p>违章编号在租户内唯一；停用条目继续保留历史引用，但不再进入新增教育记录的可选范围。</p>
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
  import {
    saveAntiViolationStandard,
    type SmisAntiViolationStandard,
    type SmisAntiViolationStandardSavePayload,
    type SmisAntiViolationStatus,
    type SmisViolationCategory
  } from '@smis/api'

  export interface AntiViolationStandardDialogOpenData {
    row?: SmisAntiViolationStandard
    categoryTree: SmisViolationCategory[]
    presetCategoryId?: string
  }

  interface FormModel {
    id?: string
    categoryId: string
    standardCode: string
    standardName: string
    deductionPoints: number
    handlingRequirements: string
    legalBasis: string
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
  const dialogRef = ref<ArtDialogExpose<AntiViolationStandardDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const categoryTree = shallowRef<SmisViolationCategory[]>([])

  const initial = (): FormModel => ({
    id: undefined,
    categoryId: '',
    standardCode: '',
    standardName: '',
    deductionPoints: 0,
    handlingRequirements: '',
    legalBasis: '',
    status: 'enabled',
    description: ''
  })

  const statusOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.commonEnabledStatus ?? []).map(toDictionaryOption)
  )

  const textareaProps = (placeholder: string, maxlength: number) => ({
    rows: 4,
    maxlength,
    showWordLimit: true,
    resize: 'none',
    placeholder
  })

  const form = reactive<{
    model: FormModel
    items: ComputedRef<FormItem[]>
    rules: FormRules<FormModel>
  }>({
    model: initial(),
    items: computed(() => [
      { label: '标准识别', key: 'identity', type: 'divider', span: 24 },
      {
        label: '所属违章分类',
        key: 'categoryId',
        type: 'treeSelect',
        props: {
          data: categoryTree.value,
          nodeKey: 'id',
          checkStrictly: true,
          clearable: false,
          defaultExpandAll: true,
          props: { label: 'categoryName', value: 'id', children: 'children', disabled: 'disabled' },
          placeholder: '请选择所属违章分类'
        }
      },
      {
        label: '违章编号',
        key: 'standardCode',
        type: 'input',
        props: { maxlength: 50, clearable: true, placeholder: '如 010001' }
      },
      {
        label: '违章名称',
        key: 'standardName',
        type: 'textarea',
        span: 24,
        props: textareaProps('准确描述违章行为、违规情形或禁止事项', 500)
      },
      { label: '处置口径', key: 'handling', type: 'divider', span: 24 },
      {
        label: '扣减分值',
        key: 'deductionPoints',
        type: 'number',
        props: {
          min: 0,
          max: 99999999.99,
          precision: 2,
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
        label: '处理要求',
        key: 'handlingRequirements',
        type: 'textarea',
        span: 24,
        props: textareaProps('说明纠正措施、教育要求或处置建议', 2000)
      },
      {
        label: '制度依据',
        key: 'legalBasis',
        type: 'textarea',
        span: 12,
        props: textareaProps('填写制度、标准或规程依据', 1000)
      },
      {
        label: '补充说明',
        key: 'description',
        type: 'textarea',
        span: 12,
        props: textareaProps('补充适用范围、认定边界等信息', 1000)
      }
    ]),
    rules: {
      categoryId: [{ required: true, message: '请选择所属违章分类', trigger: 'change' }],
      standardCode: [{ required: true, message: '请输入违章编号', trigger: 'blur' }],
      standardName: [{ required: true, message: '请输入违章名称', trigger: 'blur' }],
      deductionPoints: [{ required: true, message: '请输入扣减分值', trigger: 'blur' }],
      status: [{ required: true, message: '请选择启用状态', trigger: 'change' }]
    }
  })

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const payload: SmisAntiViolationStandardSavePayload = {
        id: form.model.id,
        operation: form.model.id ? 'edit' : 'add',
        categoryId: form.model.categoryId,
        standardCode: form.model.standardCode.trim().toUpperCase(),
        standardName: form.model.standardName.trim(),
        deductionPoints: Number(form.model.deductionPoints),
        handlingRequirements: normalizeNullableText(form.model.handlingRequirements),
        legalBasis: normalizeNullableText(form.model.legalBasis),
        status: form.model.status,
        description: normalizeNullableText(form.model.description)
      }
      await saveAntiViolationStandard(payload)
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '反违章标准保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: AntiViolationStandardDialogOpenData): Promise<void> => {
    Object.assign(form.model, initial())
    categoryTree.value = data.categoryTree
    if (data.row) {
      Object.assign(form.model, {
        id: data.row.id,
        categoryId: data.row.categoryId,
        standardCode: data.row.standardCode,
        standardName: data.row.standardName,
        deductionPoints: data.row.deductionPoints,
        handlingRequirements: data.row.handlingRequirements || '',
        legalBasis: data.row.legalBasis || '',
        status: data.row.status,
        description: data.row.description || ''
      })
    } else {
      form.model.categoryId = data.presetCategoryId || ''
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑反违章标准' : '新增反违章标准',
      subtitle: '维护违章条目、分类归属、扣分口径和处置依据',
      confirmText: '保存反违章标准',
      contentMaxHeight: 'calc(100vh - 150px)',
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
