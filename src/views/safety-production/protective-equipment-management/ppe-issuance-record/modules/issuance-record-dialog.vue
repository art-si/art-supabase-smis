<template>
  <ArtDialog ref="dialogRef" size="xl">
    <ArtEntitySummary
      title="建立发放草稿"
      description="单据编号由系统按月生成 4 位流水码；完成核对后再执行发放过账。"
      icon="ri:archive-drawer-line"
      compact
      spaced
    />
    <ArtForm
      ref="formRef"
      v-model="form.model"
      :rules="form.rules"
      :items="formItems"
      :span="8"
      :gutter="16"
      label-position="top"
      :show-submit="false"
      :show-reset="false"
    >
      <template #employeeId>
        <ArtEmployeeSelect
          v-model="form.model.employeeId"
          :selected-data="selection.employee"
          @update:selected-data="selection.employee = $event"
        />
      </template>
      <template #warehouseId>
        <ArtTableSingleSelect
          v-model="form.model.warehouseId"
          :selected-data="selection.warehouse"
          :api-fn="fetchWarehouseOptions"
          :columns="warehouseColumns"
          row-key="id"
          label-key="locationName"
          description-key="locationCode"
          title="选择发放仓库"
          subtitle="仅显示当前租户已启用的仓库或存放位置"
          placeholder="请选择发放仓库"
          search-placeholder="搜索仓库名称或编码"
          empty-text="暂无可用仓库"
          empty-description="当前租户没有启用的仓库或存放位置，请先维护仓储位置。"
          @update:selected-data="selection.warehouse = $event"
        >
          <template #empty>
            <SmisDataSourceEmptyActions source="storage-location" />
          </template>
        </ArtTableSingleSelect>
      </template>
      <template #issuerEmployeeId>
        <ArtEmployeeSelect
          v-model="form.model.issuerEmployeeId"
          :selected-data="selection.issuer"
          title="选择发放人"
          subtitle="默认当前登录账号关联员工，可从员工花名册修改"
          placeholder="请选择发放人"
          @update:selected-data="selection.issuer = $event"
        />
      </template>
    </ArtForm>

    <ArtSectionCard
      title="防护用品明细"
      subtitle="发放数量必须大于 0；物料信息来自防护用品主数据。"
    >
      <template #actions>
        <ArtTableMultipleSelect
          v-model="selection.materialIds"
          :selected-data="selection.materials"
          :api-fn="fetchMaterialOptions"
          :columns="materialColumns"
          row-key="id"
          label-key="materialName"
          description-key="materialCode"
          title="选择防护用品"
          subtitle="支持一次选择多条防护用品明细"
          placeholder="新增明细"
          search-placeholder="搜索物料名称或编码"
          empty-text="暂无可选防护用品"
          empty-description="当前租户没有匹配的启用防护用品，请在物料信息中新增或调整物料类型。"
          @update:selected-data="handleMaterialsChange"
        >
          <template #empty>
            <SmisDataSourceEmptyActions source="material" />
          </template>
        </ArtTableMultipleSelect>
      </template>
      <ArtTable
        ref="detailTableRef"
        :data="form.model.items"
        :columns="detailColumns"
        :pagination="false"
        row-key="materialId"
        table-layout="fixed"
        empty-text="暂无发放明细"
        empty-description="点击新增明细选择需要发放的防护用品。"
      />
    </ArtSectionCard>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import dayjs from 'dayjs'
  import { ElButton, ElInput, ElInputNumber, type FormRules } from 'element-plus'
  import {
    createIssuanceEmployeeSnapshot,
    createIssuanceRecordEditState,
    type IssuanceRecordFormModel,
    type IssuanceRecordSelectionState
  } from '../../../issuance-record-model'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtTableMultipleSelect from '@/components/core/forms/art-data-select/table-multiple.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import type { ArtTableExpose } from '@/components/core/tables/art-table/index.vue'
  import type {
    DataSelectColumn,
    DataSelectFetchParams
  } from '@/components/core/forms/art-data-select/types'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import type { ColumnOption } from '@/types'
  import SmisDataSourceEmptyActions from '@smis/views/components/smis-data-source-empty-actions.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchMaterialList,
    fetchStorageLocationList,
    savePpeIssuanceRecord,
    type SmisMaterial,
    type SmisPpeIssuanceRecord,
    type SmisPpeIssuanceRecordItem,
    type SmisStorageLocation
  } from '@smis/api'

  interface OpenData {
    mode: 'add' | 'edit' | 'copy'
    row?: SmisPpeIssuanceRecord
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<OpenData>>()
  const formRef = ref<{ validate: () => Promise<boolean>; clearValidate: () => void }>()
  const detailTableRef = ref<ArtTableExpose>()
  const userStore = useUserStore()
  const { getUserInfo } = storeToRefs(userStore)

  const createInitialForm = (): IssuanceRecordFormModel => ({
    id: undefined,
    issuanceNo: '',
    employeeId: undefined,
    warehouseId: undefined,
    issuerEmployeeId: getUserInfo.value.hrEmployeeId || undefined,
    issueDate: dayjs().format('YYYY-MM-DD'),
    remark: '',
    items: []
  })

  const form = reactive<{
    model: IssuanceRecordFormModel
    rules: FormRules<IssuanceRecordFormModel>
  }>({
    model: createInitialForm(),
    rules: {
      employeeId: [{ required: true, message: '请选择领用人', trigger: 'change' }],
      warehouseId: [{ required: true, message: '请选择发放仓库', trigger: 'change' }],
      issuerEmployeeId: [{ required: true, message: '请选择发放人', trigger: 'change' }],
      issueDate: [{ required: true, message: '请选择发放日期', trigger: 'change' }]
    }
  })
  const selection = reactive<IssuanceRecordSelectionState>({
    employee: [],
    issuer: [],
    warehouse: [],
    materialIds: [],
    materials: []
  })
  const formItems = computed<FormItem[]>(() => [
    {
      label: '单据编号',
      key: 'issuanceNo',
      type: 'input',
      props: { disabled: true, placeholder: '保存时自动生成' }
    },
    { label: '领用人', key: 'employeeId', type: 'input' },
    {
      label: '发放日期',
      key: 'issueDate',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', placeholder: '请选择发放日期', class: '!w-full' }
    },
    { label: '发放仓库', key: 'warehouseId', type: 'input' },
    { label: '发放人', key: 'issuerEmployeeId', type: 'input' },
    {
      label: '备注',
      key: 'remark',
      type: 'input',
      props: { maxlength: 1000, showWordLimit: true, placeholder: '补充班组领用、异常更换等说明' }
    }
  ])
  const detailColumns: ColumnOption<SmisPpeIssuanceRecordItem>[] = [
    {
      prop: 'materialName',
      label: '物料信息',
      minWidth: 220,
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.materialName}
          secondary={row.materialCategory || '未分类'}
        />
      )
    },
    { prop: 'specificationModel', label: '规格型号', minWidth: 140, showOverflowTooltip: true },
    {
      prop: 'unit',
      label: '计量单位',
      width: 96,
      align: 'center',
      dict: { code: 'smisMaterialUnit', display: 'text' }
    },
    {
      prop: 'issueQuantity',
      label: '发放数量',
      required: true,
      requiredMessage: ({ rowIndex }) => `第 ${rowIndex + 1} 行发放数量必须大于 0`,
      rules: [
        {
          validator: ({ value }) => Number(value) > 0,
          message: ({ rowIndex }) => `第 ${rowIndex + 1} 行发放数量必须大于 0`
        }
      ],
      width: 160,
      formatter: (row) => (
        <ElInputNumber
          v-model={row.issueQuantity}
          min={0.001}
          precision={3}
          controlsPosition="right"
          class="!w-full"
        />
      )
    },
    {
      prop: 'remark',
      label: '备注',
      minWidth: 170,
      formatter: (row) => <ElInput v-model={row.remark} maxlength={500} placeholder="选填" />
    },
    {
      prop: 'operation',
      label: '操作',
      width: 76,
      fixed: 'right',
      align: 'center',
      formatter: (row) => (
        <ElButton link type="danger" onClick={() => removeMaterial(row.materialId)}>
          移除
        </ElButton>
      )
    }
  ]

  const warehouseColumns: DataSelectColumn[] = [
    { prop: 'locationName', label: '仓库 / 存放位置', minWidth: 180 },
    { prop: 'locationCode', label: '位置编码', width: 140 },
    {
      prop: 'organization',
      label: '所属组织',
      minWidth: 160,
      formatter: (row) => (row as SmisStorageLocation).organization?.organizationName || '—'
    }
  ]
  const materialColumns: DataSelectColumn<SmisMaterial>[] = [
    { prop: 'materialName', label: '物料名称', minWidth: 180 },
    { prop: 'materialCode', label: '物料编码', width: 150 },
    { prop: 'specificationModel', label: '规格型号', minWidth: 150 },
    {
      prop: 'basicUnit',
      label: '计量单位',
      width: 96,
      dict: { code: 'smisMaterialUnit', display: 'text' }
    }
  ]

  const fetchWarehouseOptions = async (params: DataSelectFetchParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.page, size: params.pageSize })
    const result = await fetchStorageLocationList(
      {
        keyword: params.keyword,
        status: 'enabled',
        from,
        to
      },
      { showErrorMessage: false }
    )
    return result
  }

  const fetchMaterialOptions = async (params: DataSelectFetchParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.page, size: params.pageSize })
    const result = await fetchMaterialList(
      {
        materialName: params.keyword,
        materialType: 'protective_equipment',
        status: 'enabled',
        from,
        to
      },
      { showErrorMessage: false }
    )
    return result
  }

  const handleMaterialsChange = (materials: SmisMaterial[]): void => {
    const existing = new Map(form.model.items.map((item) => [item.materialId, item]))
    selection.materials = materials
    form.model.items = materials.map(
      (material) =>
        existing.get(String(material.id)) ?? {
          materialId: String(material.id),
          materialCategory: material.category.categoryName,
          materialName: material.materialName,
          specificationModel: material.specificationModel,
          unit: material.basicUnit,
          issueQuantity: 1,
          remark: ''
        }
    )
  }

  const removeMaterial = (materialId: string): void => {
    form.model.items = form.model.items.filter((item) => item.materialId !== materialId)
    selection.materialIds = selection.materialIds.filter((id) => id !== materialId)
    selection.materials = selection.materials.filter((item) => item.id !== materialId)
  }

  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, createInitialForm())
    selection.employee = []
    selection.issuer = getUserInfo.value.hrEmployee
      ? [
          createIssuanceEmployeeSnapshot(
            getUserInfo.value.tenantId || '',
            getUserInfo.value.hrEmployee.id,
            getUserInfo.value.hrEmployee.employeeNo,
            getUserInfo.value.hrEmployee.employeeName,
            getUserInfo.value.hrEmployee.jobTitle
          )
        ]
      : []
    selection.warehouse = []
    selection.materialIds = []
    selection.materials = []
    await nextTick()
    formRef.value?.clearValidate()
    detailTableRef.value?.clearValidate()
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (!form.model.items.length) {
        ElMessage.warning('请至少添加一条防护用品明细')
        return false
      }
      const tableValidation = await detailTableRef.value?.validate()
      if (tableValidation && !tableValidation.valid) {
        return false
      }
      await savePpeIssuanceRecord({
        id: form.model.id,
        employeeId: String(form.model.employeeId),
        warehouseId: String(form.model.warehouseId),
        issuerEmployeeId: String(form.model.issuerEmployeeId),
        issueDate: form.model.issueDate,
        remark: form.model.remark || null,
        items: form.model.items.map((item) => ({
          requisitionItemId: item.requisitionItemId,
          materialId: item.materialId,
          issueQuantity: item.issueQuantity,
          remark: item.remark
        }))
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '领用记录保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: OpenData): Promise<void> => {
    await resetForm()
    if (data.row) {
      const state = createIssuanceRecordEditState(data.row, {
        copy: data.mode === 'copy',
        today: dayjs().format('YYYY-MM-DD'),
        materialType: 'protective_equipment'
      })
      Object.assign(form.model, state.form)
      Object.assign(selection, state.selection)
    }
    await dialogRef.value?.handleOpen(data, {
      title:
        data.mode === 'edit'
          ? '编辑防护用品发放记录'
          : data.mode === 'copy'
            ? '复制并新增防护用品发放记录'
            : '新增防护用品发放记录',
      subtitle: '维护领用人、发放仓库、发放人及用品明细',
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
      onConfirm: handleSubmit
    })
  }

  defineExpose({ handleOpen })
</script>
