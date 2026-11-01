<template>
  <div class="site-page business-workspace-page art-full-height">
    <BusinessWorkspaceHeader
      class="site-page__overview"
      eyebrow="SITE MASTER DATA"
      title="场所维护"
      description="以树形层级维护部门场所、责任人员、现场图片与地图坐标，为安全业务提供统一位置底座。"
      icon="ri:map-pin-2-line"
      density="compact"
      :tags="[
        { label: '树形场所层级', type: 'primary', effect: 'plain' },
        { label: '员工花名册联动', type: 'success', effect: 'light' },
        { label: '地图选点', type: 'info', effect: 'plain' }
      ]"
      :metrics="workspaceMetrics"
    >
      <template #actions>
        <BusinessTableWorkspaceActions :table="tableQueryRef" />
      </template>
    </BusinessWorkspaceHeader>

    <div class="site-page__workspace">
      <ArtWorkspaceSplitter
        primary-size="288px"
        primary-min="244px"
        primary-max="380px"
        :breakpoint="820"
        stacked-primary-size="320px"
      >
        <template #primary>
          <aside class="site-page__department-panel">
            <DepartmentNavigator
              :data="organizationState.tree"
              :loading="organizationState.loading"
              :error="organizationState.error"
              :selected-key="organizationState.selectedKey"
              @select="handleOrganizationSelect"
              @refresh="handleOrganizationRefresh"
            />
          </aside>
        </template>

        <main class="site-page__main">
          <ArtTableQuery
            ref="tableQueryRef"
            v-model="searchQuery"
            class="site-page__table"
            :api-params="{ current: 1, size: 1000 }"
            :api-fn="fetchTableData"
            :search-items="searchItems"
            :columns-factory="columnsFactory"
            :header-actions="headerActions"
            header-actions-placement="workspace"
            :search-bar-props="{ span: 8, labelWidth: 86, showExpand: false }"
            :table-props="tableProps"
            focusable
            focus-scope-selector=".site-page__workspace"
          />
        </main>
      </ArtWorkspaceSplitter>
    </div>

    <SiteDialog ref="dialogRef" @success="handleSaveSuccess" />
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </div>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { toDictionaryOption } from '@/utils/form/option'

  import { ElImage, ElMessage } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext,
    ArtTableQueryTableProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'

  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { fetchOrganizationOptionsTree } from '@/api/system-manage'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase/error'
  import TreeUtils from '@/utils/tree'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import {
    deleteSites,
    fetchSiteEmployeeOptions,
    fetchSiteList,
    saveSite,
    type SmisSite,
    type SmisSiteSearchParams
  } from '@smis/api'
  import DepartmentNavigator from './modules/department-navigator.vue'
  import SiteDialog, { type SiteDialogOpenData } from './modules/site-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard('mdm_site', '场所')

  defineOptions({ name: 'SmisSite' })
  type Organization = Api.SystemManage.OrganizationListItem
  interface DialogExpose {
    handleOpen: (data: SiteDialogOpenData) => Promise<void>
  }
  interface SiteImportRow {
    organizationCode: string
    parentSiteName?: string
    siteName: string
    categoryCode: string
    sort?: string | number
    responsibleEmployeeNo?: string
    addressDetail?: string
    longitude?: string | number
    latitude?: string | number
    imageUrls?: string
    remark?: string
  }

  const ALL_ORGANIZATIONS_KEY = 'all'

  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const { effectiveTenantId } = storeToRefs(useTenantScopeStore())
  const organizationTreeUtils = new TreeUtils({
    idKey: 'id',
    parentKey: 'parentId',
    childrenKey: 'children'
  })
  const siteTreeUtils = new TreeUtils({
    idKey: 'id',
    parentKey: 'parentId',
    childrenKey: 'children'
  })
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const organizationState = reactive({
    tree: [] as Organization[],
    loading: false,
    error: null as string | null,
    selectedKey: ALL_ORGANIZATIONS_KEY
  })
  const allSites = shallowRef<SmisSite[]>([])
  const displaySites = shallowRef<SmisSite[]>([])
  const searchQuery = ref<SmisSiteSearchParams>({
    keyword: '',
    categoryCode: undefined
  })

  const flatOrganizations = computed(() => organizationTreeUtils.treeToList(organizationState.tree))
  const selectedOrganization = computed(() =>
    organizationState.selectedKey === ALL_ORGANIZATIONS_KEY
      ? undefined
      : organizationTreeUtils.findNode(organizationState.tree, organizationState.selectedKey)
  )
  const selectedOrganizationIds = computed(() => {
    if (!selectedOrganization.value?.id) return []
    return organizationTreeUtils
      .getDescendants(organizationState.tree, selectedOrganization.value.id, true)
      .map((organization) => organization.id)
      .filter((id): id is string => Boolean(id))
  })
  const categoryOptions = computed(() =>
    (getDictMap.value.smisSiteCategory ?? []).map(toDictionaryOption)
  )
  const resolveCategory = (value: string): string =>
    categoryOptions.value.find((item) => item.value === value)?.label || value
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '场所节点',
      value: allSites.value.length,
      description: '当前租户已维护',
      icon: 'ri:node-tree'
    },
    {
      label: '一级场所',
      value: allSites.value.filter((row) => !row.parentId).length,
      description: '树形根节点',
      icon: 'ri:folder-3-line'
    },
    {
      label: '已定责任人',
      value: allSites.value.filter((row) => row.responsibleEmployeeId).length,
      description: '来自员工花名册',
      icon: 'ri:user-star-line',
      tone: 'success'
    },
    {
      label: '已定位',
      value: allSites.value.filter((row) => row.longitude != null && row.latitude != null).length,
      description: '已取得经纬度',
      icon: 'ri:map-pin-line',
      tone: 'warning'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '场所名称、责任人、手机号或地址' }
    },
    {
      label: '属性类别',
      key: 'categoryCode',
      type: 'select',
      props: { options: categoryOptions.value, clearable: true, placeholder: '全部类别' }
    }
  ])
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'organizationCode', title: '部门编码', required: true },
    { key: 'parentSiteName', title: '上级场所' },
    { key: 'siteName', title: '场所名称', required: true },
    { key: 'categoryCode', title: '属性类别', required: true },
    { key: 'sort', title: '顺序号' },
    { key: 'responsibleEmployeeNo', title: '责任人员工号' },
    { key: 'addressDetail', title: '场所地址' },
    { key: 'longitude', title: '经度' },
    { key: 'latitude', title: '纬度' },
    { key: 'imageUrls', title: '图片地址（多个用逗号分隔）' },
    { key: 'remark', title: '备注' }
  ]

  const buildTree = (rows: SmisSite[]): SmisSite[] => {
    const validRows = rows.filter(
      (row): row is SmisSite & { id: string } => typeof row.id === 'string'
    )
    return siteTreeUtils.listToTree(validRows, (left, right) => {
      return left.sort - right.sort || left.siteName.localeCompare(right.siteName, 'zh-CN')
    })
  }
  const filterRows = (rows: SmisSite[], params: SmisSiteSearchParams): SmisSite[] => {
    const keyword = params.keyword?.trim().toLocaleLowerCase('zh-CN')
    const map = new Map(rows.map((row) => [row.id, row]))
    const included = new Set<string>()
    const organizationIds = new Set(selectedOrganizationIds.value)
    rows.forEach((row) => {
      const matchesKeyword =
        !keyword ||
        [
          row.siteName,
          row.organization.organizationName,
          row.responsible?.employeeName,
          row.responsible?.phone,
          row.addressDetail
        ].some((value) =>
          String(value ?? '')
            .toLocaleLowerCase('zh-CN')
            .includes(keyword)
        )
      if (
        matchesKeyword &&
        (!organizationIds.size || organizationIds.has(row.organizationId)) &&
        (!params.categoryCode || row.categoryCode === params.categoryCode)
      ) {
        let current: SmisSite | undefined = row
        while (current?.id) {
          included.add(current.id)
          current = current.parentId ? map.get(current.parentId) : undefined
        }
      }
    })
    return rows.filter((row) => row.id && included.has(row.id))
  }
  const fetchTableData = async (params: SmisSiteSearchParams) => {
    const response = await fetchSiteList()
    allSites.value = response.data ?? []
    const filtered = filterRows(allSites.value, params)
    displaySites.value = buildTree(filtered)
    return { data: displaySites.value, total: filtered.length, error: response.error }
  }
  const tableProps = computed<ArtTableQueryTableProps>(() => ({
    rowKey: 'id',
    treeProps: { children: 'children' },
    indent: 20,
    tableLayout: 'fixed',
    emptyText: selectedOrganization.value ? '当前部门暂无场所' : '暂无场所数据',
    emptyDescription: selectedOrganization.value
      ? '可新增当前部门的一级场所，再逐级维护下级区域与位置。'
      : '可新增一级场所，再逐级维护下级区域与位置。',
    paginationOptions: { hideOnSinglePage: true },
    rowClassName: ({ row }) => (row.parentId ? 'site-tree-row is-child' : 'site-tree-row is-root')
  }))

  const openDialog = (row?: SmisSite, parent?: SmisSite): void => {
    const excluded = row?.id ? new Set(collectDescendantIds(row.id)) : new Set<string>()
    if (row?.id) excluded.add(row.id)
    void dialogRef.value?.handleOpen({
      organizations: organizationState.tree,
      sites: buildTree(allSites.value.filter((item) => !item.id || !excluded.has(item.id))),
      row,
      parent,
      initialOrganizationId: selectedOrganization.value?.id
    })
  }
  const collectDescendantIds = (id: string): string[] => {
    return siteTreeUtils
      .getDescendants(buildTree(allSites.value), id)
      .map((site) => site.id)
      .filter((siteId): siteId is string => Boolean(siteId))
  }
  const handleMoreAction = (item: ButtonMoreItem, row: SmisSite): void => {
    if (item.key === 'addChild') openDialog(undefined, row)
    if (item.key === 'delete') void handleDelete(row)
  }
  const moreActions: ButtonMoreItem[] = [
    { auth: 'SmisSite:Add', key: 'addChild', label: '新增下级', icon: 'ri:add-line' },
    {
      auth: 'SmisSite:Delete',
      key: 'delete',
      label: '删除',
      icon: 'ri:delete-bin-line',
      color: 'var(--el-color-danger)'
    }
  ]
  const columnsFactory = (): ColumnOption<SmisSite>[] => [
    { type: 'selection', width: 48 },
    {
      prop: 'siteName',
      label: '场所层级',
      className: 'site-tree-identity-cell',
      minWidth: 260,
      fixed: 'left',
      formatter: (row) => (
        <div class="site-page__identity">
          <span aria-hidden="true">
            <ArtSvgIcon icon={row.children?.length ? 'ri:folder-3-line' : 'ri:map-pin-line'} />
          </span>
          <span>
            <strong title={row.siteName}>{row.siteName}</strong>
            <small>{row.parentSiteName || '一级场所'}</small>
          </span>
        </div>
      )
    },
    {
      prop: 'organization',
      label: '部门名称',
      minWidth: 180,
      formatter: (row) => (
        <div class="site-page__stack">
          <strong>{row.organization.organizationName}</strong>
          <small>{row.organization.parentOrganizationName || '顶级组织'}</small>
        </div>
      )
    },
    {
      prop: 'categoryCode',
      label: '属性类别',
      width: 108,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisSiteCategory" value={row.categoryCode} display="tag" />
      )
    },
    { prop: 'sort', label: '顺序号', width: 82, align: 'center' },
    {
      prop: 'responsible',
      label: '责任人 / 职务',
      minWidth: 170,
      formatter: (row) =>
        row.responsible ? (
          <div class="site-page__stack">
            <strong>{row.responsible.employeeName}</strong>
            <small>{row.responsible.jobTitle || '职务未维护'}</small>
          </div>
        ) : (
          <span class="site-page__muted">待指定</span>
        )
    },
    {
      prop: 'phone',
      label: '手机号',
      width: 128,
      formatter: (row) => row.responsible?.phone || '—'
    },
    {
      prop: 'imageUrls',
      label: '所属图片',
      width: 112,
      formatter: (row) =>
        row.imageUrls?.length ? (
          <ElImage
            class="site-page__thumb"
            src={row.imageUrls[0]}
            previewSrcList={row.imageUrls}
            previewTeleported
            fit="cover"
          />
        ) : (
          <span class="site-page__muted">暂无图片</span>
        )
    },
    {
      prop: 'location',
      label: '地址 / 经纬度',
      minWidth: 240,
      formatter: (row) => (
        <div class="site-page__stack">
          <strong title={row.addressDetail || ''}>{row.addressDetail || '地址未维护'}</strong>
          <small>
            {row.longitude != null && row.latitude != null
              ? `${row.longitude}, ${row.latitude}`
              : '坐标未获取'}
          </small>
        </div>
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 120,
      fixed: 'right',
      formatter: (row) => (
        <div class="site-page__actions">
          <ArtButtonTable type="edit" permission="SmisSite:Edit" onClick={() => openDialog(row)} />
          <ArtButtonMore
            list={moreActions}
            onClick={(item: ButtonMoreItem) => handleMoreAction(item, row)}
          />
        </div>
      )
    }
  ]

  const importRows = async (rows: unknown[]): Promise<void> => {
    const scopedTenantId = effectiveTenantId.value ?? selectedOrganization.value?.tenantId
    const organizationsByCode = new Map<string, Organization[]>()
    for (const organization of flatOrganizations.value) {
      if (scopedTenantId && organization.tenantId !== scopedTenantId) continue
      const matches = organizationsByCode.get(organization.organizationCode) ?? []
      matches.push(organization)
      organizationsByCode.set(organization.organizationCode, matches)
    }
    const siteResponse = await fetchSiteList({ showErrorMessage: false })
    if (siteResponse.error) {
      throw new Error('场所层级加载失败，请重试导入', { cause: siteResponse.error })
    }
    const siteIdsByOrganization = new Map<string, Map<string, string[]>>()
    const addSite = (organizationId: string, siteName: string, siteId: string): void => {
      const names = siteIdsByOrganization.get(organizationId) ?? new Map<string, string[]>()
      names.set(siteName, [...(names.get(siteName) ?? []), siteId])
      siteIdsByOrganization.set(organizationId, names)
    }
    for (const site of siteResponse.data ?? []) {
      if (site.id) addSite(site.organizationId, site.siteName, site.id)
    }
    const employeeIds = new Map<string, string>()

    let savedCount = 0
    try {
      for (const [index, value] of rows.entries()) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error(`第 ${index + 1} 行格式无效，请检查导入模板`)
        }
        const raw = value as Partial<SiteImportRow>
        const organizationCode = String(raw.organizationCode ?? '').trim()
        const organizations = organizationsByCode.get(organizationCode) ?? []
        if (organizations.length !== 1 || !organizations[0].id) {
          throw new Error(
            organizations.length > 1
              ? `第 ${index + 1} 行部门编码“${organizationCode}”对应多个租户，请先指定租户后重试`
              : `第 ${index + 1} 行未找到部门编码“${organizationCode}”，请核对当前租户`
          )
        }
        const organization = organizations[0]
        const organizationId = organization.id
        const organizationTenantId = organization.tenantId
        if (!organizationId || !organizationTenantId) {
          throw new Error(`第 ${index + 1} 行部门缺少租户归属，请刷新部门结构后重试`)
        }
        const category = categoryOptions.value.find(
          (item) => item.value === raw.categoryCode || item.label === raw.categoryCode
        )
        if (!category)
          throw new Error(`第 ${index + 1} 行无法识别属性类别“${raw.categoryCode ?? ''}”`)
        let employeeId: string | null = null
        if (raw.responsibleEmployeeNo) {
          const employeeNo = String(raw.responsibleEmployeeNo).trim()
          const employeeKey = `${organizationTenantId}:${employeeNo}`
          employeeId = employeeIds.get(employeeKey) ?? null
          if (!employeeId) {
            let from = 0
            while (!employeeId) {
              const employees = await fetchSiteEmployeeOptions(
                { keyword: employeeNo, from, to: from + 99 },
                { showErrorMessage: false }
              )
              if (employees.error) {
                throw new Error(`第 ${index + 1} 行责任人员工查询失败，请重试`, {
                  cause: employees.error
                })
              }
              employeeId =
                employees.data.find(
                  (item) => item.employeeNo === employeeNo && item.tenantId === organizationTenantId
                )?.id ?? null
              from += 100
              if (employeeId || from >= employees.total || !employees.data.length) break
            }
            if (!employeeId) {
              throw new Error(`第 ${index + 1} 行未找到当前部门租户的责任人员工号“${employeeNo}”`)
            }
            employeeIds.set(employeeKey, employeeId)
          }
        }
        const parentName = String(raw.parentSiteName ?? '').trim()
        const parentIds = parentName
          ? (siteIdsByOrganization.get(organizationId)?.get(parentName) ?? [])
          : []
        if (parentName && parentIds.length !== 1) {
          throw new Error(
            parentIds.length > 1
              ? `第 ${index + 1} 行上级场所“${parentName}”存在重名，请先整理层级后重试`
              : `第 ${index + 1} 行未找到上级场所“${parentName}”，请先导入父级场所`
          )
        }
        const siteName = String(raw.siteName ?? '').trim()
        if (!siteName) throw new Error(`第 ${index + 1} 行缺少场所名称`)
        const sort = raw.sort == null || raw.sort === '' ? 0 : Number(raw.sort)
        if (!Number.isInteger(sort) || sort < 0 || sort > 999999) {
          throw new Error(`第 ${index + 1} 行顺序号应为 0 到 999999 的整数`)
        }
        const saved = await saveSite(
          {
            organizationId,
            parentId: parentIds[0] ?? null,
            siteName,
            categoryCode: category.value,
            sort,
            responsibleEmployeeId: employeeId,
            addressDetail: raw.addressDetail || '',
            longitude: raw.longitude ?? null,
            latitude: raw.latitude ?? null,
            coordinateSystem: 'gcj02',
            imageUrls: String(raw.imageUrls || '')
              .split(/[,，]/)
              .map((item) => item.trim())
              .filter(Boolean),
            remark: raw.remark || ''
          },
          { showMessage: false }
        )
        if (!saved.data) {
          throw new Error(`第 ${index + 1} 行场所已提交，但服务未返回编号；请刷新列表核对结果`)
        }
        addSite(organizationId, siteName, saved.data)
        savedCount += 1
      }
    } catch (error) {
      const message = getFriendlySupabaseErrorMessage(error, '场所导入中断，请检查数据后重试')
      throw new Error(
        savedCount
          ? `${message}；已有 ${savedCount} 行保存成功，请刷新列表核对后仅重试未导入行`
          : message,
        { cause: error }
      )
    }
    ElMessage.success(`已导入 ${savedCount} 个场所`)
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    { permission: 'SmisSite:Add', type: 'add', label: '新增场所', onClick: () => openDialog() },
    {
      permission: 'SmisSite:Import',
      type: 'import',
      importColumns: excelColumns,
      importApi: importRows,
      onImportError: () => {
        ElMessage.error('导入失败，请检查部门编码、层级、责任人员工号和坐标格式')
      }
    },
    {
      permission: 'SmisSite:Export',
      type: 'export',
      exportFilename: '场所维护',
      exportSheetName: '场所维护',
      exportColumns: excelColumns,
      exportApi: async () => ({
        data: filterRows((await fetchSiteList()).data ?? [], searchQuery.value).map((row) => ({
          organizationCode: row.organization.organizationCode,
          parentSiteName: row.parentSiteName || '',
          siteName: row.siteName,
          categoryCode: resolveCategory(row.categoryCode),
          sort: row.sort,
          responsibleEmployeeNo: row.responsible?.employeeNo || '',
          addressDetail: row.addressDetail || '',
          longitude: row.longitude ?? '',
          latitude: row.latitude ?? '',
          imageUrls: row.imageUrls.join(','),
          remark: row.remark || ''
        }))
      })
    },
    {
      permission: 'SmisSite:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 个场所吗？存在下级场所时系统会阻止删除。`,
      onClick: async ({ selectedRows, api }) => {
        const ids = selectedRows
          .map((row) => row.id)
          .filter((id): id is string => typeof id === 'string')
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.siteName ?? '场所')
          })),
          permission: 'SmisSite:Delete',
          remove: async () => {
            await deleteSites(ids)
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    }
  ])
  const loadOrganizations = async (): Promise<void> => {
    organizationState.loading = true
    organizationState.error = null
    try {
      const response = await fetchOrganizationOptionsTree(
        {
          status: '1',
          tenantId: effectiveTenantId.value ?? undefined
        },
        { showErrorMessage: false }
      )
      if (response.error) throw response.error
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
        '部门结构加载失败，请稍后重试'
      )
    } finally {
      organizationState.loading = false
    }
  }
  const handleOrganizationSelect = async (key: string): Promise<void> => {
    if (organizationState.selectedKey === key) return
    organizationState.selectedKey = key
    await tableQueryRef.value?.getData()
  }
  const handleOrganizationRefresh = async (): Promise<void> => {
    await loadOrganizations()
    await tableQueryRef.value?.getData()
  }
  const handleSaveSuccess = (type: 'add' | 'edit'): void => {
    void (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
  }
  const handleDelete = async (row: SmisSite): Promise<void> => {
    if (!row.id) return

    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.siteName ?? '场所')
        }
      ],
      permission: 'SmisSite:Delete',
      confirmMessage: `确定删除场所“${row.siteName}”吗？存在下级场所时系统会阻止删除。`,
      remove: async () => {
        await deleteSites([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
      }
    })
  }
  onMounted(async () => {
    await Promise.all([userStore.ensureDictLoaded('smisSiteCategory'), loadOrganizations()])
  })
