<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="requisition-push__summary">
      <div>
        <span>本次领用人</span>
        <strong>{{ rows[0]?.employeeName || '—' }}</strong>
        <small>{{ rows[0]?.employeeNo }} · {{ rows[0]?.organizationName || '未分配组织' }}</small>
      </div>
      <div>
        <span>选中明细</span>
        <strong>{{ rows.length }} 项</strong>
        <small>过账后生成月度流水发放单号</small>
      </div>
    </div>
    <ArtForm
      ref="formRef"
      v-model="form.model"
      :rules="form.rules"
      :items="formItems"
      :span="8"
      :gutter="16"
      label-position="top"
    >
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

    <ArtSectionCard title="本次发放明细" subtitle="可按实发情况调整发放数量，确认后一次过账。">
      <ArtTable
        ref="detailTableRef"
        :data="rows"
        :columns="detailColumns"
        :pagination="false"
        row-key="id"
        table-layout="fixed"
      />
    </ArtSectionCard>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import dayjs from 'dayjs'
  import { ElInputNumber, type FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
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
    fetchStorageLocationList,
    pushPpeRequisitionItems,
    type SmisPpePersonalRequisitionItem,
    type SmisStorageLocation
  } from '@smis/api'

  interface FormModel {
    warehouseId?: string
    issuerEmployeeId?: string
    issueDate: string
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<SmisPpePersonalRequisitionItem[]>>()
  const formRef = ref<{ validate: () => Promise<boolean>; clearValidate: () => void }>()
  const detailTableRef = ref<ArtTableExpose>()
  const rows = ref<SmisPpePersonalRequisitionItem[]>([])
  const userStore = useUserStore()
  const { getUserInfo } = storeToRefs(userStore)
  const form = reactive<{ model: FormModel; rules: FormRules<FormModel> }>({
    model: {
      warehouseId: undefined,
      issuerEmployeeId: undefined,
      issueDate: dayjs().format('YYYY-MM-DD')
    },
    rules: {
      warehouseId: [{ required: true, message: '请选择发放仓库', trigger: 'change' }],
      issuerEmployeeId: [{ required: true, message: '请选择发放人', trigger: 'change' }],
      issueDate: [{ required: true, message: '请选择发放日期', trigger: 'change' }]
    }
  })
  const selection = reactive<{
    warehouse: SmisStorageLocation[]
    issuer: EmployeeIntegrationItem[]
  }>({ warehouse: [], issuer: [] })
  const formItems: FormItem[] = [
    { label: '发放仓库', key: 'warehouseId', type: 'input' },
    { label: '发放人', key: 'issuerEmployeeId', type: 'input' },
    {
      label: '发放日期',
      key: 'issueDate',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', placeholder: '请选择发放日期', class: '!w-full' }
    }
  ]
  const detailColumns: ColumnOption<SmisPpePersonalRequisitionItem>[] = [
    { prop: 'requisitionNo', label: '个人领用单号', width: 150 },
    { prop: 'materialName', label: '防护用品', minWidth: 170, showOverflowTooltip: true },
    { prop: 'specificationModel', label: '规格型号', minWidth: 130, showOverflowTooltip: true },
    { prop: 'quotaQuantity', label: '定额数量', width: 100, align: 'right' },
    {
      prop: 'requestedQuantity',
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
          v-model={row.requestedQuantity}
          min={0.001}
          precision={3}
          controlsPosition="right"
          class="!w-full"
        />
      )
    },
    {
      prop: 'unit',
      label: '计量单位',
      width: 96,
      align: 'center',
      dict: { code: 'smisMaterialUnit', display: 'text' }
    }
  ]

  const warehouseColumns: DataSelectColumn[] = [
    { prop: 'locationName', label: '仓库 / 存放位置', minWidth: 180 },
    { prop: 'locationCode', label: '位置编码', width: 140 },
    { prop: 'detailLocation', label: '详细位置', minWidth: 160 }
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
  const currentIssuer = (): EmployeeIntegrationItem[] =>
    getUserInfo.value.hrEmployee
      ? [
          {
            id: getUserInfo.value.hrEmployee.id,
            tenantId: getUserInfo.value.tenantId || '',
            employeeNo: getUserInfo.value.hrEmployee.employeeNo,
            employeeName: getUserInfo.value.hrEmployee.employeeName,
            jobTitle: getUserInfo.value.hrEmployee.jobTitle,
            employmentStatus: getUserInfo.value.hrEmployee.employmentStatus
          }
        ]
      : []

  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, {
      warehouseId: undefined,
      issuerEmployeeId: getUserInfo.value.hrEmployeeId || undefined,
      issueDate: dayjs().format('YYYY-MM-DD')
    })
    selection.warehouse = []
    selection.issuer = currentIssuer()
    rows.value = []
    await nextTick()
    formRef.value?.clearValidate()
    detailTableRef.value?.clearValidate()
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const tableValidation = await detailTableRef.value?.validate()
      if (tableValidation && !tableValidation.valid) {
        return false
      }
      await pushPpeRequisitionItems(
        rows.value.map((row) => ({ id: row.id, issueQuantity: row.requestedQuantity })),
        String(form.model.warehouseId),
        String(form.model.issuerEmployeeId),
        form.model.issueDate
      )
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '领用单推送失败，请稍后重试')
      return false
    }
  }

  const handleOpen = async (selectedRows: SmisPpePersonalRequisitionItem[]): Promise<void> => {
    await resetForm()
    rows.value = selectedRows.map((row) => ({ ...row }))
    await dialogRef.value?.handleOpen(selectedRows, {
      title: '下推并发放防护用品',
      subtitle: '同一领用人的多条领用明细将合并生成一张发放单',
      confirmText: '确认发放并过账',
      contentMaxHeight: '72vh',
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

<style scoped lang="scss">
  .requisition-push {
    &__summary {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;

      > div {
        display: flex;
        flex-direction: column;
        min-width: 0;
        padding: 12px 16px;
        background: var(--art-gray-100);
        border-radius: var(--el-border-radius-base);
      }

      span,
      small {
        color: var(--art-gray-700);
      }

      strong {
        margin: 4px 0;
        color: var(--art-gray-900);
      }
    }

    @media (width <= 820px) {
      &__summary {
        grid-template-columns: 1fr;
      }
    }
  }
</style>
