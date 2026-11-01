<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="hazardous-warehouse-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:archive-drawer-line" /></template>
        <strong>建立危废库房责任边界</strong>
        <p>库管员与负责人均来自员工花名册；停用仓库保留历史单据，但不能再用于新增入出库。</p>
      </ArtEntitySummary>

      <ArtForm
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
            :preview-text="form.model.warehouseName || '仓库标签预览'"
          />
        </template>
        <template #addressPicker>
          <ArtAddressPicker
            v-model:region-path="form.model.regionPath"
            v-model:region-adcode="form.model.regionAdcode"
            v-model:address-detail="form.model.addressDetail"
            :region-api="fetchRegionOptions"
            :show-coordinate-hint="false"
            region-label="库房区域"
            detail-label="详细地址"
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
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import { fetchRegionOptions } from '@/api/region-options'
  import ArtAddressPicker from '@/components/core/forms/art-address-picker/index.vue'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import DisplayStyleField from '../../shared/display-style-field.vue'
  import {
    saveHazardousWasteWarehouse,
    type SmisHazardousWasteWarehouse,
    type SmisHazardousWasteWarehouseSavePayload
  } from '@smis/api'

  export interface WarehouseDialogOpenData {
    row?: SmisHazardousWasteWarehouse
  }
  interface WarehouseForm extends Omit<
    SmisHazardousWasteWarehouseSavePayload,
    'keeperEmployeeId' | 'responsibleEmployeeId' | 'regionAdcode' | 'addressDetail'
  > {
    keeperEmployeeId?: string
    responsibleEmployeeId?: string
    regionAdcode?: string
    addressDetail?: string
    presentation?: undefined
    addressPicker?: undefined
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<WarehouseDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const selection = reactive<{
    keeper: EmployeeIntegrationItem[]
    responsible: EmployeeIntegrationItem[]
  }>({ keeper: [], responsible: [] })

  const initialForm = (): WarehouseForm => ({
    id: undefined,
    warehouseCode: '',
    warehouseName: '',
    sort: 10,
    textColor: null,
    tagStyle: '',
    status: 'enabled',
    keeperEmployeeId: undefined,
    responsibleEmployeeId: undefined,
    regionPath: [],
    regionAdcode: undefined,
    addressDetail: '',
    remark: '',
    presentation: undefined,
    addressPicker: undefined
  })
  const tagStyleOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.smisTagStyle ?? []).map(toDictionaryOption)
  )
  const statusOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.commonEnabledDisabledStatus ?? []).map(toDictionaryOption)
  )
  const form = reactive<{
    model: WarehouseForm
    items: ComputedRef<FormItem[]>
    rules: FormRules<WarehouseForm>
  }>({
    model: initialForm(),
    items: computed(() => [
      {
        label: '仓库编号',
        key: 'warehouseCode',
        type: 'input',
        props: { maxlength: 40, clearable: true, placeholder: '如 HW-WH-01' }
      },
      {
        label: '仓库名称',
        key: 'warehouseName',
        type: 'input',
        props: { maxlength: 100, clearable: true, placeholder: '如 危废暂存库' }
      },
      {
        label: '库管员',
        key: 'keeperEmployeeId',
        type: 'employeeSelect',
        get props(): FormItem['props'] {
          return {
            selectedData: selection.keeper,
            'onUpdate:selectedData': ($event: typeof selection.keeper) => {
              selection.keeper = $event
            },
            title: '选择库管员',
            subtitle: '按姓名、工号、组织或岗位检索当前租户员工花名册',
            placeholder: '点击从员工花名册选择'
          }
        }
      },
      {
        label: '负责人',
        key: 'responsibleEmployeeId',
        type: 'employeeSelect',
        get props(): FormItem['props'] {
          return {
            selectedData: selection.responsible,
            'onUpdate:selectedData': ($event: typeof selection.responsible) => {
              selection.responsible = $event
            },
            title: '选择仓库负责人',
            subtitle: '负责人承担危废仓库业务与合规责任',
            placeholder: '点击从员工花名册选择'
          }
        }
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
        options: statusOptions.value,
        props: { clearable: false }
      },
      { label: '显示效果', key: 'presentation', type: 'input', span: 24 },
      { label: '', key: 'addressPicker', type: 'input', span: 24, labelWidth: 0 },
      {
        label: '备注',
        key: 'remark',
        type: 'input',
        span: 24,
        props: {
          type: 'textarea',
          rows: 3,
          maxlength: 500,
          showWordLimit: true,
          resize: 'none',
          placeholder: '补充库房适用范围、容量或管理要求'
        }
      }
    ]),
    rules: {
      warehouseCode: [
        { required: true, message: '请输入仓库编号', trigger: 'blur' },
        {
          pattern: /^[A-Za-z][A-Za-z0-9_-]*$/,
          message: '须以字母开头，仅支持字母、数字、下划线和短横线',
          trigger: 'blur'
        }
      ],
      warehouseName: [{ required: true, message: '请输入仓库名称', trigger: 'blur' }],
      keeperEmployeeId: [{ required: true, message: '请选择库管员', trigger: 'change' }],
      responsibleEmployeeId: [{ required: true, message: '请选择负责人', trigger: 'change' }],
      status: [{ required: true, message: '请选择启用状态', trigger: 'change' }],
      sort: [{ required: true, message: '请输入显示顺序', trigger: 'change' }]
    }
  })

  const employeeReference = (
    id: string,
    no: string | null | undefined,
    name: string | null | undefined
  ): EmployeeIntegrationItem => ({
    id,
    tenantId: '',
    employeeNo: no || '',
    employeeName: name || '',
    employmentStatus: 'active'
  })
  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, initialForm())
    selection.keeper = []
    selection.responsible = []
    await nextTick()
    formRef.value?.clearValidate()
  }
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const {
        presentation: _presentation,
        addressPicker: _addressPicker,
        ...payload
      } = toRaw(form.model)
      void _presentation
      void _addressPicker
      await saveHazardousWasteWarehouse({
        ...payload,
        warehouseCode: payload.warehouseCode.trim().toUpperCase(),
        warehouseName: payload.warehouseName.trim(),
        textColor: payload.textColor || null,
        addressDetail: normalizeNullableText(payload.addressDetail),
        remark: normalizeNullableText(payload.remark)
      })
      emit('success', payload.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '危废仓库保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: WarehouseDialogOpenData): Promise<void> => {
    await resetForm()
    if (data.row) {
      Object.assign(form.model, {
        id: data.row.id,
        warehouseCode: data.row.warehouseCode,
        warehouseName: data.row.warehouseName,
        sort: data.row.sort,
        textColor: data.row.textColor || null,
        tagStyle: data.row.tagStyle,
        status: data.row.status,
        keeperEmployeeId: data.row.keeperEmployeeId || undefined,
        responsibleEmployeeId: data.row.responsibleEmployeeId || undefined,
        regionPath: [...(data.row.regionPath || [])],
        regionAdcode: data.row.regionAdcode || undefined,
        addressDetail: data.row.addressDetail || '',
        remark: data.row.remark || ''
      })
      if (data.row.keeperEmployeeId)
        selection.keeper = [
          employeeReference(
            data.row.keeperEmployeeId,
            data.row.keeperEmployeeNo,
            data.row.keeperEmployeeName
          )
        ]
      if (data.row.responsibleEmployeeId)
        selection.responsible = [
          employeeReference(
            data.row.responsibleEmployeeId,
            data.row.responsibleEmployeeNo,
            data.row.responsibleEmployeeName
          )
        ]
    }
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑危废仓库' : '新增危废仓库',
      subtitle: '维护仓库标识、责任人、地址和显示样式',
      confirmText: '保存仓库',
      contentMaxHeight: '76vh',
      loading: true,
      onOpen: async (_open, api) => {
        try {
          await Promise.all([
            userStore.ensureDictLoaded('commonEnabledDisabledStatus'),
            userStore.ensureDictLoaded('smisTagStyle')
          ])
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
