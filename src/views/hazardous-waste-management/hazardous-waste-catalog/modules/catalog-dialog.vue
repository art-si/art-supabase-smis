<template>
  <ArtDialog
    @open="
      () => {
        activeFormTab = 'identitySection'
      }
    "
    ref="dialogRef"
    size="lg"
  >
    <div class="hazardous-catalog-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:flask-line" /></template>
        <strong>建立危废识别与处置口径</strong
        ><p>安全措施和危险特性均引用系统字典，确保单据与导出口径一致。</p>
      </ArtEntitySummary>
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
        <template #presentation>
          <DisplayStyleField
            v-model:text-color="form.model.textColor"
            v-model:tag-style="form.model.tagStyle"
            :options="tagStyleOptions"
            :preview-text="form.model.wasteName || '危废标签预览'"
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
    saveHazardousWasteCatalog,
    type SmisHazardousWasteCatalogItem,
    type SmisHazardousWasteCatalogSavePayload,
    type SmisHazardousWasteCategory
  } from '@smis/api'
  export interface CatalogDialogOpenData {
    row?: SmisHazardousWasteCatalogItem
    categories: SmisHazardousWasteCategory[]
    presetCategoryId?: string
  }
  interface FormModel extends SmisHazardousWasteCatalogSavePayload {
    presentation?: undefined
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }
  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const activeFormTab = ref('identitySection')
  const dialogRef = ref<ArtDialogExpose<CatalogDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const categoryTree = ref<SmisHazardousWasteCategory[]>([])
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const initial = (): FormModel => ({
    id: undefined,
    categoryId: '',
    wasteCode: '',
    wasteName: '',
    wasteType: '',
    safetyMeasure: '',
    hazardCharacteristic: '',
    unit: '',
    sort: 10,
    textColor: null,
    tagStyle: '',
    status: 'enabled',
    remark: '',
    presentation: undefined
  })
  const model = reactive<FormModel>(initial())
  const dictOptions = (code: string): FormItemOption[] =>
    (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const categoryOptions = computed(() =>
    treeUtils.mapTree(categoryTree.value, (item) => ({
      ...item,
      categoryLabel: `${item.categoryName} · ${item.categoryCode}`,
      disabled: item.status === 'disabled'
    }))
  )
  const tagStyleOptions = computed(() => dictOptions('smisTagStyle'))
  const form = reactive<{
    model: FormModel
    items: ComputedRef<FormItem[]>
    rules: FormRules<FormModel>
  }>({
    model,
    items: computed(() => [
      { key: 'identitySection', label: '危废识别', type: 'tab' },
      {
        label: '危废编号',
        key: 'wasteCode',
        type: 'input',
        props: { maxlength: 40, clearable: true, placeholder: '如 HW08-001' }
      },
      {
        label: '危废名称',
        key: 'wasteName',
        type: 'input',
        props: { maxlength: 120, clearable: true }
      },
      {
        label: '危废分类',
        key: 'categoryId',
        type: 'treeSelect',
        props: {
          data: categoryOptions.value,
          checkStrictly: true,
          nodeKey: 'id',
          props: { label: 'categoryLabel', value: 'id', children: 'children', disabled: 'disabled' }
        }
      },
      {
        label: '废物类型',
        key: 'wasteType',
        type: 'input',
        props: { maxlength: 100, clearable: true, placeholder: '如 液态 / 固态' }
      },

      { key: 'additionalSection', label: '特性与管理', type: 'tab' },
      {
        label: '安全措施',
        key: 'safetyMeasure',
        type: 'select',
        options: dictOptions('smisHazardousWasteSafetyMeasure'),
        props: { clearable: true }
      },
      {
        label: '危险特性',
        key: 'hazardCharacteristic',
        type: 'select',
        options: dictOptions('smisHazardousWasteCharacteristic'),
        props: { clearable: true }
      },
      {
        label: '计量单位',
        key: 'unit',
        type: 'select',
        options: dictOptions('smisMaterialUnit'),
        props: { filterable: true }
      },
      {
        label: '显示顺序',
        key: 'sort',
        type: 'number',
        props: { min: 0, max: 999999, precision: 0, controlsPosition: 'right', class: '!w-full' }
      },
      {
        label: '启用状态',
        key: 'status',
        type: 'select',
        options: dictOptions('commonEnabledDisabledStatus')
      },
      { label: '显示效果', key: 'presentation', type: 'input' },
      {
        label: '备注',
        key: 'remark',
        type: 'input',
        span: 24,
        props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true, resize: 'none' }
      }
    ]),
    rules: {
      wasteCode: [{ required: true, message: '请输入危废编号', trigger: 'blur' }],
      wasteName: [{ required: true, message: '请输入危废名称', trigger: 'blur' }],
      categoryId: [{ required: true, message: '请选择危废分类', trigger: 'change' }],
      unit: [{ required: true, message: '请选择计量单位', trigger: 'change' }],
      status: [{ required: true, message: '请选择启用状态', trigger: 'change' }]
    }
  })
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const { presentation: _presentation, ...payload } = toRaw(model)
      void _presentation
      await saveHazardousWasteCatalog({
        ...payload,
        wasteCode: payload.wasteCode.trim().toUpperCase(),
        wasteName: payload.wasteName.trim(),
        wasteType: normalizeNullableText(payload.wasteType),
        safetyMeasure: payload.safetyMeasure || null,
        hazardCharacteristic: payload.hazardCharacteristic || null,
        remark: normalizeNullableText(payload.remark)
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '危废目录保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: CatalogDialogOpenData): Promise<void> => {
    Object.assign(model, initial())
    categoryTree.value = data.categories
    if (data.row) Object.assign(model, { ...data.row, categoryId: data.row.categoryId })
    else model.categoryId = data.presetCategoryId || ''
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑危废名录' : '新增危废名录',
      subtitle: '维护分类、危险特性、安全措施和计量单位',
      confirmText: '保存名录',
      contentMaxHeight: '76vh',
      onOpen: async (_data, api) => {
        api.setLoading(true)
        try {
          await Promise.all(
            [
              'commonEnabledDisabledStatus',
              'smisHazardousWasteSafetyMeasure',
              'smisHazardousWasteCharacteristic',
              'smisMaterialUnit',
              'smisTagStyle'
            ].map((code) => userStore.ensureDictLoaded(code))
          )
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit
    })
  }
  defineExpose({ handleOpen })
</script>