</script>

<style scoped lang="scss">
  .site-page {
    min-width: 0;

    &__overview {
      flex: 0 0 auto;
      min-width: 0;
      overflow: hidden;
    }

    &__workspace {
      flex: 1 1 auto;
      width: 100%;
      min-width: 0;
      min-height: 0;
    }

    &__department-panel,
    &__main,
    &__table {
      min-width: 0;
      min-height: 0;
    }

    &__department-panel {
      overflow: hidden;
    }

    &__main {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    &__table {
      flex: 1 1 auto;
    }

    :deep(.site-tree-row.is-root > td) {
      background: color-mix(in srgb, var(--theme-color) 3%, var(--el-bg-color));
    }

    :deep(.site-tree-row.is-root > td:first-child) {
      box-shadow: inset 3px 0 0 var(--theme-color);
    }

    :deep(.site-tree-identity-cell > .cell) {
      display: flex;
      align-items: center;
      overflow: hidden;
    }

    :deep(.site-tree-identity-cell .art-table__cell-content) {
      flex: 1;
      min-width: 0;
    }

    :deep(.site-tree-identity-cell .el-table__indent) {
      flex-shrink: 0;
    }

    :deep(.site-tree-identity-cell .el-table__placeholder) {
      flex: 0 0 28px;
      width: 28px;
    }

    :deep(.site-tree-row .el-table__expand-icon) {
      display: inline-flex;
      flex: 0 0 22px;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      margin-right: 6px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
      border-radius: var(--el-border-radius-small);
    }

    :deep(.site-page__identity) {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;
    }

    :deep(.site-page__identity > span:first-child) {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
      border-radius: var(--el-border-radius-base);
    }

    :deep(.site-page__identity > span:last-child),
    :deep(.site-page__stack) {
      display: grid;
      align-content: center;
      min-width: 0;
    }

    :deep(.site-page__identity strong),
    :deep(.site-page__identity small),
    :deep(.site-page__stack strong),
    :deep(.site-page__stack small) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.site-page__identity strong),
    :deep(.site-page__stack strong) {
      line-height: 20px;
    }

    :deep(.site-page__identity small),
    :deep(.site-page__stack small) {
      margin-top: 2px;
      font-size: 11px;
      line-height: 16px;
      color: var(--el-text-color-secondary);
    }

    :deep(.site-page__muted) {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }

    :deep(.site-page__thumb) {
      width: 52px;
      height: 38px;
      border-radius: var(--el-border-radius-small);
    }

    :deep(.site-page__actions .art-button-table) {
      flex: 0 0 32px;
      margin-right: 0;
    }

    @media (width <= 820px) {
      &__main {
        flex: 0 0 760px;
      }
    }
  }
</style>
