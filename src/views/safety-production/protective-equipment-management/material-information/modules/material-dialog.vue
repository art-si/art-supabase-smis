<template>
  <ArtDialog
    @open="
      () => {
        activeFormTab = 'identitySection'
      }
    "
    ref="dialogRef"
    size="xl"
  >
    <div class="material-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:archive-stack-line" /></template>
        <strong>维护物料主数据</strong>
        <p>分类、物料类型、计量单位与来源均直接沿用 MDM 物料编码主数据。</p>
      </ArtEntitySummary>
      <ArtForm
        v-model:active-tab="activeFormTab"
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="8"
        :gutter="24"
        label-position="top"
      >
        <template #imageUrls>
          <ArtUploadImage
            v-model="form.model.imageUrls"
            :resource-tenant-id="selectedTenantId || ''"
            :disabled="!selectedTenantId"
            title="上传物料图片"
            multiple
            :limit="5"
            :size="108"
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
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import TreeUtils from '@/utils/tree'
  import {
    saveMaterial,
    type SmisMaterial,
    type SmisMaterialCategory,
    type SmisMaterialSavePayload,
    type SmisMaterialSource,
    type SmisMaterialStatus,
    type SmisMaterialType,
    type SmisMaterialTypeOption,
    type SmisMaterialUnitOption
  } from '@smis/api'

  interface CategoryTreeOption extends SmisMaterialCategory {
    categoryLabel: string
    disabled?: boolean
    children?: CategoryTreeOption[]
  }
  export interface MaterialDialogOpenData {
    row?: SmisMaterial
    categoryTree: SmisMaterialCategory[]
    materialTypes: SmisMaterialTypeOption[]
    units: SmisMaterialUnitOption[]
    presetCategoryId?: string
  }
  interface MaterialForm {
    id?: string
    categoryId?: string
    materialCode: string
    materialName: string
    specificationModel: string
    drawingNo: string
    basicUnit: string
    materialType: SmisMaterialType | ''
    baseUnitId?: string
    materialTypeId?: string
    materialSource: SmisMaterialSource | ''
    brand: string
    manufacturer: string
    materialComposition: string
    placeOfOrigin: string
    color: string
    imageUrls: string[]
    description: string
    status: SmisMaterialStatus
    sort: number
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }
  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const { getDictMap } = storeToRefs(userStore)
  const activeFormTab = ref('identitySection')
  const dialogRef = ref<ArtDialogExpose<MaterialDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const categoryTree = ref<SmisMaterialCategory[]>([])
  const materialTypes = ref<SmisMaterialTypeOption[]>([])
  const units = ref<SmisMaterialUnitOption[]>([])
  const initialForm = (): MaterialForm => ({
    id: undefined,
    categoryId: undefined,
    materialCode: '',
    materialName: '',
    specificationModel: '',
    drawingNo: '',
    basicUnit: '',
    materialType: '',
    baseUnitId: undefined,
    materialTypeId: undefined,
    materialSource: '',
    brand: '',
    manufacturer: '',
    materialComposition: '',
    placeOfOrigin: '',
    color: '',
    imageUrls: [],
    description: '',
    status: 'enabled',
    sort: 10
  })
  const formModel = reactive<MaterialForm>(initialForm())
  const categoryOptions = computed<CategoryTreeOption[]>(() =>
    treeUtils.mapTree(categoryTree.value as CategoryTreeOption[], (item) => ({
      ...item,
      categoryLabel: `${item.categoryName} · ${item.categoryCode}${item.status === 'disabled' ? '（停用）' : ''}`,
      disabled: item.status === 'disabled' && item.id !== formModel.categoryId
    }))
  )
  const selectedTenantId = computed(
    () => treeUtils.findNode(categoryTree.value, formModel.categoryId || '')?.tenantId
  )
  const materialTypeOptions = computed<FormItemOption[]>(() =>
    materialTypes.value
      .filter(
        (item) =>
          (!selectedTenantId.value || item.tenantId === selectedTenantId.value) &&
          (item.status === 'enabled' || item.id === formModel.materialTypeId)
      )
      .map((item) => ({ label: `${item.typeName} · ${item.typeCode}`, value: item.id }))
  )
  const unitOptions = computed<FormItemOption[]>(() =>
    units.value
      .filter(
        (item) =>
          (!selectedTenantId.value || item.tenantId === selectedTenantId.value) &&
          (item.status === 'enabled' || item.id === formModel.baseUnitId)
      )
      .map((item) => ({
        label: `${item.unitName} · ${item.unitCode}${item.symbol ? `（${item.symbol}）` : ''}`,
        value: item.id
      }))
  )
  const form = reactive<{
    model: MaterialForm
    items: ComputedRef<FormItem[]>
    rules: FormRules<MaterialForm>
  }>({
    model: formModel,
    items: computed(() => [
      { key: 'identitySection', label: '物料识别', type: 'tab' },
      {
        label: '物料编码',
        key: 'materialCode',
        type: 'input',
        props: { maxlength: 60, clearable: true, placeholder: '如 PPE-HELMET-001' }
      },
      {
        label: '物料名称',
        key: 'materialName',
        type: 'input',
        props: { maxlength: 120, clearable: true, placeholder: '如 ABS 安全帽' }
      },
      {
        label: '物料类别',
        key: 'categoryId',
        type: 'treeSelect',
        props: {
          data: categoryOptions.value,
          clearable: true,
          filterable: true,
          checkStrictly: true,
          nodeKey: 'id',
          defaultExpandAll: true,
          placeholder: '请选择物料类别',
          props: { label: 'categoryLabel', value: 'id', children: 'children', disabled: 'disabled' }
        }
      },
      {
        label: '规格型号',
        key: 'specificationModel',
        type: 'input',
        props: { maxlength: 120, clearable: true, placeholder: '输入规格或型号' }
      },
      {
        label: '图号',
        key: 'drawingNo',
        type: 'input',
        props: { maxlength: 80, clearable: true, placeholder: '无图号可不填' }
      },
      {
        label: '基本单位',
        key: 'baseUnitId',
        type: 'select',
        options: unitOptions.value,
        props: { clearable: false, filterable: true, placeholder: '请选择计量单位' }
      },
      {
        label: '物料类型',
        key: 'materialTypeId',
        type: 'select',
        options: materialTypeOptions.value,
        props: { clearable: false, filterable: true, placeholder: '请选择物料类型' }
      },
      {
        label: '物料来源',
        key: 'materialSource',
        type: 'select',
        options: (getDictMap.value.mdmMaterialSource ?? []).map(toDictionaryOption),
        props: { clearable: false, placeholder: '请选择物料来源' }
      },

      { key: 'additionalSection', label: '扩展与资料', type: 'tab' },
      {
        label: '品牌',
        key: 'brand',
        type: 'input',
        props: { maxlength: 80, clearable: true, placeholder: '输入品牌' }
      },
      {
        label: '制造商',
        key: 'manufacturer',
        type: 'input',
        props: { maxlength: 160, clearable: true, placeholder: '输入制造商' }
      },
      {
        label: '材质',
        key: 'materialComposition',
        type: 'input',
        props: { maxlength: 120, clearable: true, placeholder: '输入主要材质' }
      },
      {
        label: '产地',
        key: 'placeOfOrigin',
        type: 'input',
        props: { maxlength: 120, clearable: true, placeholder: '输入产地' }
      },
      {
        label: '颜色',
        key: 'color',
        type: 'input',
        props: { maxlength: 80, clearable: true, placeholder: '输入颜色' }
      },
      {
        label: '启用状态',
        key: 'status',
        type: 'select',
        options: (getDictMap.value.commonEnabledStatus ?? []).map(toDictionaryOption),
        props: { clearable: false, placeholder: '请选择启用状态' }
      },
      {
        label: '显示顺序',
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
      { label: '物料图片', key: 'imageUrls', type: 'text', span: 24 },
      {
        label: '说明',
        key: 'description',
        type: 'input',
        span: 24,
        props: {
          type: 'textarea',
          rows: 4,
          maxlength: 1000,
          showWordLimit: true,
          resize: 'none',
          placeholder: '补充物料用途、选型要求或保管说明'
        }
      }
    ]),
    rules: {
      materialCode: [
        { required: true, message: '请输入物料编码', trigger: 'blur' },
        { max: 60, message: '物料编码不能超过 60 个字符', trigger: 'blur' }
      ],
      materialName: [
        { required: true, message: '请输入物料名称', trigger: 'blur' },
        { max: 120, message: '物料名称不能超过 120 个字符', trigger: 'blur' }
      ],
      categoryId: [{ required: true, message: '请选择物料类别', trigger: 'change' }],
      baseUnitId: [{ required: true, message: '请选择基本单位', trigger: 'change' }],
      materialTypeId: [{ required: true, message: '请选择物料类型', trigger: 'change' }],
      materialSource: [{ required: true, message: '请选择物料来源', trigger: 'change' }],
      status: [{ required: true, message: '请选择启用状态', trigger: 'change' }],
      sort: [{ required: true, message: '请输入显示顺序', trigger: 'change' }]
    }
  })
  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, initialForm())
    categoryTree.value = []
    await nextTick()
    formRef.value?.clearValidate()
  }
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const materialType = materialTypes.value.find((item) => item.id === form.model.materialTypeId)
      const baseUnit = units.value.find((item) => item.id === form.model.baseUnitId)
      if (!materialType || !baseUnit) return false
      const payload: SmisMaterialSavePayload = {
        id: form.model.id,
        categoryId: form.model.categoryId || '',
        materialCode: form.model.materialCode.trim().toUpperCase(),
        materialName: form.model.materialName.trim(),
        specificationModel: form.model.specificationModel.trim(),
        drawingNo: form.model.drawingNo.trim(),
        basicUnit: baseUnit.unitCode,
        materialType: materialType.typeCode,
        baseUnitId: baseUnit.id,
        materialTypeId: materialType.id,
        materialSource: form.model.materialSource as SmisMaterialSource,
        brand: form.model.brand.trim(),
        manufacturer: form.model.manufacturer.trim(),
        materialComposition: form.model.materialComposition.trim(),
        placeOfOrigin: form.model.placeOfOrigin.trim(),
        color: form.model.color.trim(),
        imageUrls: [...form.model.imageUrls],
        description: form.model.description.trim(),
        status: form.model.status,
        sort: Number(form.model.sort || 0)
      }
      await saveMaterial(payload)
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '防护用品档案保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: MaterialDialogOpenData): Promise<void> => {
    await resetForm()
    categoryTree.value = data.categoryTree
    materialTypes.value = data.materialTypes
    units.value = data.units
    if (data.row)
      Object.assign(form.model, {
        id: data.row.id,
        categoryId: data.row.categoryId,
        materialCode: data.row.materialCode,
        materialName: data.row.materialName,
        specificationModel: data.row.specificationModel || '',
        drawingNo: data.row.drawingNo || '',
        basicUnit: data.row.basicUnit,
        materialType: data.row.materialType,
        baseUnitId:
          data.row.baseUnitId ||
          data.units.find(
            (item) =>
              item.tenantId === data.row?.tenantId &&
              [item.unitCode, item.unitName, item.symbol].includes(data.row?.basicUnit)
          )?.id,
        materialTypeId:
          data.row.materialTypeId ||
          data.materialTypes.find(
            (item) =>
              item.tenantId === data.row?.tenantId &&
              [item.typeCode, item.typeName].includes(data.row?.materialType)
          )?.id,
        materialSource: data.row.materialSource,
        brand: data.row.brand || '',
        manufacturer: data.row.manufacturer || '',
        materialComposition: data.row.materialComposition || '',
        placeOfOrigin: data.row.placeOfOrigin || '',
        color: data.row.color || '',
        imageUrls: [...(data.row.imageUrls || [])],
        description: data.row.description || '',
        status: data.row.status,
        sort: data.row.sort
      })
    else form.model.categoryId = data.presetCategoryId
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑物料信息' : '新增物料信息',
      subtitle: '维护物料编码、分类、规格、单位和来源',
      confirmText: '保存物料信息',
      contentMaxHeight: '74vh',
      onOpen: async (_openData, api) => {
        api.setLoading(true)
        try {
          await Promise.all(
            ['commonEnabledStatus', 'mdmMaterialSource'].map((code) =>
              userStore.ensureDictLoaded(code)
            )
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
