<template>
  <ArtDialog ref="dialogRef" size="xl" :loading="loading" loading-text="正在加载发放统计…">
    <ArtForm
      v-model="filter.model"
      :items="filterItems"
      :span="8"
      :gutter="16"
      label-position="top"
    >
    </ArtForm>
    <div class="issuance-statistics__filter-action">
      <ElButton @click="resetFilter">重置</ElButton>
      <ElButton type="primary" :loading="loading" @click="loadStatistics">查询统计</ElButton>
    </div>

    <div class="issuance-statistics__summary" aria-label="统计摘要">
      <div v-for="item in summaryItems" :key="item.label" class="issuance-statistics__metric">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small>{{ item.description }}</small>
      </div>
    </div>

    <ArtSectionCard
      title="组织与工器具发放汇总"
      subtitle="按所属组织、物料名称与规格型号汇总已过账发放数量。"
      :empty="!loading && !statistics.rows.length"
      empty-title="暂无统计数据"
      empty-description="调整领用时间、组织或领用人条件后重新查询。"
    >
      <ArtTable
        :data="statistics.rows"
        :columns="statisticsColumns"
        :pagination="false"
        table-layout="fixed"
        row-key="materialName"
      />
    </ArtSectionCard>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { h } from 'vue'
  import dayjs from 'dayjs'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import type { FormItem } from '@/components/core/forms/art-form/index.vue'
  import type { ColumnOption } from '@/types'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import SmisDataSourceEmptyActions from '@smis/views/components/smis-data-source-empty-actions.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchToolIssuanceStatistics,
    fetchToolScopeOptions,
    type SmisToolIssuanceStatistics,
    type SmisToolIssuanceStatisticsRow,
    type SmisToolScopeOption
  } from '@smis/api'

  interface FilterModel {
    dateRange: [string, string]
    organizationId?: string
    employeeId?: string
  }

  const dialogRef = ref<ArtDialogExpose>()
  const userStore = useUserStore()
  const loading = ref(false)
  const filter = reactive<{
    model: FilterModel
    organizations: SmisToolScopeOption[]
    employee: EmployeeIntegrationItem[]
  }>({
    model: {
      dateRange: [dayjs().startOf('month').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')]
    },
    organizations: [],
    employee: []
  })
  const statistics = reactive<SmisToolIssuanceStatistics>({
    summary: { documentCount: 0, employeeCount: 0, materialCount: 0, totalQuantity: 0 },
    rows: []
  })
  const filterItems: FormItem[] = [
    {
      label: '领用时间区间',
      key: 'dateRange',
      type: 'date',
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        class: '!w-full'
      }
    },
    {
      label: '组织名称',
      key: 'organizationId',
      type: 'dataSelect',
      get props(): FormItem['props'] {
        return {
          mode: 'tree',
          multiple: false,
          showSelectedPanel: false,
          showPagination: false,
          data: filter.organizations,
          rowKey: 'id',
          labelKey: 'name',
          childrenKey: 'children',
          title: '选择公司或部门',
          placeholder: '全部组织',
          emptyText: '暂无可选组织',
          emptyDescription: '请先在系统组织管理中维护当前租户的公司或部门。',
          clearable: true
        }
      },
      slots: { empty: () => h(SmisDataSourceEmptyActions, { source: 'organization' }) }
    },
    {
      label: '领用人',
      key: 'employeeId',
      type: 'employeeSelect',
      get props(): FormItem['props'] {
        return {
          selectedData: filter.employee,
          placeholder: '全部领用人',
          'onUpdate:selectedData': ($event: typeof filter.employee) => {
            filter.employee = $event
          }
        }
      }
    }
  ]
  const statisticsColumns: ColumnOption<SmisToolIssuanceStatisticsRow>[] = [
    { type: 'globalIndex', label: '序号', width: 64, align: 'center' },
    { prop: 'organizationName', label: '所属单位', minWidth: 200, showOverflowTooltip: true },
    { prop: 'materialName', label: '工器具', minWidth: 180, showOverflowTooltip: true },
    { prop: 'specificationModel', label: '规格型号', minWidth: 150, showOverflowTooltip: true },
    { prop: 'employeeCount', label: '领用人数', width: 110, align: 'right' },
    { prop: 'quantity', label: '发放数量', width: 120, align: 'right' },
    {
      prop: 'unit',
      label: '计量单位',
      width: 96,
      align: 'center',
      dict: { code: 'smisMaterialUnit', display: 'text' }
    }
  ]

  const summaryItems = computed(() => [
    { label: '发放单据', value: statistics.summary.documentCount, description: '已过账单据' },
    { label: '领用人数', value: statistics.summary.employeeCount, description: '去重员工数' },
    { label: '工器具种类', value: statistics.summary.materialCount, description: '物料 / 规格' },
    { label: '发放总量', value: statistics.summary.totalQuantity, description: '按明细数量合计' }
  ])

  const loadStatistics = async (): Promise<void> => {
    loading.value = true
    try {
      const result = await fetchToolIssuanceStatistics(filter.model)
      Object.assign(
        statistics,
        result.data ?? {
          summary: { documentCount: 0, employeeCount: 0, materialCount: 0, totalQuantity: 0 },
          rows: []
        }
      )
    } finally {
      loading.value = false
    }
  }

  const resetFilter = (): void => {
    Object.assign(filter.model, {
      dateRange: [dayjs().startOf('month').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
      organizationId: undefined,
      employeeId: undefined
    })
    filter.employee = []
    void loadStatistics()
  }

  const handleOpen = async (): Promise<void> => {
    await dialogRef.value?.handleOpen(undefined, {
      title: '工器具发放统计分析',
      subtitle: '按领用时间、组织和领用人分析已过账发放数据',
      showFooter: false,
      contentMaxHeight: '78vh',
      onOpen: async (_data, api) => {
        api.setLoading(true)
        try {
          const [organizations] = await Promise.all([
            fetchToolScopeOptions('organization'),
            userStore.ensureDictLoaded('smisMaterialUnit')
          ])
          filter.organizations = organizations.data
          await loadStatistics()
        } finally {
          api.setLoading(false)
        }
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .issuance-statistics {
    &__filter-action {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin: -4px 0 16px;
    }

    &__summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    &__metric {
      display: flex;
      flex-direction: column;
      min-width: 0;
      padding: 12px 16px;
      background: var(--art-gray-100);
      border-radius: var(--el-border-radius-base);

      span,
      small {
        color: var(--art-gray-700);
      }

      strong {
        margin: 4px 0;
        font-size: 24px;
        font-variant-numeric: tabular-nums;
        color: var(--art-gray-900);
      }
    }

    @media (width <= 900px) {
      &__summary {
        grid-template-columns: 1fr 1fr;
      }

      &__filter-action {
        padding-bottom: 0;
      }
    }
  }
</style>
