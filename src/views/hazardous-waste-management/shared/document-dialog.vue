<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="hazardous-document-dialog__intro"
      ><ArtSvgIcon
        :icon="direction === 'inbound' ? 'ri:inbox-archive-line' : 'ri:send-plane-line'"
      /><div
        ><strong>建立{{ businessName }}草稿</strong
        ><p>单据编号保存时按月自动生成 3 位流水码；审核通过后计入仓库库存。</p></div
      ></div
    >
    <ArtForm
      ref="formRef"
      v-model="form.model"
      :items="formItems"
      :rules="form.rules"
      :span="8"
      :gutter="16"
      label-position="top"
    >
    </ArtForm>
    <ArtSectionCard title="危废明细" subtitle="数量必须大于 0，生产日期为必填项。">
      <template #actions
        ><ArtTableMultipleSelect
          v-model="selection.catalogIds"
          :selected-data="selection.catalog"
          :api-fn="fetchCatalogOptions"
          :columns="catalogColumns"
          row-key="id"
          label-key="wasteName"
          description-key="wasteCode"
          title="选择危废名录"
          subtitle="支持一次选择多条启用的危废名录"
          placeholder="新增明细"
          search-placeholder="搜索危废编号或名称"
          empty-text="暂无可选危废名录"
          @update:selected-data="handleCatalogChange"
      /></template>
      <ArtTable
        ref="detailTableRef"
        :data="form.model.items"
        :columns="detailColumns"
        :pagination="false"
        row-key="catalogId"
        table-layout="fixed"
        empty-text="暂无危废明细"
        empty-description="点击新增明细，从危废名录选择本次办理的危废。"
      />
    </ArtSectionCard>
  </ArtDialog>
