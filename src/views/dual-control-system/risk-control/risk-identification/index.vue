<template>
  <ArtPermissionGuard permission="SmisDualControlRiskIdentification:View" resource-name="风险辨识">
    <div class="risk-identification-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="risk-identification-page__overview"
        eyebrow="RISK IDENTIFICATION WORKSPACE"
        title="风险辨识"
        description="以场所为主线维护风险点，关联辨识单位与设备台账，并在同一工作区建立作业活动和危害因素的多对多关系。"
        icon="ri:radar-line"
        density="compact"
        :tags="[
          { label: '场所主数据驱动', type: 'primary', effect: 'plain' },
          { label: '危害活动双向关联', type: 'warning', effect: 'light' },
          { label: '风险等级自动汇总', type: 'success', effect: 'plain' }
        ]"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <ArtTableQuery
        ref="tableQueryRef"
        class="risk-identification-page__table"
        v-model="searchQuery"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 82, showExpand: true }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无风险点',
          emptyDescription: '可手工新增风险点，或按场所主数据一键生成后继续维护危害因素。'
        }"
        focusable
      />

      <RiskPointDialog ref="dialogRef" @success="handleSaveSuccess" />
      <HazardWorkspaceDialog ref="hazardDialogRef" @changed="handleHazardChanged" />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import { ElImage, ElTag } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import type { ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'

  import { useUserStore } from '@/store/modules/user'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtButtonMore from '@/components/core/forms/art-button-more/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    copyRiskPoint,
    deleteRiskPoints,
    fetchRiskIdentificationOptions,
    fetchRiskPointList,
    generateAllRiskPoints,
    saveRiskPoint,
    type SmisRiskIdentificationOptions,
    type SmisRiskPoint,
    type SmisRiskPointLevel,
    type SmisRiskPointOverview,
    type SmisRiskPointSearchParams,
    type SmisRiskPointType
  } from '@smis/api'
  import { toDualControlOrganizationTree } from '@smis/views/dual-control-system/shared/organization-tree'
  import RiskPointDialog, { type RiskPointDialogOpenData } from './modules/risk-point-dialog.vue'
  import HazardWorkspaceDialog, {
    type HazardWorkspaceDialogOpenData
  } from './modules/hazard-workspace-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard('smis_risk_point', '风险点')

  defineOptions({ name: 'SmisDualControlRiskIdentification' })

  type TableParams = SmisRiskPointSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface RiskPointDialogExpose {
    handleOpen: (data: RiskPointDialogOpenData) => Promise<void>
  }
  interface HazardDialogExpose {
    handleOpen: (data: HazardWorkspaceDialogOpenData) => Promise<void>
  }
  interface RiskPointImportRow {
    pointName?: string
    riskType?: string
    siteName?: string
    organizationCodes?: string
    equipmentName?: string
    isSpecialEquipment?: string | boolean
    controlPlanName?: string
    photoUrls?: string
    attachmentUrls?: string
    sort?: string | number
  }
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<RiskPointDialogExpose>()
  const hazardDialogRef = ref<HazardDialogExpose>()
  const options = shallowRef<SmisRiskIdentificationOptions>({
    sites: [],
    organizations: [],
    equipment: [],
    hazardCategories: []
  })
  const optionsLoading = ref(false)
  const searchQuery = ref<SmisRiskPointSearchParams>({})
  const overview = reactive<SmisRiskPointOverview>({
    total: 0,
    identified: 0,
    specialEquipment: 0,
    unidentified: 0
  })
  const defaultRiskTypeOptions: Array<{ label: string; value: SmisRiskPointType }> = [
    { label: '未选择', value: 'unset' },
    { label: '部位场所', value: 'location' },
    { label: '设备设施', value: 'equipment' },
    { label: '作业活动', value: 'activity' }
  ]
  const riskTypeOptions = computed<Array<{ label: string; value: SmisRiskPointType }>>(() => {
    const dictionary = getDictMap.value.smisRiskPointType ?? []
    return dictionary.length
      ? dictionary.map((item) => ({
          label: item.label || item.name,
          value: item.value as SmisRiskPointType
        }))
      : defaultRiskTypeOptions
  })
  const riskTypeLabel = computed(
    () => new Map(riskTypeOptions.value.map((item) => [item.value, item.label]))
  )
  const riskLevelOptions = computed(() =>
    (getDictMap.value.smisHazardSourceRiskLevel ?? []).map((item) => ({
      label: item.label || item.name,
      value: item.value as SmisRiskPointLevel
    }))
  )
  const organizationTreeData = computed(() =>
    toDualControlOrganizationTree(options.value.organizations)
  )
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '风险点总数',
      value: overview.total,
      description: '当前租户有效记录',
      icon: 'ri:map-pin-range-line'
    },
    {
      label: '已维护危害',
      value: overview.identified,
      description: '至少包含一条危害因素',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '特种设备风险点',
      value: overview.specialEquipment,
      description: '来源特种设备台账',
      icon: 'ri:alert-line',
      tone: 'warning'
    },
    {
      label: '待风险评价',
      value: overview.unidentified,
      description: '尚未形成自动等级',
      icon: 'ri:timer-line'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '风险点编号或名称' }
    },
    {
      label: '辨识单位',
      key: 'organizationId',
      type: 'treeSelect',
      props: {
        data: organizationTreeData.value,
        props: { label: 'organizationName', value: 'id', children: 'children' },
        nodeKey: 'id',
        valueKey: 'id',
        checkStrictly: true,
        defaultExpandAll: true,
        filterable: true,
        clearable: true,
        placeholder: '全部部门'
      }
    },
    {
      label: '场所',
      key: 'siteId',
      type: 'select',
      props: {
        options: options.value.sites.map((item) => ({ label: item.siteName, value: item.id })),
        filterable: true,
        clearable: true,
        placeholder: '全部场所'
      }
    },
    {
      label: '设备设施',
      key: 'equipment',
      type: 'input',
      props: { clearable: true, placeholder: '设备设施名称' }
    },
    {
      label: '风险等级',
      key: 'riskLevel',
      type: 'select',
      props: { options: riskLevelOptions.value, clearable: true, placeholder: '全部等级' }
    },
    {
      label: '风险类型',
      key: 'riskType',
      type: 'select',
      props: { options: riskTypeOptions.value, clearable: true, placeholder: '全部类型' }
    }
  ])
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'pointNo', title: '风险点编号' },
    { key: 'pointName', title: '风险点名称', required: true },
    { key: 'riskType', title: '风险类型', required: true },
    { key: 'siteName', title: '场所', required: true },
    { key: 'organizationCodes', title: '辨识单位编码（多个用逗号分隔）', required: true },
    { key: 'equipmentName', title: '设备设施', required: true },
    { key: 'isSpecialEquipment', title: '是否特种设备' },
    { key: 'controlPlanName', title: '风险管控方案' },
    { key: 'photoUrls', title: '图片地址（多个用逗号分隔）' },
    { key: 'attachmentUrls', title: '附件地址（多个用逗号分隔）' },
    { key: 'riskLevel', title: '风险点等级' },
    { key: 'sort', title: '排序' }
  ]

  const loadOptions = async (): Promise<void> => {
    optionsLoading.value = true
    try {
      options.value = await fetchRiskIdentificationOptions()
    } finally {
      optionsLoading.value = false
    }
  }
  const openDialog = async (row?: SmisRiskPoint): Promise<void> => {
    await dialogRef.value?.handleOpen({
      row,
      options: options.value,
      loadOptions: async () => {
        await loadOptions()
        return options.value
      }
    })
  }
  const openHazardWorkspace = async (row: SmisRiskPoint): Promise<void> => {
    await hazardDialogRef.value?.handleOpen({
      riskPoint: row,
      options: options.value,
      loadOptions: async () => {
        await loadOptions()
        return options.value
      }
    })
  }
  const moreActions: ButtonMoreItem[] = [
    {
      auth: 'SmisDualControlRiskIdentification:Copy',
      key: 'copy',
      label: '复制风险点',
      icon: 'ri:file-copy-line'
    },
    {
      auth: 'SmisDualControlRiskIdentification:Delete',
      key: 'delete',
      label: '删除',
      icon: 'ri:delete-bin-line',
      color: 'var(--el-color-danger)'
    }
  ]
  const handleMoreAction = async (item: ButtonMoreItem, row: SmisRiskPoint): Promise<void> => {
    if (item.key === 'copy') {
      await copyRiskPoint(row.id)
      await tableQueryRef.value?.refreshCreate()
    }
    if (item.key === 'delete') await handleDelete(row)
  }
  const columnsFactory = (): ColumnOption<SmisRiskPoint>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 70 },
    {
      prop: 'pointNo',
      label: '风险点编号',
      width: 128,
      fixed: 'left',
      formatter: (row) => <span class="risk-identification-page__code">{row.pointNo}</span>
    },
    {
      prop: 'pointName',
      label: '风险点名称',
      minWidth: 220,
      fixed: 'left',
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.pointName}
          secondary={riskTypeLabel.value.get(row.riskType) || '未选择'}
          icon="ri:map-pin-range-line"
        />
      )
    },
    {
      prop: 'riskType',
      label: '风险类型',
      width: 106,
      align: 'center',
      formatter: (row) => <ElTag effect="plain">{riskTypeLabel.value.get(row.riskType)}</ElTag>
    },
    { prop: 'siteName', label: '场所', minWidth: 170, showOverflowTooltip: true },
    {
      prop: 'organizations',
      label: '辨识单位',
      minWidth: 230,
      formatter: (row) => (
        <div class="risk-identification-page__stack">
          <strong title={row.organizations.map((item) => item.organizationName).join('、')}>
            {row.organizations.map((item) => item.organizationName).join('、') || '—'}
          </strong>
          <small>
            {row.organizations.map((item) => item.organizationCode).join('、') || '编码未维护'}
          </small>
        </div>
      )
    },
    {
      prop: 'equipmentName',
      label: '设备设施',
      minWidth: 180,
      formatter: (row) => (
        <div class="risk-identification-page__equipment">
          <span title={row.equipmentName}>{row.equipmentName}</span>
          {row.isSpecialEquipment ? (
            <ElTag type="warning" size="small">
              特种设备
            </ElTag>
          ) : null}
        </div>
      )
    },
    {
      prop: 'photoUrls',
      label: '图片',
      width: 92,
      align: 'center',
      formatter: (row) =>
        row.photoUrls.length ? (
          <ElImage
            class="risk-identification-page__thumb"
            src={row.photoUrls[0]}
            previewSrcList={row.photoUrls}
            previewTeleported
            fit="cover"
          />
        ) : (
          <span class="risk-identification-page__muted">暂无</span>
        )
    },
    {
      prop: 'attachmentUrls',
      label: '附件',
      width: 92,
      align: 'center',
      formatter: (row) => (
        <span
          class={
            row.attachmentUrls.length
              ? 'risk-identification-page__attachment'
              : 'risk-identification-page__muted'
          }
        >
          <ArtSvgIcon icon="ri:attachment-2" /> {row.attachmentUrls.length || '暂无'}
        </span>
      )
    },
    {
      prop: 'hazardCount',
      label: '危害 / 活动',
      width: 116,
      align: 'center',
      formatter: (row) => `${row.hazardCount} / ${row.activityCount}`
    },
    {
      prop: 'riskLevel',
      label: '风险点等级',
      width: 132,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisHazardSourceRiskLevel" value={row.riskLevel} display="tag" />
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 160,
      fixed: 'right',
      formatter: (row) => (
        <div class="risk-identification-page__actions">
          <ArtButtonTable
            type="edit"
            permission="SmisDualControlRiskIdentification:Edit"
            label="编辑风险点"
            onClick={() => void openDialog(row)}
          />
          <ArtButtonTable
            type="edit"
            icon="ri:git-merge-line"
            permission="SmisDualControlRiskIdentification:MaintainHazards"
            label="维护危害因素"
            onClick={() => void openHazardWorkspace(row)}
          />
          <ArtButtonMore
            list={moreActions}
            onClick={(item: ButtonMoreItem) => void handleMoreAction(item, row)}
          />
        </div>
      )
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const response = await fetchRiskPointList({ ...params, from, to }, { showErrorMessage: false })
    if (options?.signal?.aborted) return response
    if (response.error) throw new Error('风险辨识加载失败，请重新加载', { cause: response.error })
    Object.assign(overview, response.overview)
    return response
  }
  const parseBoolean = (value: string | boolean | undefined): boolean =>
    value === true ||
    ['是', 'true', '1', 'yes'].includes(
      String(value || '')
        .trim()
        .toLowerCase()
    )
  const splitValues = (value: string | undefined): string[] =>
    String(value || '')
      .split(/[,，;；]/)
      .map((item) => item.trim())
      .filter(Boolean)
  const importRows = async (rows: unknown[]): Promise<void> => {
    for (const raw of rows as RiskPointImportRow[]) {
      const pointName = String(raw.pointName || '').trim()
      const site = options.value.sites.find(
        (item) => item.siteName === String(raw.siteName || '').trim()
      )
      const organizationCodes = splitValues(raw.organizationCodes)
      const organizations = options.value.organizations.filter((item) =>
        organizationCodes.includes(item.organizationCode)
      )
      const riskType = riskTypeOptions.value.find(
        (item) => item.value === raw.riskType || item.label === raw.riskType
      )?.value
      if (!pointName) throw new Error('风险点名称不能为空')
      if (!site) throw new Error(`未找到场所：${raw.siteName}`)
      if (!riskType) throw new Error(`无法识别风险类型：${raw.riskType}`)
      if (organizations.length !== organizationCodes.length)
        throw new Error(`辨识单位编码存在未匹配项：${raw.organizationCodes}`)
      const special = parseBoolean(raw.isSpecialEquipment)
      const equipment = options.value.equipment.find(
        (item) => item.equipmentName === String(raw.equipmentName || '').trim()
      )
      if (special && !equipment?.isSpecialEquipment)
        throw new Error(`特种设备未在台账中找到：${raw.equipmentName}`)
      await saveRiskPoint({
        pointName,
        riskType,
        siteId: site.id,
        equipmentId: equipment?.id || null,
        equipmentName: String(raw.equipmentName || '').trim(),
        isSpecialEquipment: special,
        controlPlanName: normalizeNullableText(String(raw.controlPlanName || '')),
        controlPlanAttachmentUrls: [],
        photoUrls: splitValues(raw.photoUrls),
        attachmentUrls: splitValues(raw.attachmentUrls),
        organizationIds: organizations.map((item) => item.id),
        sort: Number(raw.sort || 0)
      })
    }
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisDualControlRiskIdentification:Add',
      type: 'add',
      label: '新增风险点',
      onClick: () => void openDialog()
    },
    {
      key: 'generate',
      permission: 'SmisDualControlRiskIdentification:Generate',
      label: '生成所有风险点',
      icon: 'ri:magic-line',
      confirm: true,
      confirmTitle: '按场所生成风险点',
      content: '系统将为尚未建立有效风险点的场所各生成一条风险点，已有场所不会重复生成。',
      onClick: async ({ api }) => {
        await generateAllRiskPoints()
        await api.refreshCreate()
      }
    },
    {
      permission: 'SmisDualControlRiskIdentification:Import',
      type: 'import',
      importColumns: excelColumns,
      importApi: importRows,
      onImportError: (): void => {
        void ElMessage.error('导入失败，请检查场所、组织编码、设备台账和风险类型')
      }
    },
    {
      permission: 'SmisDualControlRiskIdentification:Export',
      type: 'export',
      exportFilename: '风险辨识',
      exportSheetName: '风险点',
      exportColumns: excelColumns,
      exportApi: async () => ({
        data: (await loadAllDocumentPages(fetchRiskPointList, { ...searchQuery.value })).map(
          (row) => ({
            pointNo: row.pointNo,
            pointName: row.pointName,
            riskType: riskTypeLabel.value.get(row.riskType) || row.riskType,
            siteName: row.siteName,
            organizationCodes: row.organizations.map((item) => item.organizationCode).join(','),
            equipmentName: row.equipmentName,
            isSpecialEquipment: row.isSpecialEquipment ? '是' : '否',
            controlPlanName: row.controlPlanName || '',
            photoUrls: row.photoUrls.join(','),
            attachmentUrls: row.attachmentUrls.join(','),
            riskLevel:
              riskLevelOptions.value.find((item) => item.value === row.riskLevel)?.label ||
              row.riskLevel,
            sort: row.sort
          })
        )
      })
    },
    {
      permission: 'SmisDualControlRiskIdentification:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 个风险点吗？已完成定量评价的风险点不会被删除。`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.pointName ?? '风险点')
          })),
          permission: 'SmisDualControlRiskIdentification:Delete',
          remove: async () => {
            await deleteRiskPoints((selectedRows as SmisRiskPoint[]).map((row) => row.id))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    }
  ])
  const handleSaveSuccess = (type: 'add' | 'edit'): void => {
    void (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
  }
  const handleHazardChanged = (): void => {
    void tableQueryRef.value?.refreshUpdate()
  }
  const handleDelete = async (row: SmisRiskPoint): Promise<void> => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.pointName ?? '风险点')
        }
      ],
      permission: 'SmisDualControlRiskIdentification:Delete',
      confirmMessage: `确定删除风险点“${row.pointName}”吗？已完成评价时系统会阻止删除。`,
      remove: async () => {
        await deleteRiskPoints([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
      }
    })
  }
  onMounted(async () => {
    await Promise.all([
      loadOptions(),
      userStore.ensureDictLoaded('smisHazardSourceRiskLevel'),
      userStore.ensureDictLoaded('smisAccidentCategory'),
      userStore.ensureDictLoaded('smisRiskPointType'),
      userStore.ensureDictLoaded('smisSiteCategory')
    ])
  })
</script>

<style scoped lang="scss">
  .risk-identification-page {
    min-width: 0;

    &__overview {
      min-width: 0;
      overflow: hidden;
    }

    &__table {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
    }

    :deep(.risk-identification-page__code) {
      display: inline-flex;
      justify-content: center;
      min-width: 72px;
      padding: 4px 8px;
      font-size: 12px;
      font-weight: 700;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
      border-radius: var(--el-border-radius-small);
    }

    :deep(.risk-identification-page__stack) {
      min-width: 0;

      strong,
      small {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        margin-top: 3px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.risk-identification-page__equipment),
    :deep(.risk-identification-page__attachment) {
      display: flex;
      gap: 7px;
      align-items: center;
      min-width: 0;
    }

    :deep(.risk-identification-page__equipment > span:first-child) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.risk-identification-page__thumb) {
      width: 42px;
      height: 42px;
      border-radius: var(--el-border-radius-base);
    }

    :deep(.risk-identification-page__attachment) {
      justify-content: center;
      color: var(--theme-color);
    }

    :deep(.risk-identification-page__muted) {
      color: var(--el-text-color-placeholder);
    }

    :deep(.risk-identification-page__actions) {
      display: flex;
      align-items: center;
    }
  }
</style>
