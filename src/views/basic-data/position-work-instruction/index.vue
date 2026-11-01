<template>
  <ArtPermissionGuard permission="SmisPositionWorkInstruction:View">
    <div class="work-instruction-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="work-instruction-page__overview"
        eyebrow="POSITION WORK INSTRUCTION"
        title="岗位作业指导书"
        description="统一维护岗位作业指导文件及版本信息，一份指导书可关联多个组织岗位。"
        icon="ri:file-list-3-line"
        density="compact"
        :tags="workspaceTags"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="work-instruction-page__workspace">
        <ArtWorkspaceSplitter
          primary-size="296px"
          primary-min="252px"
          primary-max="400px"
          :breakpoint="820"
          stacked-primary-size="320px"
        >
          <template #primary>
            <aside class="work-instruction-page__tree-panel">
              <PositionTreeNavigator
                :data="treeState.nodes"
                :loading="treeState.loading"
                :error="treeState.error"
                :selected-key="treeState.selectedKey"
                @select="handleTreeSelect"
                @refresh="loadPositionTree"
              />
            </aside>
          </template>

          <main class="work-instruction-page__main">
            <ArtTableQuery
              ref="tableQueryRef"
              v-model="tableState.searchQuery"
              class="work-instruction-page__table"
              :search-items="searchItems"
              :api-fn="fetchTableData"
              :columns-factory="columnsFactory"
              :header-actions="headerActions"
              header-actions-placement="workspace"
              :search-bar-props="{ span: 8, labelWidth: 76, showExpand: false }"
              :table-props="{
                rowKey: 'id',
                tableLayout: 'fixed',
                emptyText: '暂无岗位作业指导书',
                emptyDescription: '可新增指导书并关联一个或多个组织岗位。',
                showOverflowTooltip: true
              }"
              :on-success="handleTableSuccess"
              focusable
              focus-scope-selector=".work-instruction-page__workspace"
            />
          </main>
        </ArtWorkspaceSplitter>
      </div>

      <WorkInstructionDialog ref="dialogRef" @success="handleSaveSuccess" />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'
  import { computed, onMounted, reactive, ref } from 'vue'
  import { storeToRefs } from 'pinia'
  import { ElTag } from 'element-plus'
  import ArtTooltip from '@/components/core/feedback/art-tooltip/index.vue'
  import ArtAttachmentLink from '@/components/core/media/art-file-viewer/attachment-link.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric,
    type BusinessWorkspaceTag
  } from '@/components/business/business-workspace-header/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { useUserStore } from '@/store/modules/user'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase/error'
  import {
    deletePositionWorkInstructions,
    fetchPositionWorkInstructionList,
    fetchWorkInstructionPositionTree,
    type PositionWorkInstruction,
    type PositionWorkInstructionSearchParams
  } from '@smis/api'
  import PositionTreeNavigator from './modules/position-tree-navigator.vue'
  import WorkInstructionDialog, {
    type WorkInstructionDialogOpenData
  } from './modules/work-instruction-dialog.vue'
  import {
    buildWorkInstructionTree,
    flattenWorkInstructionTree,
    type WorkInstructionTreeNode
  } from './modules/types'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_position_work_instruction',
    '岗位作业指导书'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '-',
    invalidText: '-'
  })

  defineOptions({ name: 'SmisPositionWorkInstruction' })

  type TableSearchModel = Pick<PositionWorkInstructionSearchParams, 'keyword' | 'fileType'>
  type TableParams = TableSearchModel & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: WorkInstructionDialogOpenData) => Promise<void>
  }

  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const treeState = reactive({
    nodes: [] as WorkInstructionTreeNode[],
    loading: false,
    error: null as string | null,
    selectedKey: 'all'
  })
  const tableState = reactive({
    searchQuery: { keyword: '', fileType: '' } as TableSearchModel,
    total: 0,
    rows: [] as PositionWorkInstruction[]
  })

  const flatTreeNodes = computed(() => flattenWorkInstructionTree(treeState.nodes))
  const positionNodes = computed(() =>
    flatTreeNodes.value.filter((node) => node.nodeType === 'position')
  )
  const selectedTreeNode = computed(() =>
    flatTreeNodes.value.find((node) => node.key === treeState.selectedKey)
  )
  const selectedScopeLabel = computed(() => selectedTreeNode.value?.label || '全部岗位')
  const selectedScopeIcon = computed(() =>
    selectedTreeNode.value?.nodeType === 'position'
      ? 'ri:briefcase-4-line'
      : 'ri:organization-chart'
  )
  const attachedCount = computed(() => tableState.rows.filter((row) => row.fileUrl).length)
  const latestUploadDate = computed(() => {
    const dates = tableState.rows
      .map((row) => row.uploadDate)
      .filter((value): value is string => Boolean(value))
      .sort()
    return dates.at(-1) || '-'
  })
  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: '组织岗位树', type: 'primary', effect: 'plain' },
    { label: '支持多岗位适用', type: 'success', effect: 'light' },
    { label: '文件版本留痕', type: 'info', effect: 'plain' }
  ]
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '当前范围',
      value: selectedScopeLabel.value,
      description: selectedTreeNode.value?.description || '全部组织岗位',
      icon: selectedScopeIcon.value
    },
    {
      label: '可用岗位',
      value: positionNodes.value.length,
      description: '来自 HR 岗位与组织任职关系',
      icon: 'ri:briefcase-4-line',
      tone: 'info'
    },
    {
      label: '指导书',
      value: tableState.total,
      description: '当前筛选范围内的有效记录',
      icon: 'ri:file-list-3-line',
      tone: 'success'
    },
    {
      label: '最近上传',
      value: latestUploadDate.value,
      description: `${attachedCount.value} 条当前页记录已关联文件`,
      icon: 'ri:upload-cloud-2-line',
      tone: 'warning'
    }
  ])

  const fileTypeOptions = computed(() =>
    (getDictMap.value.FILE_EXTENSION_LABEL_MAP ?? []).map(toDictionaryOption)
  )
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '指导名称、文件编号或版本号' }
    },
    {
      label: '文件类型',
      key: 'fileType',
      type: 'select',
      props: {
        options: fileTypeOptions.value,
        clearable: true,
        filterable: true,
        placeholder: '全部文件类型'
      }
    }
  ])
  const columnsFactory = (): ColumnOption<PositionWorkInstruction>[] => [
    { type: 'selection', width: 50, reserveSelection: true },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'instructionName',
      label: '作业指导书',
      minWidth: 250,
      formatter: (row) => (
        <div class="work-instruction-page__document">
          <span aria-hidden="true">
            <ArtSvgIcon icon="ri:file-text-line" />
          </span>
          <span>
            <strong title={row.instructionName}>{row.instructionName}</strong>
            <small translate="no">{row.fileNumber || '未填写文件编号'}</small>
          </span>
        </div>
      )
    },
    {
      prop: 'scopes',
      label: '适用组织岗位',
      minWidth: 280,
      formatter: (row) => {
        const scopes = row.scopes ?? []
        const remainder = Math.max(scopes.length - 2, 0)
        return (
          <div class="work-instruction-page__scopes">
            {scopes.slice(0, 2).map((scope) => (
              <ElTag key={scope.scopeKey} effect="plain" type="primary">
                {scope.organizationName} / {scope.positionName}
              </ElTag>
            ))}
            {remainder ? (
              <ArtTooltip
                content={scopes
                  .slice(2)
                  .map((scope) => `${scope.organizationName} / ${scope.positionName}`)
                  .join('、')}
                placement="top"
              >
                <ElTag effect="light" type="info">
                  +{remainder}
                </ElTag>
              </ArtTooltip>
            ) : null}
          </div>
        )
      }
    },
    {
      prop: 'fileType',
      label: '文件类型',
      width: 138,
      dict: { code: 'FILE_EXTENSION_LABEL_MAP', display: 'text' }
    },
    {
      prop: 'uploadDate',
      label: '上传日期',
      width: 112,
      formatter: (row) => row.uploadDate || <span class="work-instruction-page__muted">-</span>
    },
    {
      prop: 'versionNo',
      label: '版本号',
      width: 92,
      formatter: (row) => row.versionNo || <span class="work-instruction-page__muted">-</span>
    },
    {
      prop: 'fileUrl',
      label: '关联文件',
      minWidth: 190,
      formatter: (row) =>
        row.fileUrl ? (
          <ArtAttachmentLink
            file={{
              name: row.originalFileName || row.instructionName,
              url: row.fileUrl,
              fileType: row.fileType || undefined
            }}
          />
        ) : (
          <span class="work-instruction-page__muted">未关联文件</span>
        )
    },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 156,
      formatter: (row) => formatTableDateTime(row.updateTime)
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
            permission="SmisPositionWorkInstruction:Edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            type="delete"
            permission="SmisPositionWorkInstruction:Delete"
            onClick={() => handleDeleteRows([row])}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'add',
      label: '新增指导书',
      permission: 'SmisPositionWorkInstruction:Add',
      disabled: !positionNodes.value.length,
      onClick: () => openDialog()
    },
    {
      type: 'delete',
      confirm: false,
      label: '删除',
      permission: 'SmisPositionWorkInstruction:Delete',
      content: (context: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${context.selectedCount} 份岗位作业指导书吗？`,
      onClick: async ({ selectedRows, api }) => {
        const ids = (selectedRows as PositionWorkInstruction[])
          .map((row) => row.id)
          .filter((id): id is string => Boolean(id))
        if (!ids.length) return
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.instructionName ?? '岗位作业指导书')
          })),
          permission: 'SmisPositionWorkInstruction:Delete',
          remove: async () => {
            await deletePositionWorkInstructions(ids)
          },
          onDeleted: async () => {
            await api.refreshRemove()
            await loadPositionTree(true)
          }
        })
      }
    }
  ])

  const fetchTableData = (params: TableParams) => {
    const selected = selectedTreeNode.value
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    return fetchPositionWorkInstructionList({
      ...params,
      from,
      to,
      organizationId: selected?.organizationId,
      positionId: selected?.positionId
    })
  }
  const handleTableSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (rows, response) => {
    tableState.rows = rows as PositionWorkInstruction[]
    tableState.total = response.total ?? 0
  }
  const loadPositionTree = async (preserveSelection = false): Promise<void> => {
    treeState.loading = true
    treeState.error = null
    try {
      const response = await fetchWorkInstructionPositionTree()
      treeState.nodes = buildWorkInstructionTree(response.data)
      if (
        !preserveSelection ||
        (treeState.selectedKey !== 'all' &&
          !flatTreeNodes.value.some((node) => node.key === treeState.selectedKey))
      )
        treeState.selectedKey = 'all'
      await tableQueryRef.value?.getData()
    } catch (error) {
      treeState.nodes = []
      treeState.error = getFriendlySupabaseErrorMessage(error, '组织岗位树加载失败，请稍后重试')
    } finally {
      treeState.loading = false
    }
  }
  const handleTreeSelect = async (key: string): Promise<void> => {
    if (treeState.selectedKey === key) return
    treeState.selectedKey = key
    tableState.total = 0
    await tableQueryRef.value?.getData()
  }
  const openDialog = (row?: PositionWorkInstruction): void => {
    void dialogRef.value?.handleOpen({ treeData: treeState.nodes, row })
  }
  const handleSaveSuccess = async (type: 'add' | 'edit'): Promise<void> => {
    await (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
    await loadPositionTree(true)
  }
  const handleDeleteRows = async (rows: PositionWorkInstruction[]): Promise<void> => {
    const ids = rows.map((row) => row.id).filter((id): id is string => Boolean(id))
    if (!ids.length) return

    await deleteRecords({
      resources: rows.map((row) => ({
        id: String(row.id ?? ''),
        label: String(row.instructionName ?? '岗位作业指导书')
      })),
      permission: 'SmisPositionWorkInstruction:Delete',
      confirmMessage: '确定删除这份岗位作业指导书吗？删除后无法恢复。',
      remove: async () => {
        await deletePositionWorkInstructions(ids)
      },
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
        await loadPositionTree(true)
      }
    })
  }

  onMounted(() => {
    void Promise.all([userStore.ensureDictLoaded('FILE_EXTENSION_LABEL_MAP'), loadPositionTree()])
  })
</script>

<style scoped lang="scss">
  .work-instruction-page {
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

    &__tree-panel,
    &__main,
    &__table {
      min-width: 0;
      min-height: 0;
    }

    &__tree-panel {
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

    :deep(.work-instruction-page__document) {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;
    }

    :deep(.work-instruction-page__document > span:first-child) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, var(--default-box-color));
      border-radius: var(--el-border-radius-base);
    }

    :deep(.work-instruction-page__document > span:last-child) {
      display: grid;
      align-content: center;
      min-width: 0;
    }

    :deep(.work-instruction-page__document strong),
    :deep(.work-instruction-page__document small) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.work-instruction-page__document strong) {
      line-height: 20px;
    }

    :deep(.work-instruction-page__document small) {
      margin-top: 2px;
      font-size: 11px;
      line-height: 16px;
      color: var(--el-text-color-secondary);
    }

    :deep(.work-instruction-page__scopes) {
      display: flex;
      gap: 6px;
      align-items: center;
      min-width: 0;
      overflow: hidden;
    }

    :deep(.work-instruction-page__scopes .el-tag) {
      max-width: 180px;
    }

    :deep(.work-instruction-page__scopes .el-tag__content) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.work-instruction-page__muted) {
      color: var(--el-text-color-secondary);
    }

    @media (width <= 820px) {
      &__main {
        flex: 0 0 720px;
      }
    }
  }
</style>
