<template>
  <ArtPermissionGuard permission="SmisPositionSafetyResponsibility:View">
    <div class="position-safety-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="position-safety-page__overview"
        eyebrow="POSITION SAFETY"
        title="岗位安全责任制"
        description="按组织和 HR 岗位维护隐患排查标准，统一隐患分类、风险等级与排查频次口径。"
        icon="ri:shield-user-line"
        density="compact"
        :tags="workspaceTags"
        :metrics="workspaceMetrics"
      >
        <template #actions>
          <BusinessTableWorkspaceActions :table="tableQueryRef" />
        </template>
      </BusinessWorkspaceHeader>

      <div class="position-safety-page__workspace">
        <ArtWorkspaceSplitter
          primary-size="276px"
          primary-min="244px"
          primary-max="380px"
          :breakpoint="820"
          stacked-primary-size="280px"
        >
          <template #primary>
            <aside class="position-safety-page__organization-panel">
              <OrganizationNavigator
                :data="organizationState.tree"
                :loading="organizationState.loading"
                :error="organizationState.error"
                :selected-key="organizationState.selectedKey"
                :all-key="ALL_ORGANIZATIONS_KEY"
                @select="handleOrganizationSelect"
                @refresh="loadOrganizations"
              />
            </aside>
          </template>

          <main class="position-safety-page__main">
            <ArtSectionCard
              :show-scrollbar="false"
              class="position-safety-page__positions"
              title="岗位选择"
              :subtitle="positionSectionSubtitle"
              :loading="positionState.loading"
              :error="positionState.error"
              :empty="!positionState.loading && !positionState.error && !positionState.rows.length"
              empty-title="当前范围暂无岗位"
              empty-description="岗位来自 HR 岗位管理，并按岗位编制、员工任职和已维护标准关联到当前组织。"
              :min-height="164"
              @retry="loadPositions"
            >
              <template #actions>
                <ElInput
                  v-model="positionState.keyword"
                  class="position-safety-page__position-search"
                  clearable
                  placeholder="岗位编码或名称"
                  aria-label="搜索岗位编码或名称"
                  @keyup.enter="loadPositions"
                  @clear="loadPositions"
                >
                  <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
                </ElInput>
                <ArtIconButton
                  icon="ri:search-line"
                  label="查询岗位"
                  :loading="positionState.loading"
                  @click="loadPositions"
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
                    <div class="position-safety-page__position-identity">
                      <span class="position-safety-page__position-icon" aria-hidden="true">
                        <ArtSvgIcon icon="ri:briefcase-4-line" />
                      </span>
                      <span class="position-safety-page__position-copy">
                        <strong :title="row.positionName">{{ row.positionName }}</strong>
                        <small
                          :title="`${row.positionCode} · ${row.description || 'HR 岗位主数据'}`"
                        >
                          <span translate="no">{{ row.positionCode }}</span>
                          <i aria-hidden="true"></i>
                          {{ row.description || 'HR 岗位主数据' }}
                        </small>
                      </span>
                      <span class="position-safety-page__position-meta">
                        <span class="position-safety-page__employee-count">
                          <strong>{{ row.employeeCount }}</strong
                          ><small> 人</small>
                        </span>
                        <span
                          class="position-safety-page__position-state"
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
              class="position-safety-page__table"
              :search-items="searchItems"
              :api-fn="fetchTableData"
              :columns-factory="columnsFactory"
              :header-actions="headerActions"
              header-actions-placement="workspace"
              :immediate="false"
              :search-bar-props="{
                span: 8,
                labelWidth: 96,
                showExpand: false,
                disabledSearch: !positionState.selectedId
              }"
              :table-props="{
                rowKey: 'id',
                tableLayout: 'fixed',
                emptyText: positionState.selectedId ? '暂无隐患排查标准' : '请先选择岗位',
                emptyDescription: positionState.selectedId
                  ? '可新增或导入当前组织、岗位的隐患排查标准。'
                  : '从岗位列表选择一个岗位后查看标准。',
                showOverflowTooltip: true
              }"
              :on-success="handleTableSuccess"
              focusable
              focus-scope-selector=".position-safety-page__workspace"
            />
          </main>
        </ArtWorkspaceSplitter>
      </div>

      <ResponsibilityDialog ref="dialogRef" @success="handleSaveSuccess" />
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
  import { ElMessage } from 'element-plus'
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
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { useUserStore } from '@/store/modules/user'
  import { fetchOrganizationOptionsTree } from '@/api/system-manage'
  import { exportExcel } from '@/utils/file'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { formatWithDayjs } from '@/utils/time'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase/error'
  import TreeUtils from '@/utils/tree'
  import {
    findDictionaryItem,
    getChildDictionaryItems,
    hasDictionaryParentReference
  } from '@smis/domain/hazard-dictionary'
  import {
    deletePositionSafetyResponsibilities,
    fetchPositionSafetyResponsibilityList,
    fetchSmisPositionList,
    importPositionSafetyResponsibilities,
    type PositionSafetyResponsibility,
    type PositionSafetyResponsibilitySavePayload,
    type PositionSafetyResponsibilitySearchParams,
    type SmisPositionOption
  } from '@smis/api'
  import OrganizationNavigator from './modules/organization-navigator.vue'
  import ResponsibilityDialog, {
    type ResponsibilityDialogOpenData
  } from './modules/responsibility-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_position_safety_responsibility',
    '岗位安全标准'
  )

  defineOptions({ name: 'SmisPositionSafetyResponsibility' })

  const ALL_ORGANIZATIONS_KEY = '__all_organizations__'
  const DICTIONARY_CODES = [
    'smisPrimaryHazardCategory',
    'smisSecondaryHazardCategory',
    'smisHazardContent',
    'smisHazardLevel',
    'smisFrequencyUnit',
    'smisInspectionFrequency',
    'smisRiskLevel'
  ] as const

  type Organization = Api.SystemManage.OrganizationListItem
  type TableSearchModel = Pick<
    PositionSafetyResponsibilitySearchParams,
    'primaryHazardCategory' | 'hazardLevel' | 'keyword'
  >
  type TableParams = TableSearchModel & Pick<Api.Common.PaginationParams, 'current' | 'size'>

  interface OrganizationState {
    tree: Organization[]
    loading: boolean
    error: string | null
    selectedKey: string
  }

  interface PositionState {
    rows: SmisPositionOption[]
    total: number
    loading: boolean
    error: string | null
    keyword: string
    selectedId: string
  }

  interface TableState {
    searchQuery: TableSearchModel
    total: number
  }

  interface ResponsibilityDialogExpose {
    handleOpen: (data: ResponsibilityDialogOpenData) => Promise<void>
  }

  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<ResponsibilityDialogExpose>()
  const organizationTreeUtils = new TreeUtils({
    idKey: 'id',
    parentKey: 'parentId',
    childrenKey: 'children'
  })

  const organizationState = reactive<OrganizationState>({
    tree: [],
    loading: false,
    error: null,
    selectedKey: ALL_ORGANIZATIONS_KEY
  })
  const positionState = reactive<PositionState>({
    rows: [],
    total: 0,
    loading: false,
    error: null,
    keyword: '',
    selectedId: ''
  })
  const tableState = reactive<TableState>({
    searchQuery: { primaryHazardCategory: '', hazardLevel: '', keyword: '' },
    total: 0
  })

  const flatOrganizations = computed(() => organizationTreeUtils.treeToList(organizationState.tree))
  const selectedOrganization = computed(() =>
    organizationState.selectedKey === ALL_ORGANIZATIONS_KEY
      ? undefined
      : flatOrganizations.value.find(
          (organization) => organization.id === organizationState.selectedKey
        )
  )
  const selectedOrganizationLabel = computed(
    () => selectedOrganization.value?.organizationName || '全部组织'
  )
  const selectedOrganizationIds = computed(() =>
    selectedOrganization.value?.id
      ? organizationTreeUtils
          .getDescendants(organizationState.tree, selectedOrganization.value.id, true)
          .map((organization) => organization.id)
          .filter((id): id is string => Boolean(id))
      : []
  )
  const selectedPosition = computed(() =>
    positionState.rows.find((position) => position.id === positionState.selectedId)
  )
  const canMaintainCurrentScope = computed(() =>
    Boolean(selectedOrganization.value?.id && selectedPosition.value?.id)
  )
  const positionSectionSubtitle = computed(
    () => `${selectedOrganizationLabel.value}及下级 · 共 ${positionState.total} 个可用岗位`
  )

  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: '系统组织数据', type: 'primary', effect: 'plain' },
    { label: 'HR 岗位联动', type: 'success', effect: 'light' },
    { label: '字典统一口径', type: 'info', effect: 'plain' }
  ]
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '当前组织',
      value: selectedOrganizationLabel.value,
      description: selectedOrganization.value ? '包含本级及全部下级组织' : '跨组织浏览模式',
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
      label: '当前标准',
      value: tableState.total,
      description: selectedPosition.value ? '当前岗位已维护标准' : '尚未选择岗位',
      icon: 'ri:shield-check-line',
      tone: 'success'
    }
  ])

  const dictionaryOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)

  const loadRequiredDictionaries = async (): Promise<void> => {
    const missingCode = DICTIONARY_CODES.some((code) => !(getDictMap.value[code]?.length ?? 0))
    const secondaryItems = getDictMap.value.smisSecondaryHazardCategory ?? []
    const hazardContentItems = getDictMap.value.smisHazardContent ?? []
    const missingCategoryMetadata = secondaryItems.some(
      (item) => !hasDictionaryParentReference(item, true)
    )
    const missingContentMetadata = hazardContentItems.some(
      (item) => !hasDictionaryParentReference(item)
    )

    if (missingCode || missingCategoryMetadata || missingContentMetadata) {
      await userStore.fetchDictList()
    }
  }

  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '一级隐患类别',
      key: 'primaryHazardCategory',
      type: 'select',
      props: {
        options: dictionaryOptions('smisPrimaryHazardCategory'),
        clearable: true,
        placeholder: '全部类别'
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
      label: '隐患内容',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '输入隐患内容关键字' }
    }
  ])

  const getOrganizationName = (organizationId: string): string =>
    flatOrganizations.value.find((organization) => organization.id === organizationId)
      ?.organizationName || '--'

  const columnsFactory = (): ColumnOption<PositionSafetyResponsibility>[] => [
    { type: 'selection', width: 50, reserveSelection: true },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'organizationId',
      label: '组织',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => getOrganizationName(row.organizationId)
    },
    {
      prop: 'primaryHazardCategory',
      label: '一级隐患类别',
      width: 128,
      dict: { code: 'smisPrimaryHazardCategory', display: 'auto' }
    },
    {
      prop: 'secondaryHazardCategory',
      label: '二级隐患类别',
      minWidth: 150,
      dict: { code: 'smisSecondaryHazardCategory', display: 'text' }
    },
    {
      prop: 'hazardContent',
      label: '隐患内容',
      minWidth: 220,
      showOverflowTooltip: true,
      formatter: (row) => row.hazardContent || '—'
    },
    {
      prop: 'hazardLevel',
      label: '隐患级别',
      width: 118,
      dict: { code: 'smisHazardLevel', display: 'auto' }
    },
    {
      prop: 'riskLevel',
      label: '风险等级',
      width: 140,
      dict: { code: 'smisRiskLevel', display: 'auto' }
    },
    { prop: 'inspectionFrequency', label: '排查频次', width: 96, align: 'right' },
    {
      prop: 'frequencyUnit',
      label: '频次单位',
      width: 96,
      dict: { code: 'smisFrequencyUnit', display: 'text' }
    },
    {
      prop: 'inspectionItem',
      label: '排查项目',
      minWidth: 220,
      showOverflowTooltip: true
    },
    {
      prop: 'inspectionStandard',
      label: '排查标准',
      minWidth: 260,
      showOverflowTooltip: true
    },
    {
      prop: 'revisionDate',
      label: '修订日期',
      width: 112,
      formatter: (row) => formatWithDayjs(row.revisionDate, 'YYYY-MM-DD')
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
            permission="SmisPositionSafetyResponsibility:Edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            type="delete"
            permission="SmisPositionSafetyResponsibility:Delete"
            onClick={() => handleDeleteRows([row])}
          />
        </BusinessTableRowActions>
      )
    }
  ]

  const importColumns: ArtTableQueryExcelColumn[] = [
    { key: 'primaryHazardCategory', title: '一级隐患类别', required: true, width: 16 },
    { key: 'secondaryHazardCategory', title: '二级隐患类别', required: true, width: 22 },
    { key: 'hazardContent', title: '隐患内容', width: 32 },
    { key: 'hazardLevel', title: '隐患级别', required: true, width: 16 },
    { key: 'riskLevel', title: '隐患风险等级', required: true, width: 22 },
    { key: 'inspectionFrequency', title: '排查频次', required: true, width: 12 },
    { key: 'frequencyUnit', title: '频次单位', required: true, width: 12 },
    { key: 'inspectionItem', title: '排查项目', required: true, width: 36 },
    { key: 'inspectionStandard', title: '排查标准', required: true, width: 42 },
    { key: 'revisionDate', title: '修订日期', width: 14 }
  ]

  const resolveDictionaryItem = (
    code: string,
    fieldLabel: string,
    rawValue: unknown,
    rowNumber: number,
    candidates = getDictMap.value[code] ?? []
  ): Api.DataCenter.DictListItem => {
    const item = findDictionaryItem(candidates, rawValue)
    if (!item) {
      throw new Error(
        `第 ${rowNumber} 行的${fieldLabel}无法识别：${String(rawValue ?? '').trim() || '空值'}`
      )
    }
    return item
  }

  const resolveDictionaryValue = (
    code: string,
    fieldLabel: string,
    rawValue: unknown,
    rowNumber: number
  ): string => resolveDictionaryItem(code, fieldLabel, rawValue, rowNumber).value

  const resolveChildDictionaryItem = (
    code: string,
    fieldLabel: string,
    rawValue: unknown,
    rowNumber: number,
    parent: Api.DataCenter.DictListItem
  ): Api.DataCenter.DictListItem => {
    const candidates = getChildDictionaryItems(getDictMap.value[code] ?? [], parent)
    return resolveDictionaryItem(code, fieldLabel, rawValue, rowNumber, candidates)
  }

  const transformImportRows = (
    rows: Array<Record<string, unknown>>
  ): PositionSafetyResponsibilitySavePayload[] => {
    const organizationId = selectedOrganization.value?.id
    const positionId = selectedPosition.value?.id
    if (!organizationId || !positionId) throw new Error('请先选择具体组织和岗位再导入')

    return rows.map((row, index) => {
      const rowNumber = index + 2
      const primaryHazardCategoryItem = resolveDictionaryItem(
        'smisPrimaryHazardCategory',
        '一级隐患类别',
        row.primaryHazardCategory,
        rowNumber
      )
      const secondaryHazardCategoryItem = resolveChildDictionaryItem(
        'smisSecondaryHazardCategory',
        '二级隐患类别',
        row.secondaryHazardCategory,
        rowNumber,
        primaryHazardCategoryItem
      )
      const rawHazardContent = String(row.hazardContent ?? '').trim()
      const hazardContentItem = rawHazardContent
        ? resolveChildDictionaryItem(
            'smisHazardContent',
            '隐患内容',
            rawHazardContent,
            rowNumber,
            secondaryHazardCategoryItem
          )
        : null
      const revisionDate = String(row.revisionDate ?? '').trim()
      if (revisionDate && !/^\d{4}-\d{2}-\d{2}$/.test(revisionDate)) {
        throw new Error(`第 ${rowNumber} 行修订日期应为 YYYY-MM-DD 格式`)
      }

      return {
        organizationId,
        positionId,
        primaryHazardCategory: primaryHazardCategoryItem.value,
        secondaryHazardCategory: secondaryHazardCategoryItem.value,
        hazardContent: hazardContentItem?.value ?? null,
        hazardLevel: resolveDictionaryValue(
          'smisHazardLevel',
          '隐患级别',
          row.hazardLevel,
          rowNumber
        ),
        riskLevel: resolveDictionaryValue(
          'smisRiskLevel',
          '隐患风险等级',
          row.riskLevel,
          rowNumber
        ),
        inspectionFrequency: Number(
          resolveDictionaryValue(
            'smisInspectionFrequency',
            '排查频次',
            row.inspectionFrequency,
            rowNumber
          )
        ),
        frequencyUnit: resolveDictionaryValue(
          'smisFrequencyUnit',
          '频次单位',
          row.frequencyUnit,
          rowNumber
        ),
        inspectionItem: String(row.inspectionItem ?? '').trim(),
        inspectionStandard: String(row.inspectionStandard ?? '').trim(),
        revisionDate: revisionDate || formatWithDayjs(new Date(), 'YYYY-MM-DD') || ''
      }
    })
  }

  const downloadTemplate = async (): Promise<void> => {
    await exportExcel({
      filename: '岗位安全责任制导入模板',
      sheetName: '隐患排查标准',
      columns: importColumns,
      data: [
        {
          primaryHazardCategory: '基础管理',
          secondaryHazardCategory: '安全规章制度',
          hazardContent: '安全管理制度缺陷',
          hazardLevel: '一般隐患D',
          riskLevel: '低风险(D级)',
          inspectionFrequency: 1,
          frequencyUnit: '日',
          inspectionItem: '检查岗位相关安全管理制度是否完整、有效',
          inspectionStandard: '制度已发布、内容适用且修订记录完整',
          revisionDate: formatWithDayjs(new Date(), 'YYYY-MM-DD')
        }
      ]
    })
  }

  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'add',
      label: '新增标准',
      permission: 'SmisPositionSafetyResponsibility:Add',
      disabled: !canMaintainCurrentScope.value,
      onClick: () => openDialog()
    },
    {
      type: 'delete',
      confirm: false,
      label: '删除',
      permission: 'SmisPositionSafetyResponsibility:Delete',
      content: (context: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${context.selectedCount} 条隐患排查标准吗？`,
      onClick: async ({ selectedRows, api }) => {
        const rows = selectedRows as PositionSafetyResponsibility[]
        const ids = rows.map((row) => row.id).filter((id): id is string => Boolean(id))
        if (!ids.length) return
        await deleteRecords({
          resources: rows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.hazardContent ?? '岗位安全标准')
          })),
          permission: 'SmisPositionSafetyResponsibility:Delete',
          remove: async () => {
            await deletePositionSafetyResponsibilities(ids)
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    },
    {
      type: 'import',
      label: '导入',
      permission: 'SmisPositionSafetyResponsibility:Import',
      disabled: !canMaintainCurrentScope.value,
      importColumns,
      importRecordTransformer: transformImportRows,
      importApi: async (rows) => {
        await importPositionSafetyResponsibilities(
          rows as PositionSafetyResponsibilitySavePayload[]
        )
      },
      onImportSuccess: async (_rows, context) => {
        await context.api.refreshCreate()
      },
      onImportError: (error) => {
        ElMessage.error(getFriendlySupabaseErrorMessage(error, '导入失败，请检查模板内容后重试'))
      }
    },
    {
      key: 'download-template',
      label: '下载导入模板',
      icon: 'ri:download-2-line',
      permission: 'SmisPositionSafetyResponsibility:DownloadTemplate',
      onClick: downloadTemplate
    }
  ])

  const fetchTableData = (params: TableParams) => {
    const positionId = positionState.selectedId
    if (!positionId) {
      return Promise.resolve({ data: [], count: 0, total: 0, error: null })
    }
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    return fetchPositionSafetyResponsibilityList({
      ...params,
      positionId,
      organizationId: selectedOrganization.value?.id,
      organizationIds: selectedOrganization.value ? selectedOrganizationIds.value : undefined,
      from,
      to
    })
  }

  const handleTableSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (_rows, response) => {
    tableState.total = response.total ?? 0
  }

  const loadOrganizations = async (): Promise<void> => {
    organizationState.loading = true
    organizationState.error = null
    try {
      const response = await fetchOrganizationOptionsTree({ status: '1' })
      organizationState.tree = response.data ?? []
      if (
        organizationState.selectedKey !== ALL_ORGANIZATIONS_KEY &&
        !organizationTreeUtils.findNode(organizationState.tree, organizationState.selectedKey)
      ) {
        organizationState.selectedKey = ALL_ORGANIZATIONS_KEY
      }
    } catch (error) {
      organizationState.error = getFriendlySupabaseErrorMessage(
        error,
        '组织结构加载失败，请稍后重试'
      )
    } finally {
      organizationState.loading = false
    }
  }

  const loadPositions = async (): Promise<void> => {
    positionState.loading = true
    positionState.error = null
    try {
      const response = await fetchSmisPositionList({
        organizationId: selectedOrganization.value?.id,
        keyword: positionState.keyword,
        from: 0,
        to: 499
      })
      positionState.rows = response.data
      positionState.total = response.total
      const selectedStillVisible = positionState.rows.some(
        (position) => position.id === positionState.selectedId
      )
      positionState.selectedId = selectedStillVisible ? positionState.selectedId : ''
      if (!positionState.selectedId && positionState.rows.length) {
        positionState.selectedId = positionState.rows[0].id
      }
      tableState.total = 0
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

  const openDialog = (row?: PositionSafetyResponsibility): void => {
    const organizationId = row?.organizationId || selectedOrganization.value?.id
    const position = selectedPosition.value
    if (!organizationId || !position) {
      ElMessage.warning('请先选择具体组织和岗位')
      return
    }
    void dialogRef.value?.handleOpen({
      organizationId,
      organizationName: getOrganizationName(organizationId),
      positionId: position.id,
      positionName: position.positionName,
      positionCode: position.positionCode,
      row
    })
  }

  const handleSaveSuccess = (type: 'add' | 'edit'): void => {
    void (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
  }

  const handleDeleteRows = async (rows: PositionSafetyResponsibility[]): Promise<void> => {
    const ids = rows.map((row) => row.id).filter((id): id is string => Boolean(id))
    if (!ids.length) return

    await deleteRecords({
      resources: rows.map((row) => ({
        id: String(row.id ?? ''),
        label: String(row.hazardContent ?? '岗位安全标准')
      })),
      permission: 'SmisPositionSafetyResponsibility:Delete',
      confirmMessage:
        ids.length === 1
          ? '确定删除这条隐患排查标准吗？删除后无法恢复。'
          : `确定删除选中的 ${ids.length} 条隐患排查标准吗？`,
      remove: async () => {
        await deletePositionSafetyResponsibilities(ids)
      },
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
      }
    })
  }

  onMounted(async () => {
    await Promise.all([loadOrganizations(), loadRequiredDictionaries()])
    await loadPositions()
  })
</script>

<style scoped lang="scss">
  .position-safety-page {
    min-width: 0;

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
      width: 220px;
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

      strong {
        color: var(--el-text-color-primary);
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

        i {
          flex: none;
          width: 3px;
          height: 3px;
          background: var(--el-text-color-placeholder);
          border-radius: 50%;
        }
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

    :deep(.el-table__body tr.current-row .position-safety-page__position-icon) {
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
        flex: 0 0 760px;
      }
    }
  }
</style>