</template>
<script setup lang="tsx">
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import dayjs from 'dayjs'
  import { ElButton, ElDatePicker, ElInput, ElInputNumber, type FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import type { ArtTableExpose } from '@/components/core/tables/art-table/index.vue'
  import ArtTableMultipleSelect from '@/components/core/forms/art-data-select/table-multiple.vue'
  import type {
    DataSelectColumn,
    DataSelectFetchParams,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { ColumnOption } from '@/types'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchHazardousWasteCatalogList,
    fetchHazardousWasteWarehouseList,
    saveHazardousWasteDocument,
    type SmisHazardousWasteCatalogItem,
    type SmisHazardousWasteDocument,
    type SmisHazardousWasteDocumentDirection,
    type SmisHazardousWasteDocumentItem,
    type SmisHazardousWasteWarehouse
  } from '@smis/api'
  export interface DocumentDialogOpenData {
    row?: SmisHazardousWasteDocument
  }
  interface FormModel {
    id?: string
    documentNo: string
    operationDate: string
    warehouseId: string
    handlerEmployeeId: string
    transferOrderNo: string
    outboundReason: string
    description: string
    items: SmisHazardousWasteDocumentItem[]
  }
  const props = defineProps<{ direction: SmisHazardousWasteDocumentDirection }>()
  const emit = defineEmits<{ success: [] }>()
  const direction = toRef(props, 'direction')
  const businessName = computed(() => (direction.value === 'inbound' ? '危废入库' : '危废出库'))
  const dialogRef = ref<ArtDialogExpose<DocumentDialogOpenData>>()
  const formRef = ref<{ validate: () => Promise<boolean>; clearValidate: () => void }>()
  const detailTableRef = ref<ArtTableExpose>()
  const userStore = useUserStore()
  const { getUserInfo } = storeToRefs(userStore)
  const initial = (): FormModel => ({
    id: undefined,
    documentNo: '',
    operationDate: dayjs().format('YYYY-MM-DD'),
    warehouseId: '',
    handlerEmployeeId: getUserInfo.value.hrEmployeeId || '',
    transferOrderNo: '',
    outboundReason: '',
    description: '',
    items: []
  })
  const model = reactive<FormModel>(initial())
  const form = reactive<{ model: FormModel; rules: FormRules<FormModel> }>({
    model,
    rules: {
      operationDate: [{ required: true, message: '请选择业务日期', trigger: 'change' }],
      warehouseId: [{ required: true, message: '请选择入出库仓库', trigger: 'change' }],
      handlerEmployeeId: [{ required: true, message: '请选择经办人', trigger: 'change' }]
    }
  })
  const selection = reactive<{
    warehouse: SmisHazardousWasteWarehouse[]
    handler: EmployeeIntegrationItem[]
    catalogIds: string[]
    catalog: SmisHazardousWasteCatalogItem[]
  }>({ warehouse: [], handler: [], catalogIds: [], catalog: [] })
  const formItems = computed<FormItem[]>(() => [
    {
      label: '单据编号',
      key: 'documentNo',
      type: 'input',
      props: { disabled: true, placeholder: '保存时自动生成' }
    },
    {
      label: direction.value === 'inbound' ? '入库日期' : '出库日期',
      key: 'operationDate',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', class: '!w-full' }
    },
    {
      label: '入出库仓库',
      key: 'warehouseId',
      type: 'dataSelect',
      get props(): FormItem['props'] {
        return {
          mode: 'table',
          multiple: false,
          showSelectedPanel: false,
          selectedData: selection.warehouse,
          apiFn: fetchWarehouseOptions,
          showPagination: true,
          columns: warehouseColumns,
          rowKey: 'id',
          labelKey: 'warehouseName',
          descriptionKey: 'warehouseCode',
          title: '选择入出库仓库',
          subtitle: '仅显示已启用的危废仓库',
          placeholder: '请选择仓库',
          searchPlaceholder: '搜索仓库名称或编号',
          emptyText: '暂无可用危废仓库',
          'onUpdate:selectedData': ($event: unknown) => {
            selection.warehouse = $event as SmisHazardousWasteWarehouse[]
          }
        }
      }
    },
    {
      label: '经办人',
      key: 'handlerEmployeeId',
      type: 'employeeSelect',
      get props(): FormItem['props'] {
        return {
          selectedData: selection.handler,
          title: '选择经办人',
          subtitle: '数据来源为当前租户员工花名册',
          placeholder: '请选择经办人',
          'onUpdate:selectedData': ($event: typeof selection.handler) => {
            selection.handler = $event
          }
        }
      }
    },
    ...(direction.value === 'outbound'
      ? ([
          {
            label: '转移联单号',
            key: 'transferOrderNo',
            type: 'input',
            props: { maxlength: 80, clearable: true }
          },
          {
            label: '出库原因',
            key: 'outboundReason',
            type: 'input',
            props: { maxlength: 200, clearable: true }
          }
        ] as FormItem[])
      : []),
    {
      label: '业务说明',
      key: 'description',
      type: 'input',
      span: direction.value === 'inbound' ? 16 : 24,
      props: { maxlength: 500, clearable: true, placeholder: '补充来源、去向或交接说明' }
    }
  ])
  const warehouseColumns: DataSelectColumn[] = [
    { prop: 'warehouseName', label: '仓库名称', minWidth: 180 },
    { prop: 'warehouseCode', label: '仓库编号', width: 140 },
    { prop: 'keeperEmployeeName', label: '库管员', width: 120 }
  ]
  const catalogColumns: DataSelectColumn[] = [
    { prop: 'wasteName', label: '危废名称', minWidth: 180 },
    { prop: 'wasteCode', label: '危废编号', width: 140 },
    {
      prop: 'category',
      label: '危废分类',
      minWidth: 140,
      formatter: (row) => (row as SmisHazardousWasteCatalogItem).category.categoryName
    },
    { prop: 'unit', label: '单位', width: 80 }
  ]
  const detailColumns: ColumnOption<SmisHazardousWasteDocumentItem>[] = [
    {
      prop: 'wasteName',
      label: '危废信息',
      minWidth: 210,
      formatter: (row) => (
        <div class="hazardous-document-dialog__waste">
          <strong>{row.wasteName}</strong>
          <small>
            {row.wasteCode} · {row.categoryName}
          </small>
        </div>
      )
    },
    {
      prop: 'hazardCharacteristic',
      label: '危险特性',
      minWidth: 120,
      dict: { code: 'smisHazardousWasteCharacteristic', display: 'tag' }
    },
    {
      prop: 'quantity',
      label: '数量',
      width: 150,
      required: true,
      rules: {
        validator: ({ value }) => Number(value) > 0,
        message: ({ rowIndex }) => `第 ${rowIndex + 1} 行危废数量必须大于 0`
      },
      formatter: (row) => (
        <ElInputNumber
          v-model={row.quantity}
          min={0.001}
          precision={3}
          controlsPosition="right"
          class="!w-full"
        />
      )
    },
    {
      prop: 'unit',
      label: '单位',
      width: 88,
      align: 'center',
      dict: { code: 'smisMaterialUnit', display: 'text' }
    },
    {
      prop: 'productionDate',
      label: '生产日期',
      width: 160,
      required: true,
      formatter: (row) => (
        <ElDatePicker
          v-model={row.productionDate}
          valueFormat="YYYY-MM-DD"
          type="date"
          class="!w-full"
        />
      )
    },
    {
      prop: 'remark',
      label: '备注',
      minWidth: 160,
      formatter: (row) => <ElInput v-model={row.remark} maxlength={500} placeholder="选填" />
    },
    {
      prop: 'operation',
      label: '操作',
      width: 72,
      fixed: 'right',
      formatter: (row) => (
        <ElButton link type="danger" onClick={() => removeItem(row.catalogId)}>
          移除
        </ElButton>
      )
    }
  ]
  const fetchWarehouseOptions = async (params: DataSelectFetchParams) => {
    const result = await fetchHazardousWasteWarehouseList(
      {
        keyword: params.keyword,
        status: 'enabled',
        ...buildSupabasePageRange({ current: params.page, size: params.pageSize })
      },
      { showErrorMessage: false }
    )
    return result
  }
  const fetchCatalogOptions = async (params: DataSelectFetchParams) => {
    return fetchHazardousWasteCatalogList(
      {
        keyword: params.keyword,
        status: 'enabled',
        ...buildSupabasePageRange({ current: params.page, size: params.pageSize })
      },
      { showErrorMessage: false }
    )
  }
  const toItem = (item: SmisHazardousWasteCatalogItem): SmisHazardousWasteDocumentItem => ({
    catalogId: item.id,
    categoryName: item.category.categoryName,
    wasteCode: item.wasteCode,
    wasteName: item.wasteName,
    hazardCharacteristic: item.hazardCharacteristic,
    unit: item.unit,
    quantity: 1,
    productionDate: dayjs().format('YYYY-MM-DD'),
    remark: ''
  })
  const handleCatalogChange = (rows: DataSelectRecord[]): void => {
    const catalog = rows as SmisHazardousWasteCatalogItem[]
    const existing = new Map(model.items.map((item) => [item.catalogId, item]))
    selection.catalog = catalog
    model.items = catalog.map((item) => existing.get(item.id) ?? toItem(item))
  }
  const removeItem = (id: string): void => {
    model.items = model.items.filter((item) => item.catalogId !== id)
    selection.catalogIds = selection.catalogIds.filter((item) => item !== id)
    selection.catalog = selection.catalog.filter((item) => item.id !== id)
  }
  const employeeSnapshot = (id: string, no: string, name: string): EmployeeIntegrationItem => ({
    id,
    tenantId: getUserInfo.value.tenantId || '',
    employeeNo: no,
    employeeName: name,
    employmentStatus: 'active'
  })
  const catalogSnapshot = (
    item: SmisHazardousWasteDocumentItem
  ): SmisHazardousWasteCatalogItem => ({
    id: item.catalogId,
    tenantId: '',
    categoryId: '',
    category: { id: '', categoryCode: '', categoryName: item.categoryName },
    wasteCode: item.wasteCode,
    wasteName: item.wasteName,
    hazardCharacteristic: item.hazardCharacteristic,
    unit: item.unit,
    sort: 0,
    tagStyle: '',
    status: 'enabled',
    createTime: '',
    updateTime: ''
  })
  const reset = async () => {
    Object.assign(model, initial())
    selection.warehouse = []
    selection.handler = getUserInfo.value.hrEmployee
      ? [
          {
            ...getUserInfo.value.hrEmployee,
            tenantId: getUserInfo.value.tenantId || '',
            employmentStatus: 'active'
          }
        ]
      : []
    selection.catalogIds = []
    selection.catalog = []
    await nextTick()
    formRef.value?.clearValidate()
  }
  const initialize = (row: SmisHazardousWasteDocument) => {
    Object.assign(model, {
      id: row.id,
      documentNo: row.documentNo,
      operationDate: row.operationDate,
      warehouseId: row.warehouseId,
      handlerEmployeeId: row.handlerEmployeeId,
      transferOrderNo: row.transferOrderNo || '',
      outboundReason: row.outboundReason || '',
      description: row.description || '',
      items: row.items.map((item) => ({ ...item }))
    })
    selection.warehouse = [
      {
        id: row.warehouseId,
        tenantId: row.tenantId,
        warehouseCode: '',
        warehouseName: row.warehouseName,
        sort: 0,
        tagStyle: '',
        status: 'enabled',
        regionPath: [],
        createTime: '',
        updateTime: ''
      }
    ]
    selection.handler = [
      employeeSnapshot(row.handlerEmployeeId, row.handlerEmployeeNo, row.handlerEmployeeName)
    ]
    selection.catalogIds = row.items.map((item) => item.catalogId)
    selection.catalog = row.items.map(catalogSnapshot)
  }
  const submit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (!model.items.length) {
        ElMessage.warning('请至少添加一条危废明细')
        return false
      }
      const tableValidation = await detailTableRef.value?.validate()
      if (tableValidation?.valid === false) {
        return false
      }
      await saveHazardousWasteDocument(direction.value, {
        id: model.id,
        operationDate: model.operationDate,
        warehouseId: model.warehouseId,
        handlerEmployeeId: model.handlerEmployeeId,
        transferOrderNo: normalizeNullableText(model.transferOrderNo),
        outboundReason: normalizeNullableText(model.outboundReason),
        description: normalizeNullableText(model.description),
        items: model.items.map(({ catalogId, quantity, productionDate, remark }) => ({
          catalogId,
          quantity,
          productionDate,
          remark: normalizeNullableText(remark)
        }))
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '危废单据保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: DocumentDialogOpenData) => {
    await reset()
    if (data.row) initialize(data.row)
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? `编辑${businessName.value}` : `新增${businessName.value}`,
      subtitle: '维护仓库、经办人和危废明细',
      confirmText: '保存草稿',
      contentMaxHeight: '78vh',
      loading: true,
      loadingText: '正在加载计量单位…',
      onOpen: async (_openData, api) => {
        try {
          await userStore.ensureDictLoaded('smisMaterialUnit')
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: submit
    })
  }
  defineExpose({ handleOpen })
</script>
<style scoped lang="scss">
  .hazardous-document-dialog {
    &__intro {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: var(--art-gray-100);
      border-radius: var(--el-border-radius-base);

      > svg {
        flex: 0 0 auto;
        margin-top: 2px;
        font-size: 22px;
        color: var(--theme-color);
      }

      p {
        margin: 4px 0 0;
        color: var(--art-gray-700);
      }
    }

    &__waste {
      display: grid;
      min-width: 0;

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }
  }
</style>
