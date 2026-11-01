<template>
  <ArtDialog ref="dialogRef" size="lg" :show-footer="false">
    <div class="hazard-statistics">
      <ArtSectionCard title="查询条件" subtitle="按系统组织部门统计已提交危险源">
        <div class="hazard-statistics__query">
          <ArtForm v-model="query" :items="queryItems" :span="24" label-position="top" />
          <ElButton type="primary" :loading="loading" @click="loadStatistics"
            ><ArtSvgIcon icon="ri:search-line" /> 查询</ElButton
          >
        </div>
      </ArtSectionCard>
      <ArtSectionCard title="危险等级统计" :subtitle="`共 ${statistics.total} 条已提交危险源`">
        <div class="hazard-statistics__summary">
          <div
            v-for="(row, index) in displayRows"
            :key="row.hazardLevel"
            class="hazard-statistics__metric"
          >
            <span :class="`tone-${index + 1}`"><ArtSvgIcon icon="ri:shield-flash-line" /></span>
            <div
              ><strong>{{ row.count }}</strong
              ><small>{{ row.label }}</small></div
            >
          </div>
        </div>
        <ArtTable :data="displayRows" :pagination="false" border stripe>
          <ElTableColumn type="index" label="序号" width="72" align="center" />
          <ElTableColumn prop="label" label="危险等级" min-width="180" />
          <ElTableColumn prop="count" label="危险源数量" min-width="150" align="right" />
          <ElTableColumn label="占比" min-width="180">
            <template #default="{ row }"
              ><ElProgress
                :percentage="
                  statistics.total ? Math.round((row.count / statistics.total) * 100) : 0
                "
            /></template>
          </ElTableColumn>
        </ArtTable>
      </ArtSectionCard>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchHazardSourceStatistics,
    type SmisHazardSourceStatistics,
    type SmisTreeOrganization
  } from '@smis/api'

  export interface HazardStatisticsDialogOpenData {
    organizations: SmisTreeOrganization[]
  }
  const userStore = useUserStore()
  const dialogRef = ref<ArtDialogExpose<HazardStatisticsDialogOpenData>>()
  const organizations = shallowRef<SmisTreeOrganization[]>([])
  const query = ref<{ organizationId?: string }>({})
  const loading = ref(false)
  const statistics = reactive<SmisHazardSourceStatistics>({ rows: [], total: 0 })
  const queryItems = computed<FormItem[]>(() => [
    {
      key: 'organizationId',
      label: '系统组织部门',
      type: 'treeSelect',
      props: {
        data: organizations.value,
        props: { label: 'organizationName', children: 'children' },
        nodeKey: 'id',
        valueKey: 'id',
        checkStrictly: true,
        filterable: true,
        clearable: true,
        defaultExpandAll: true,
        placeholder: '全部组织部门'
      }
    }
  ])
  const displayRows = computed(() =>
    statistics.rows.map((row) => ({
      ...row,
      label:
        userStore.getDictItemByValue('smisHazardSourceLevel', row.hazardLevel)?.label ||
        row.hazardLevel
    }))
  )
  const loadStatistics = async (): Promise<void> => {
    loading.value = true
    try {
      const response = await fetchHazardSourceStatistics(query.value.organizationId)
      Object.assign(statistics, response.data ?? { rows: [], total: 0 })
    } finally {
      loading.value = false
    }
  }
  const handleOpen = async (data: HazardStatisticsDialogOpenData): Promise<void> => {
    organizations.value = data.organizations
    query.value = {}
    await dialogRef.value?.handleOpen(data, {
      title: '危险源统计分析',
      subtitle: '按管控组织汇总已提交危险源的危险等级分布',
      contentMaxHeight: 'calc(100vh - 160px)',
      onOpen: async () => {
        await userStore.ensureDictLoaded('smisHazardSourceLevel')
        await loadStatistics()
      }
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .hazard-statistics {
    display: grid;
    gap: 14px;
  }

  .hazard-statistics__query {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) auto;
    gap: 12px;
    align-items: end;
  }

  .hazard-statistics__summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 16px;
  }

  .hazard-statistics__metric {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 12px;
    background: var(--art-gray-50);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
  }

  .hazard-statistics__metric > span {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: var(--el-border-radius-base);
  }

  .hazard-statistics__metric div {
    display: grid;
  }

  .hazard-statistics__metric strong {
    font-size: 20px;
  }

  .hazard-statistics__metric small {
    color: var(--el-text-color-secondary);
  }

  .tone-1 {
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
  }

  .tone-2 {
    color: var(--el-color-warning);
    background: var(--el-color-warning-light-9);
  }

  .tone-3 {
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 10%, transparent);
  }

  .tone-4 {
    color: var(--el-text-color-secondary);
    background: var(--art-gray-100);
  }

  @media (width <= 720px) {
    .hazard-statistics__query {
      grid-template-columns: 1fr;
    }

    .hazard-statistics__summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
