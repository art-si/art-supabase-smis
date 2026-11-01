<template>
  <ArtPermissionGuard permission="SmisPositionRiskList:View">
    <div class="position-risk-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="position-risk-page__overview"
        eyebrow="POSITION RISK CONTROL"
        title="岗位风险清单"
        description="按组织部门和 HR 岗位维护危害因素与隐患控制措施标准，形成可执行、可核验的岗位风险清单。"
        icon="ri:shield-flash-line"
        density="compact"
        :tags="workspaceTags"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="position-risk-page__workspace">
        <ArtWorkspaceSplitter
          primary-size="276px"
          primary-min="244px"
          primary-max="380px"
          :breakpoint="820"
          stacked-primary-size="280px"
        >
          <template #primary>
            <aside class="position-risk-page__organization-panel">
              <OrganizationNavigator
                :data="organizationState.tree"
                :loading="organizationState.loading"
                :error="organizationState.error"
                :selected-key="organizationState.selectedKey"
                @select="handleOrganizationSelect"
                @refresh="loadOrganizations"
              />
            </aside>
          </template>

          <main class="position-risk-page__main">
            <ArtSectionCard
              :show-scrollbar="false"
              class="position-risk-page__positions"
              title="岗位选择"
              :subtitle="positionSectionSubtitle"
              :loading="positionState.loading"
              :error="positionState.error"
              :empty="!positionState.loading && !positionState.error && !positionState.rows.length"
              empty-title="当前部门暂无关联岗位"
              empty-description="岗位保持平铺展示，数据来自 HR 岗位编制、员工任职或已维护的风险清单。"
              :min-height="164"
              @retry="() => loadPositions()"
            >
              <template #actions>
                <ElInput
                  v-model="positionState.keyword"
                  class="position-risk-page__position-search"
                  clearable
                  placeholder="岗位编码或名称"
                  aria-label="搜索岗位编码或名称"
                  @keyup.enter="() => loadPositions()"
                  @clear="() => loadPositions()"
                >
                  <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
                </ElInput>
                <ArtIconButton
                  icon="ri:search-line"
                  label="查询岗位"
                  :loading="positionState.loading"
                  @click="() => loadPositions()"
                />
              </template>

              <ArtTable
                :pagination="false"
                :show-table-header="false"
                :data="positionState.rows"
                :row-key="(row: SmisPositionOption) => row.id"
                :current-row-key="positionState.selectedId || undefined"
                height="100%"
                highlight-current-row
                table-layout="fixed"
                @row-click="handlePositionSelect"
              >
                <ElTableColumn prop="positionName" label="岗位信息" min-width="260">
                  <template #default="{ row }">
                    <div class="position-risk-page__position-identity">
                      <span class="position-risk-page__position-icon" aria-hidden="true">
                        <ArtSvgIcon icon="ri:briefcase-4-line" />
                      </span>
                      <span class="position-risk-page__position-copy">
                        <strong :title="row.positionName">{{ row.positionName }}</strong>
                        <small
                          :title="`${row.positionCode} · ${row.description || 'HR 岗位主数据'}`"
                        >
                          <span translate="no">{{ row.positionCode }}</span>
                          <i aria-hidden="true"></i>
                          {{ row.description || 'HR 岗位主数据' }}
                        </small>
                      </span>
                      <span class="position-risk-page__position-meta">
                        <span class="position-risk-page__employee-count">
                          <strong>{{ row.employeeCount }}</strong
                          ><small> 人</small>
                        </span>
                        <span
                          class="position-risk-page__position-state"
                          :class="{ 'is-current': row.id === positionState.selectedId }"
                        >
                          <ArtSvgIcon
                            :icon="
                              row.id === positionState.selectedId
                                ? 'ri:check-line'
                                : 'ri:arrow-right-s-line'
                            "
                          />
                          {{ row.id === positionState.selectedId ? '已选择' : '选择' }}
                        </span>
                      </span>
                    </div>
                  </template>
                </ElTableColumn>
              </ArtTable>
            </ArtSectionCard>

            <ArtTableQuery
              ref="tableQueryRef"
              v-model="tableState.searchQuery"
              class="position-risk-page__table"
              :search-items="searchItems"
              :api-fn="fetchTableData"
              :columns-factory="columnsFactory"
              :header-actions="headerActions"
              header-actions-placement="workspace"
              :immediate="false"
              :search-bar-props="{
                span: 6,
                labelWidth: 88,
                showExpand: true,
                disabledSearch: !positionState.selectedId
              }"
              :table-props="{
                rowKey: 'id',
                tableLayout: 'fixed',
                emptyText: positionState.selectedId ? '暂无隐患控制措施标准' : '请先选择岗位',
                emptyDescription: positionState.selectedId
                  ? '可新增当前组织、岗位的危害因素与控制措施。'
                  : '从中间岗位列表选择一个岗位后查看清单。',
                showOverflowTooltip: true
              }"
              :on-success="handleTableSuccess"
              focusable
              focus-scope-selector=".position-risk-page__workspace"
            />
          </main>
        </ArtWorkspaceSplitter>
      </div>

      <RiskControlDialog ref="dialogRef" @success="handleSaveSuccess" />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import { toDictionaryOption } from '@/utils/form/option'

  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import { computed, onMounted, reactive, ref } from 'vue'
  import { storeToRefs } from 'pinia'
  import { ElMessage, ElTag } from 'element-plus'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric,
    type BusinessWorkspaceTag
  } from '@/components/business/business-workspace-header/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { useUserStore } from '@/store/modules/user'
  import { fetchOrganizationOptionsTree } from '@/api/system-manage'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase/error'
  import TreeUtils from '@/utils/tree'
  import {
    deletePositionRiskControls,
    fetchPositionRiskControlList,
    fetchSmisRiskPositionList,
    type PositionRiskControl,
    type PositionRiskControlSearchParams,
    type SmisPositionOption
  } from '@smis/api'
  import OrganizationNavigator from './modules/organization-navigator.vue'
  import RiskControlDialog, {
    type RiskControlDialogOpenData
  } from './modules/risk-control-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_position_risk_control',
    '岗位风险措施'
  )

  defineOptions({ name: 'SmisPositionRiskList' })

  const DICTIONARY_CODES = [
    'smisControlLevel',
    'smisControlMeasureCategory',
    'smisPrimaryHazardCategory',
    'smisSecondaryHazardCategory',
    'smisHazardLevel',
    'commonBoolean'
  ] as const
  type Organization = Api.SystemManage.OrganizationListItem
  type TableSearchModel = Pick<
    PositionRiskControlSearchParams,
    'controlMeasureCategory' | 'controlLevel' | 'hazardLevel' | 'isSpecialEquipment' | 'keyword'
  >
  type TableParams = TableSearchModel & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: RiskControlDialogOpenData) => Promise<void>
  }

  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const organizationState = reactive({
    tree: [] as Organization[],
    loading: false,
    error: null as string | null,
    selectedKey: ''
  })
  const positionState = reactive({
    rows: [] as SmisPositionOption[],
    total: 0,
    loading: false,
    error: null as string | null,
    keyword: '',
    selectedId: ''
  })
  const tableState = reactive({
    searchQuery: {
      controlMeasureCategory: '',
      controlLevel: '',
      hazardLevel: '',
      isSpecialEquipment: '',
      keyword: ''
    } as TableSearchModel,
    total: 0
  })

  const flatOrganizations = computed(() => treeUtils.treeToList(organizationState.tree))
  const selectedOrganization = computed(() =>
    flatOrganizations.value.find((item) => item.id === organizationState.selectedKey)
  )
  const selectedOrganizationIds = computed(() =>
    selectedOrganization.value?.id
      ? treeUtils
          .getDescendants(organizationState.tree, selectedOrganization.value.id, true)
          .map((organization) => organization.id)
          .filter((id): id is string => Boolean(id))
      : []
  )
  const selectedPosition = computed(() =>
    positionState.rows.find((item) => item.id === positionState.selectedId)
  )
  const positionSectionSubtitle = computed(() =>
    selectedOrganization.value
      ? `${selectedOrganization.value.organizationName}及下级 · 共 ${positionState.total} 个可用岗位`
      : '请先选择组织部门'
  )
  const canMaintain = computed(() =>
    Boolean(selectedOrganization.value?.id && selectedPosition.value?.id)
  )
  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: '系统组织联动', type: 'primary', effect: 'plain' },
    { label: '岗位平铺展示', type: 'success', effect: 'light' },
    { label: '隐患字典统一', type: 'info', effect: 'plain' }
  ]
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '当前组织',
      value: selectedOrganization.value?.organizationName || '未选择',
      description: selectedOrganization.value ? '包含本级及全部下级组织' : '从左侧组织树选择',
      icon: 'ri:node-tree'
    },
    {
      label: '当前岗位',
      value: selectedPosition.value?.positionName || '未选择',
      description: selectedPosition.value?.positionCode || `${positionState.total} 个岗位可选`,
      icon: 'ri:briefcase-4-line',
      tone: 'info'
    },
    {
      label: '在岗人数',
      value: selectedPosition.value?.employeeCount ?? 0,
      description: selectedPosition.value ? '当前岗位实时任职人数' : '选择岗位后显示',
      icon: 'ri:group-line',
      tone: 'warning'
    },
    {
      label: '控制措施',
      value: selectedPosition.value?.controlCount ?? 0,
      description: selectedPosition.value ? '当前岗位已维护标准' : '尚未选择岗位',
      icon: 'ri:shield-check-line',
      tone: 'success'
    }
  ])

  const dictionaryOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键内容',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '危害因素、措施或依据' }
    },
    {
      label: '措施类别',
      key: 'controlMeasureCategory',
      type: 'select',
      props: {
        options: dictionaryOptions('smisControlMeasureCategory'),
        clearable: true,
        placeholder: '全部类别'
      }
    },
    {
      label: '防控级别',
      key: 'controlLevel',
      type: 'select',
      props: {
        options: dictionaryOptions('smisControlLevel'),
        clearable: true,
        placeholder: '全部级别'
      }
    },
    {
      label: '隐患级别',
      key: 'hazardLevel',
      type: 'select',
      props: {
        options: dictionaryOptions('smisHazardLevel'),
        clearable: true,
        placeholder: '全部级别'
      }
    },
    {
      label: '特种设备',
      key: 'isSpecialEquipment',
      type: 'select',
      props: { options: dictionaryOptions('commonBoolean'), clearable: true, placeholder: '全部' }
    }
  ])
  const columnsFactory = (): ColumnOption<PositionRiskControl>[] => [
    { type: 'selection', width: 50, reserveSelection: true },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'organizationId',
      label: '组织',
      minWidth: 150,
      formatter: (row) =>
        flatOrganizations.value.find((organization) => organization.id === row.organizationId)
          ?.organizationName || '--'
    },
    { prop: 'hazardFactor', label: '危害因素', minWidth: 210, showOverflowTooltip: true },
    { prop: 'controlMeasure', label: '管控措施', minWidth: 260, showOverflowTooltip: true },
    {
      prop: 'controlMeasureCategory',
      label: '管控措施类别',
      width: 132,
      dict: { code: 'smisControlMeasureCategory', display: 'auto' }
    },
    {
      prop: 'controlLevel',
      label: '防控级别',
      width: 112,
      dict: { code: 'smisControlLevel', display: 'auto' }
    },
    { prop: 'standardBasis', label: '标准依据', minWidth: 190, showOverflowTooltip: true },
    { prop: 'failureMode', label: '失效形式', minWidth: 180, showOverflowTooltip: true },
    {
      prop: 'primaryHazardCategory',
      label: '一级隐患类别',
      width: 126,
      dict: { code: 'smisPrimaryHazardCategory', display: 'auto' }
    },
    {
      prop: 'secondaryHazardCategory',
      label: '二级隐患类别',
      minWidth: 150,
      dict: { code: 'smisSecondaryHazardCategory', display: 'text' }
    },
    {
      prop: 'hazardLevel',
      label: '隐患级别',
      width: 116,
      dict: { code: 'smisHazardLevel', display: 'auto' }
    },
    {
      prop: 'isSpecialEquipment',
      label: '特种设备',
      width: 100,
      align: 'center',
      formatter: (row) =>
        row.isSpecialEquipment ? (
          <ElTag type="warning" effect="light">
            是
          </ElTag>
        ) : (
          <span class="text-[var(--el-text-color-secondary)]">否</span>
        )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 112,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            type="edit"
            permission="SmisPositionRiskList:Edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            type="delete"
            permission="SmisPositionRiskList:Delete"
            onClick={() => handleDeleteRows([row])}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'add',
      label: '新增措施',
      permission: 'SmisPositionRiskList:Add',
      disabled: !canMaintain.value,
      onClick: () => openDialog()
    },
    {
      type: 'delete',
      confirm: false,
      label: '删除',
      permission: 'SmisPositionRiskList:Delete',
      content: (context: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${context.selectedCount} 条隐患控制措施吗？`,
      onClick: async ({ selectedRows, api }) => {
        const ids = (selectedRows as PositionRiskControl[])
          .map((row) => row.id)
          .filter((id): id is string => Boolean(id))
        if (!ids.length) return
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.controlMeasure ?? '岗位风险措施')
          })),
          permission: 'SmisPositionRiskList:Delete',
          remove: async () => {
            await deletePositionRiskControls(ids)
          },
          onDeleted: async () => {
            await api.refreshRemove()
            await loadPositions(true)
          }
        })
      }
    }
  ])

  const fetchTableData = (params: TableParams) => {
    const organizationId = organizationState.selectedKey
    const positionId = positionState.selectedId
    if (!organizationId || !positionId)
      return Promise.resolve({ data: [], count: 0, total: 0, error: null })
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    return fetchPositionRiskControlList({
      ...params,
      organizationId,
      organizationIds: selectedOrganizationIds.value,
      positionId,
      from,
      to
    })
  }
  const handleTableSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (_rows, response) => {
    tableState.total = response.total ?? 0
  }
  const loadRequiredDictionaries = async (): Promise<void> => {
    const missing = DICTIONARY_CODES.some((code) => !(getDictMap.value[code]?.length ?? 0))
    const missingMetadata = (getDictMap.value.smisSecondaryHazardCategory ?? []).some(
      (item) => !item.remark
    )
    if (missing || missingMetadata) await userStore.fetchDictList()
  }
  const loadOrganizations = async (): Promise<void> => {
    organizationState.loading = true
    organizationState.error = null
    try {
      const response = await fetchOrganizationOptionsTree({ status: '1' })
      organizationState.tree = response.data ?? []
      if (!flatOrganizations.value.some((item) => item.id === organizationState.selectedKey)) {
        const initialOrganization =
          flatOrganizations.value.find((item) => item.organizationType !== 'company') ??
          flatOrganizations.value[0]
        organizationState.selectedKey = initialOrganization?.id || ''
        positionState.selectedId = ''
      }
      await loadPositions()
    } catch (error) {
      organizationState.error = getFriendlySupabaseErrorMessage(
        error,
        '组织结构加载失败，请稍后重试'
      )
    } finally {
      organizationState.loading = false
    }
  }
  const loadPositions = async (preserveTable = false): Promise<void> => {
    const organizationId = organizationState.selectedKey
    if (!organizationId) {
      positionState.rows = []
      positionState.total = 0
      positionState.selectedId = ''
      return
    }
    positionState.loading = true
    positionState.error = null
    try {
      const response = await fetchSmisRiskPositionList({
        organizationId,
        keyword: positionState.keyword,
        from: 0,
        to: 499
      })
      positionState.rows = response.data
      positionState.total = response.total
      if (!positionState.rows.some((item) => item.id === positionState.selectedId))
        positionState.selectedId = positionState.rows[0]?.id || ''
      if (!preserveTable) tableState.total = 0
      await tableQueryRef.value?.getData()
    } catch (error) {
      positionState.rows = []
      positionState.total = 0
      positionState.selectedId = ''
      positionState.error = getFriendlySupabaseErrorMessage(error, '岗位加载失败，请稍后重试')
    } finally {
      positionState.loading = false
    }
  }
  const handleOrganizationSelect = async (key: string): Promise<void> => {
    if (organizationState.selectedKey === key) return
    organizationState.selectedKey = key
    positionState.selectedId = ''
    await loadPositions()
  }
  const handlePositionSelect = async (position: SmisPositionOption): Promise<void> => {
    if (positionState.selectedId === position.id) return
    positionState.selectedId = position.id
    tableState.total = 0
    await tableQueryRef.value?.getData()
  }
  const openDialog = (row?: PositionRiskControl): void => {
    const organization = selectedOrganization.value
    const position = selectedPosition.value
    if (!organization?.id || !position) {
      ElMessage.warning('请先选择组织部门和岗位')
      return
    }
    void dialogRef.value?.handleOpen({
      organizationId: row?.organizationId || organization.id,
      organizationName:
        flatOrganizations.value.find((item) => item.id === row?.organizationId)?.organizationName ||
        organization.organizationName,
      positionId: position.id,
      positionName: position.positionName,
      positionCode: position.positionCode,
      row
    })
  }
  const handleSaveSuccess = async (type: 'add' | 'edit'): Promise<void> => {
    await (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
    await loadPositions(true)
  }
  const handleDeleteRows = async (rows: PositionRiskControl[]): Promise<void> => {
    const ids = rows.map((row) => row.id).filter((id): id is string => Boolean(id))
    if (!ids.length) return

    await deleteRecords({
      resources: rows.map((row) => ({
        id: String(row.id ?? ''),
        label: String(row.controlMeasure ?? '岗位风险措施')
      })),
      permission: 'SmisPositionRiskList:Delete',
      confirmMessage: '确定删除这条隐患控制措施吗？删除后无法恢复。',
      remove: async () => {
        await deletePositionRiskControls(ids)
      },
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
        await loadPositions(true)
      }
    })
  }

  onMounted(async () => {
    await Promise.all([loadRequiredDictionaries(), loadOrganizations()])
  })
</script>

<style scoped lang="scss">
  .position-risk-page {
    gap: 12px;
    min-width: 0;

    &__overview {
      min-width: 0;
      overflow: hidden;
    }

    &__workspace {
      flex: 1 1 auto;
      width: 100%;
      min-width: 0;
      min-height: 0;
    }

    &__organization-panel,
    &__main,
    &__table {
      min-width: 0;
      min-height: 0;
    }

    &__organization-panel {
      overflow: hidden;
    }

    &__main {
      display: grid;
      grid-template-columns: minmax(288px, 320px) minmax(0, 1fr);
      gap: 12px;
    }

    &__positions {
      display: flex;
      flex-direction: column;
      overflow: hidden;

      :deep(.art-section-card__body),
      :deep(.art-async-state),
      :deep(.art-async-state__content) {
        min-height: 0;
      }

      :deep(.art-section-card__body) {
        flex: 1 1 auto;
        overflow: hidden;
      }
    }

    &__position-search {
      max-width: calc(100% - 44px);
    }

    &__position-identity {
      display: flex;
      gap: 10px;
      align-items: center;
      min-width: 0;
      padding-block: 2px;
    }

    &__position-icon {
      display: inline-flex;
      flex: 0 0 34px;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
      border-radius: var(--el-border-radius-base);
    }

    &__position-copy {
      display: grid;
      flex: 1 1 auto;
      min-width: 0;

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        display: flex;
        gap: 7px;
        align-items: center;
        margin-top: 2px;
        font-size: 11px;
        color: var(--el-text-color-secondary);

        span {
          flex: none;
          font-variant-numeric: tabular-nums;
        }
      }

      i {
        flex: none;
        width: 3px;
        height: 3px;
        background: var(--el-text-color-placeholder);
        border-radius: 50%;
      }
    }

    &__position-meta {
      display: grid;
      flex: none;
      gap: 2px;
      justify-items: end;
    }

    &__employee-count {
      font-variant-numeric: tabular-nums;

      strong {
        color: var(--el-text-color-primary);
      }

      small {
        color: var(--el-text-color-secondary);
      }
    }

    &__position-state {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      justify-content: flex-end;
      min-height: 20px;
      font-size: 12px;
      color: var(--el-text-color-secondary);

      &.is-current {
        font-weight: 600;
        color: var(--theme-color);
      }
    }

    &__table {
      flex: 1 1 auto;
    }

    :deep(.el-table__row) {
      cursor: pointer;
    }

    :deep(.el-table__body tr.current-row > td.el-table__cell) {
      background: color-mix(in srgb, var(--theme-color) 8%, var(--default-box-color));
    }

    :deep(.el-table__body tr.current-row .position-risk-page__position-icon) {
      color: var(--default-box-color);
      background: var(--theme-color);
    }

    @media (width <= 1280px) {
      &__main {
        display: flex;
        flex-direction: column;
      }

      &__positions {
        flex: 0 0 244px;
      }
    }

    @media (width <= 820px) {
      &__main {
        flex: 0 0 780px;
      }
    }
  }
</style>
