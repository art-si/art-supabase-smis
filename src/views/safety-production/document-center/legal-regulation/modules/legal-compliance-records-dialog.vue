<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="legal-compliance-records">
      <div class="legal-compliance-records__summary art-card-xs">
        <span aria-hidden="true"><ArtSvgIcon icon="ri:scales-3-line" /></span>
        <div>
          <strong>{{ document?.fileName }}</strong>
          <p>
            {{ document?.documentCode }} · {{ document?.categoryPath }}
            <template v-if="document?.lastEvaluationDate">
              · 最近评价 {{ formatDate(document.lastEvaluationDate) }}
            </template>
          </p>
        </div>
      </div>

      <ArtTableQuery
        ref="tableQueryRef"
        v-model="searchQuery"
        class="legal-compliance-records__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        :search-bar-props="{ span: 8, labelWidth: 82 }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无合规性评价',
          emptyDescription: '新增评价后，可持续跟踪该法律法规的符合情况和控制现状。'
        }"
      />
    </div>

    <LegalComplianceEvaluationDialog ref="editorRef" @success="handleSaveSuccess" />
    <MasterDataDeleteGuard ref="deleteEvaluationGuardRef" />
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import {
    deleteLegalComplianceEvaluations,
    fetchLegalComplianceEvaluationList,
    type SmisDocumentRegister,
    type SmisLegalComplianceEvaluation,
    type SmisLegalComplianceEvaluationSearchParams
  } from '@smis/api'
  import LegalComplianceEvaluationDialog, {
    type LegalComplianceEvaluationDialogMode,
    type LegalComplianceEvaluationDialogOpenData
  } from './legal-compliance-evaluation-dialog.vue'

  const { deleteGuardRef: deleteEvaluationGuardRef, deleteRecords: deleteEvaluationRecords } =
    useRecordDeleteGuard('smis_legal_compliance_evaluation', '合规性评价')

  export interface LegalComplianceRecordsDialogOpenData {
    document: SmisDocumentRegister
  }
  interface EditorExpose {
    handleOpen: (data: LegalComplianceEvaluationDialogOpenData) => Promise<void>
  }
  type TableParams = SmisLegalComplianceEvaluationSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  const dialogRef = ref<ArtDialogExpose<LegalComplianceRecordsDialogOpenData>>()
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const editorRef = ref<EditorExpose>()
  const document = shallowRef<SmisDocumentRegister>()
  const searchQuery = ref<SmisLegalComplianceEvaluationSearchParams>({ documentId: '' })
  const searchItems: SearchFormItem[] = [
    {
      label: '评价内容',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '搜索条款、现状、结论或评价人' }
    }
  ]

  const openEditor = (
    mode: LegalComplianceEvaluationDialogMode,
    row?: SmisLegalComplianceEvaluation
  ): void => {
    const currentDocument = document.value
    if (!currentDocument) return
    void editorRef.value?.handleOpen({ mode, documentId: currentDocument.id, row })
  }
  const headerActions: ArtTableQueryHeaderAction[] = [
    {
      permission: 'SmisLegalRegulation:ComplianceAdd',
      type: 'add',
      label: '新增',
      onClick: () => openEditor('add')
    },
    {
      permission: 'SmisLegalRegulation:ComplianceCopy',
      key: 'copy',
      label: '复制并新增',
      icon: 'ri:file-copy-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) => selectedRows.length !== 1,
      onClick: ({ selectedRows }) =>
        openEditor('copy', selectedRows[0] as SmisLegalComplianceEvaluation)
    },
    {
      permission: 'SmisLegalRegulation:ComplianceEdit',
      key: 'edit',
      label: '编辑',
      icon: 'ri:edit-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) => selectedRows.length !== 1,
      onClick: ({ selectedRows }) =>
        openEditor('edit', selectedRows[0] as SmisLegalComplianceEvaluation)
    },
    {
      permission: 'SmisLegalRegulation:ComplianceDelete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条合规性评价吗？`,
      onClick: async ({ selectedRows, api }) => {
        const currentDocument = document.value
        if (!currentDocument) return
        await deleteEvaluationRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.evaluationDate ?? '业务记录')
          })),
          permission: 'SmisLegalRegulation:ComplianceDelete',
          remove: async () => {
            await deleteLegalComplianceEvaluations({
              documentId: currentDocument.id,
              ids: selectedRows.map((row) => String(row.id))
            })
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    }
  ]
  const columnsFactory = (): ColumnOption<SmisLegalComplianceEvaluation>[] => [
    { type: 'selection', width: 48 },
    { prop: 'relatedClause', label: '相关条款', minWidth: 250, showOverflowTooltip: true },
    { prop: 'controlStatus', label: '控制现状', minWidth: 250, showOverflowTooltip: true },
    {
      prop: 'evaluationConclusion',
      label: '评价结论',
      minWidth: 210,
      showOverflowTooltip: true
    },
    { prop: 'evaluationDate', label: '评价日期', width: 120 },
    { prop: 'evaluatorName', label: '评价人', width: 120, showOverflowTooltip: true },
    { prop: 'remark', label: '备注', minWidth: 180, showOverflowTooltip: true },
    {
      prop: 'operation',
      label: '操作',
      width: 116,
      fixed: 'right',
      formatter: (row) => (
        <div class="legal-compliance-records__actions">
          <ArtButtonTable
            permission="SmisLegalRegulation:ComplianceEdit"
            type="edit"
            onClick={() => openEditor('edit', row)}
          />
          <ArtButtonMore
            list={[
              {
                key: 'copy',
                label: '复制并新增',
                icon: 'ri:file-copy-line',
                auth: 'SmisLegalRegulation:ComplianceCopy'
              },
              {
                key: 'delete',
                label: '删除',
                icon: 'ri:delete-bin-line',
                color: 'var(--el-color-danger)',
                auth: 'SmisLegalRegulation:ComplianceDelete'
              }
            ]}
            onClick={(item: ButtonMoreItem) => void handleMoreAction(item, row)}
          />
        </div>
      )
    }
  ]
  const fetchTableData = async (params: TableParams) => {
    const result = await fetchLegalComplianceEvaluationList({
      documentId: searchQuery.value.documentId,
      keyword: params.keyword,
      ...buildSupabasePageRange(params)
    })
    return { records: result.data, total: result.total }
  }
  const handleDelete = async (row: SmisLegalComplianceEvaluation): Promise<void> => {
    const currentDocument = document.value
    if (!currentDocument) return
    await deleteEvaluationRecords({
      resources: [{ id: row.id, label: formatDate(row.evaluationDate) }],
      permission: 'SmisLegalRegulation:ComplianceDelete',
      remove: () =>
        deleteLegalComplianceEvaluations({ documentId: currentDocument.id, ids: [row.id ?? ''] }),
      onDeleted: () => tableQueryRef.value?.refreshRemove() ?? Promise.resolve()
    })
  }
  const handleMoreAction = async (
    item: ButtonMoreItem,
    row: SmisLegalComplianceEvaluation
  ): Promise<void> => {
    if (item.key === 'copy') {
      openEditor('copy', row)
      return
    }
    if (item.key === 'delete') await handleDelete(row)
  }
  const handleSaveSuccess = (): void => void tableQueryRef.value?.getData()
  const formatDate = createDateTimeFormatter({ format: 'YYYY-MM-DD', emptyText: '—' })

  const handleOpen = async (data: LegalComplianceRecordsDialogOpenData): Promise<void> => {
    document.value = data.document
    Object.assign(searchQuery.value, { documentId: data.document.id, keyword: undefined })
    await dialogRef.value?.handleOpen(data, {
      title: '合规性评价记录',
      subtitle: '针对同一法律法规持续追加评价，历史记录独立保留',
      cancelText: '关闭',
      showConfirmButton: false,
      contentHeight: 'min(68vh, 650px)',
      onOpen: async () => {
        await nextTick()
        await tableQueryRef.value?.getData()
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .legal-compliance-records {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    min-height: 0;

    &__summary {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      padding: 12px 14px;

      > span {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
        border-radius: var(--el-border-radius-base);
      }

      div {
        min-width: 0;
      }

      strong,
      p {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      p {
        margin: 3px 0 0;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    &__table {
      flex: 1;
      min-height: 0;
    }
  }
</style>
