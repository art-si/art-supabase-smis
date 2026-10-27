<template>
  <ArtPermissionGuard permission="SmisHazardSourceLedger:View">
    <div class="hazard-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="HAZARD SOURCE CONTROL"
        title="危险源台账"
        description="以场所树为主线，统一维护危险源识别、分级、评价备案、管控责任与现场照片。"
        icon="ri:alarm-warning-line"
        :tags="[
          { label: '场所树导航', type: 'primary', effect: 'plain' },
          { label: '租户编号规则', type: 'success', effect: 'light' },
          { label: '分级统计', type: 'warning', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>
      <div class="hazard-page__workspace">
        <ArtWorkspaceSplitter
          primary-size="292px"
          primary-min="250px"
          primary-max="380px"
          :breakpoint="920"
          stacked-primary-size="34vh"
        >
          <template #primary>
            <SiteNavigator
              :data="state.sites"
              :loading="state.loading"
              :error="state.error"
              :selected-key="state.selectedSiteId"
              @select="handleSiteSelect"
              @refresh="refresh"
            />
          </template>
          <ArtTableQuery
            ref="tableRef"
            v-model="searchQuery"
            class="hazard-page__table"
            :api-fn="fetchTableData"
            :search-items="searchItems"
            :columns-factory="columnsFactory"
            :header-actions="headerActions"
            header-actions-placement="workspace"
            :search-bar-props="{ span: 6, labelWidth: 76, showExpand: false }"
            :table-props="{
              rowKey: 'id',
              tableLayout: 'fixed',
              emptyText: state.selectedSiteId === 'all' ? '暂无危险源' : '当前场所暂无危险源',
              emptyDescription: '可点击新增，建立危险源识别与管控责任。'
            }"
            focusable
            focus-scope-selector=".hazard-page__workspace"
          />
        </ArtWorkspaceSplitter>
      </div>
      <HazardSourceDialog ref="dialogRef" @success="handleSaveSuccess" />
      <HazardSourceDetailDrawer ref="detailRef" />
      <HazardStatisticsDialog ref="statisticsRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import { ElImage, ElMessage } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { exportExcel } from '@/utils/file'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { createImportReferenceLookup } from '@/utils/business/import-reference'
  import TreeUtils from '@/utils/tree'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useUserStore } from '@/store/modules/user'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import {
    deleteHazardSources,
    fetchHazardSourceEmployees,
    fetchHazardSourceList,
    saveHazardSource,
    type SmisHazardSource,
    type SmisHazardSourceSearchParams,
    type SmisHazardSite,
    type SmisTreeOrganization
  } from '@smis/api'
  import SiteNavigator from './modules/site-navigator.vue'
  import HazardSourceDialog, {
    type HazardSourceDialogOpenData
  } from './modules/hazard-source-dialog.vue'
  import HazardStatisticsDialog from './modules/hazard-statistics-dialog.vue'
  import HazardSourceDetailDrawer from './modules/hazard-source-detail-drawer.vue'
  import { prepareHazardSourceImport } from './hazard-source-import'

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  defineOptions({ name: 'SmisHazardSourceLedger' })
  type TableParams = SmisHazardSourceSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: HazardSourceDialogOpenData) => Promise<void>
  }
  interface StatisticsExpose {
    handleOpen: (data: { organizations: SmisTreeOrganization[] }) => Promise<void>
  }
  interface DetailExpose {
    handleOpen: (row: SmisHazardSource) => Promise<void>
  }
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const { confirmDelete } = useArtFeedback()
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const detailRef = ref<DetailExpose>()
  const statisticsRef = ref<StatisticsExpose>()
  const siteTree = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const orgTree = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const overview = reactive({ total: 0, submitted: 0, majorRisk: 0, siteCount: 0 })
  const state = reactive<{
    sites: SmisHazardSite[]
    organizations: SmisTreeOrganization[]
    selectedSiteId: string
    loading: boolean
    error: string | null
  }>({
    sites: [],
    organizations: [],
    selectedSiteId: 'all',
    loading: false,
    error: null
  })
  const searchQuery = ref<SmisHazardSourceSearchParams>({})
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '危险源总数',
      value: overview.total,
      description: '当前租户台账记录',
      icon: 'ri:alarm-warning-line'
    },
    {
      label: '已提交',
      value: overview.submitted,
      description: '纳入正式统计',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '重大风险',
      value: overview.majorRisk,
      description: '需重点管控',
      icon: 'ri:error-warning-line',
      tone: 'danger'
    },
    {
      label: '覆盖场所',
      value: overview.siteCount,
      description: '已识别危险源场所',
      icon: 'ri:map-pin-2-line',
      tone: 'warning'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '编号、名称、地点或备案号' }
    },
    {
      label: '危险等级',
      key: 'hazardLevel',
      type: 'select',
      props: {
        options: dictOptions('smisHazardSourceLevel'),
        clearable: true,
        placeholder: '全部等级'
      }
    },
    {
      label: '风险等级',
      key: 'riskLevel',
      type: 'select',
      props: {
        options: dictOptions('smisHazardSourceRiskLevel'),
        clearable: true,
        placeholder: '全部风险'
      }
    }
  ])
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'hazardName', title: '危险源名称', required: true },
    { key: 'siteName', title: '场所', required: true },
    { key: 'hazardLevel', title: '危险等级', required: true },
    { key: 'riskLevel', title: '风险等级', required: true },
    { key: 'controlOrganizationName', title: '管控部门', required: true },
    { key: 'responsibleEmployeeNo', title: '责任人员工号' },
    { key: 'quantity', title: '数量' },
    { key: 'location', title: '地点' },
    { key: 'evaluationDate', title: '评价时间' },
    { key: 'evaluationOrganization', title: '评价单位' },
    { key: 'filingDate', title: '备案时间' },
    { key: 'filingOrganization', title: '备案单位' },
    { key: 'filingNo', title: '备案号' },
    { key: 'remark', title: '备注' }
  ]
  const openDialog = (row?: SmisHazardSource): void => {
    void dialogRef.value?.handleOpen({
      row,
      sites: state.sites,
      organizations: state.organizations,
      presetSiteId: state.selectedSiteId === 'all' ? undefined : state.selectedSiteId
    })
  }
  const openDetail = (row: SmisHazardSource): void => {
    void detailRef.value?.handleOpen(row)
  }
  const columnsFactory = (): ColumnOption<SmisHazardSource>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'hazardName',
      label: '危险源',
      minWidth: 230,
      fixed: 'left',
      formatter: (row) => (
        <div class="hazard-page__identity">
          <span>
            <ArtSvgIcon icon="ri:alarm-warning-line" />
          </span>
          <span>
            <button
              type="button"
              class="hazard-page__name-link"
              title={`查看${row.hazardName}`}
              onClick={() => openDetail(row)}
            >
              {row.hazardName}
            </button>
            <small>{row.hazardNo}</small>
          </span>
        </div>
      )
    },
    { prop: 'siteName', label: '场所', minWidth: 160, showOverflowTooltip: true },
    {
      prop: 'location',
      label: '地点',
      minWidth: 160,
      showOverflowTooltip: true,
      formatter: (row) => row.location || '—'
    },
    {
      prop: 'quantity',
      label: '数量',
      width: 96,
      align: 'right',
      formatter: (row) => row.quantity ?? '—'
    },
    {
      prop: 'hazardLevel',
      label: '危险等级',
      width: 108,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisHazardSourceLevel" value={row.hazardLevel} display="tag" />
      )
    },
    {
      prop: 'riskLevel',
      label: '风险等级',
      width: 118,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisHazardSourceRiskLevel" value={row.riskLevel} display="tag" />
      )
    },
    {
      prop: 'controlOrganizationName',
      label: '管控部门',
      minWidth: 160,
      showOverflowTooltip: true
    },
    {
      prop: 'responsibleEmployeeName',
      label: '责任人',
      width: 118,
      formatter: (row) => row.responsibleEmployeeName || '待指定'
    },
    {
      prop: 'imageUrls',
      label: '现场照片',
      width: 104,
      align: 'center',
      formatter: (row) =>
        row.imageUrls.length ? (
          <ElImage
            class="hazard-page__thumb"
            src={row.imageUrls[0]}
            previewSrcList={row.imageUrls}
            previewTeleported
            fit="cover"
          />
        ) : (
          <span class="hazard-page__muted">暂无</span>
        )
    },
    {
      prop: 'recordStatus',
      label: '状态',
      width: 98,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="commonDraftSubmittedStatus"
          value={row.recordStatus}
          display="tag"
        />
      )
    },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 164,
      formatter: (row) => formatTableDateTime(row.updateTime)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 160,
      fixed: 'right',
      formatter: (row) => (
        <div>
          <ArtButtonTable
            type="view"
            permission="SmisHazardSourceLedger:View"
            onClick={() => openDetail(row)}
          />
          <ArtButtonTable
            type="edit"
            permission="SmisHazardSourceLedger:Edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            type="delete"
            permission="SmisHazardSourceLedger:Delete"
            disabled={row.recordStatus !== 'draft'}
            onClick={() => void handleDelete(row)}
          />
        </div>
      )
    }
  ]
  const resolveDictValue = (code: string, input: unknown): string => {
    const value = String(input ?? '').trim()
    return (
      getDictMap.value[code]?.find(
        (item) => item.value === value || item.label === value || item.name === value
      )?.value || ''
    )
  }
  const importRows = async (rows: unknown[]): Promise<void> => {
    const flatSites = siteTree.treeToList(state.sites) as SmisHazardSite[]
    const flatOrgs = orgTree.treeToList(state.organizations) as SmisTreeOrganization[]
    const prepared = prepareHazardSourceImport(
      rows,
      flatSites.map((item) => ({ id: item.id, name: item.siteName })),
      flatOrgs.map((item) => ({ id: item.id, name: item.organizationName })),
      resolveDictValue
    )
    const resolveEmployee = createImportReferenceLookup(async (employeeNo) => {
      const employees = await fetchHazardSourceEmployees({
        keyword: employeeNo,
        from: 0,
        to: 99
      })
      return employees.data.filter((item) => item.employeeNo === employeeNo)
    })
    const resolved = []
    for (const row of prepared) {
      const employee = row.responsibleEmployeeNo
        ? await resolveEmployee(
            row.responsibleEmployeeNo,
            `第 ${row.fileRow} 行责任人员工号：${row.responsibleEmployeeNo}`
          )
        : undefined
      resolved.push({ ...row.payload, responsibleEmployeeId: employee?.id })
    }
    for (const payload of resolved) await saveHazardSource(payload)
  }
  const downloadTemplate = async (): Promise<void> => {
    await exportExcel({
      filename: '危险源台账导入模板',
      sheetName: '危险源台账',
      columns: excelColumns,
      data: [
        {
          hazardName: '示例危险源',
          siteName: '请填写场所维护中的场所名称',
          hazardLevel: '三级',
          riskLevel: '一般风险',
          controlOrganizationName: '请填写系统组织部门名称',
          responsibleEmployeeNo: '可选：员工工号',
          quantity: 1,
          location: '示例地点',
          evaluationDate: '2026-09-01',
          evaluationOrganization: '示例评价单位',
          filingDate: '2026-09-01',
          filingOrganization: '示例备案单位',
          filingNo: 'BA-2026-001',
          remark: '可选'
        }
      ]
    })
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisHazardSourceLedger:Add',
      type: 'add',
      label: '新增危险源',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisHazardSourceLedger:Import',
      type: 'import',
      label: '导入',
      importColumns: excelColumns,
      importApi: importRows,
      onImportError: (error) => {
        ElMessage.error(getFriendlySupabaseErrorMessage(error, '导入失败，请检查模板内容'))
      }
    },
    {
      permission: 'SmisHazardSourceLedger:DownloadTemplate',
      key: 'template',
      label: '下载导入模板',
      icon: 'ri:download-2-line',
      onClick: downloadTemplate
    },
    {
      permission: 'SmisHazardSourceLedger:Export',
      type: 'export',
      label: '导出',
      exportFilename: '危险源台账',
      exportSheetName: '危险源台账',
      exportColumns: excelColumns,
      exportApi: async () => ({
        data: (
          await loadAllDocumentPages<SmisHazardSource, SmisHazardSourceSearchParams>(
            fetchHazardSourceList,
            { ...searchQuery.value }
          )
        ).map((row) => ({
          hazardName: row.hazardName,
          siteName: row.siteName,
          hazardLevel: userStore.getDictItemByValue('smisHazardSourceLevel', row.hazardLevel)
            ?.label,
          riskLevel: userStore.getDictItemByValue('smisHazardSourceRiskLevel', row.riskLevel)
            ?.label,
          controlOrganizationName: row.controlOrganizationName,
          responsibleEmployeeNo: row.responsibleEmployeeNo || '',
          quantity: row.quantity ?? '',
          location: row.location || '',
          evaluationDate: row.evaluationDate || '',
          evaluationOrganization: row.evaluationOrganization || '',
          filingDate: row.filingDate || '',
          filingOrganization: row.filingOrganization || '',
          filingNo: row.filingNo || '',
          remark: row.remark || ''
        }))
      })
    },
    {
      permission: 'SmisHazardSourceLedger:Statistics',
      key: 'statistics',
      label: '统计分析',
      icon: 'ri:bar-chart-box-line',
      onClick: () => void statisticsRef.value?.handleOpen({ organizations: state.organizations })
    },
    {
      permission: 'SmisHazardSourceLedger:Delete',
      type: 'delete',
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条草稿危险源吗？`,
      onClick: async ({ selectedRows, api }) => {
        await deleteHazardSources(selectedRows.map((row) => row.id as string))
        await api.refreshRemove()
      }
    }
  ])
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    state.loading = true
    state.error = null
    try {
      const response = await fetchHazardSourceList({
        ...params,
        siteId: state.selectedSiteId === 'all' ? undefined : state.selectedSiteId,
        from,
        to
      })
      if (!options?.signal?.aborted) {
        Object.assign(overview, response.overview)
        state.sites = siteTree.listToTree(response.sites as SmisHazardSite[]) as SmisHazardSite[]
        state.organizations = orgTree.listToTree(
          response.organizations as SmisTreeOrganization[]
        ) as SmisTreeOrganization[]
      }
      return response
    } catch (error) {
      if (!options?.signal?.aborted) state.error = '场所树加载失败，请稍后重试。'
      throw error
    } finally {
      if (!options?.signal?.aborted) state.loading = false
    }
  }
  const handleSiteSelect = (key: string): void => {
    state.selectedSiteId = key
    searchQuery.value.siteId = key === 'all' ? undefined : key
    void tableRef.value?.getData()
  }
  const refresh = (): void => {
    void tableRef.value?.refreshData()
  }
  const handleSaveSuccess = (type: 'add' | 'edit'): void => {
    void (type === 'add' ? tableRef.value?.refreshCreate() : tableRef.value?.refreshUpdate())
  }
  const handleDelete = async (row: SmisHazardSource): Promise<void> => {
    try {
      await confirmDelete(`确定删除危险源“${row.hazardName}”吗？`)
      await deleteHazardSources([row.id])
      await tableRef.value?.refreshRemove()
    } catch {
      /* 用户取消 */
    }
  }
  onMounted(async () => {
    await Promise.all(
      ['smisHazardSourceLevel', 'smisHazardSourceRiskLevel', 'commonDraftSubmittedStatus'].map(
        (code) => userStore.ensureDictLoaded(code)
      )
    )
  })
</script>

<style scoped lang="scss">
  .hazard-page {
    gap: 12px;
    min-width: 0;
  }

  .hazard-page__workspace {
    flex: 1;
    min-height: 0;
  }

  .hazard-page__table {
    min-width: 0;
    height: 100%;
  }

  :deep(.hazard-page__identity) {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  :deep(.hazard-page__identity > span:first-child) {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
    border-radius: var(--el-border-radius-base);
  }

  :deep(.hazard-page__identity > span:last-child) {
    display: grid;
    min-width: 0;
  }

  :deep(.hazard-page__identity strong),
  :deep(.hazard-page__name-link),
  :deep(.hazard-page__identity small) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :deep(.hazard-page__name-link) {
    width: fit-content;
    max-width: 100%;
    padding: 0;
    font: inherit;
    font-weight: 600;
    color: var(--theme-color);
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  :deep(.hazard-page__name-link:hover),
  :deep(.hazard-page__name-link:focus-visible) {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  :deep(.hazard-page__name-link:focus-visible) {
    outline: 2px solid color-mix(in srgb, var(--theme-color) 45%, transparent);
    outline-offset: 2px;
    border-radius: var(--art-surface-radius);
  }

  :deep(.hazard-page__identity small) {
    margin-top: 2px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  :deep(.hazard-page__thumb) {
    width: 48px;
    height: 36px;
    border-radius: var(--el-border-radius-small);
  }

  :deep(.hazard-page__muted) {
    color: var(--el-text-color-placeholder);
  }
</style>
