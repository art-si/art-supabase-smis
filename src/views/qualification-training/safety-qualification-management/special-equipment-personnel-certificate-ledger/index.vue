<template>
  <ArtPermissionGuard :permission="permissionCode('View')" :resource-name="pageTitle">
    <div
      class="certificate-ledger-page business-workspace-page art-full-height flex min-h-0 flex-col gap-[14px]"
    >
      <BusinessWorkspaceHeader
        :eyebrow="eyebrow"
        :title="pageTitle"
        :description="pageDescription"
        icon="ri:award-line"
        :tags="workspaceTags"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>
      <div class="certificate-ledger-page__risk-note" role="note">
        <span><i class="is-warning" />即将到期：黄色提示</span>
        <span><i class="is-expired" />已过期：红色提示</span>
        <p>修改批准日期或有效日期会自动生成不可修改的复审记录；仅“已离岗、已培训”可消除提醒。</p>
      </div>
      <ArtTableQuery
        ref="tableRef"
        v-model="searchQuery"
        class="min-h-0 flex-1"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 84, showExpand: true, defaultExpanded: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: `暂无${pageTitle}`,
          emptyDescription: `新增${pageTitle}后，可为同一证件维护多个作业项目和到期提醒。`
        }"
        focusable
      />
      <PersonnelCertificateDialog ref="dialogRef" @success="refresh" />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { toDictionaryOption } from '@/utils/form/option'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import dayjs from 'dayjs'
  import { ElAvatar, ElButton, ElPopover, ElScrollbar, ElTag } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'

  import { useUserStore } from '@/store/modules/user'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric,
    type BusinessWorkspaceTag
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deletePersonnelCertificates,
    fetchPersonnelCertificateList,
    type SmisCertificateCategory,
    type SmisCertificateReminderState,
    type SmisPersonnelCertificate,
    type SmisPersonnelCertificateOverview,
    type SmisPersonnelCertificateSearchParams
  } from '@smis/api'
  import PersonnelCertificateDialog, {
    type PersonnelCertificateDialogMode,
    type PersonnelCertificateDialogOpenData
  } from './modules/personnel-certificate-dialog.vue'
  import { getCertificateCategoryMeta } from './modules/certificate-category-meta'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_personnel_certificate',
    '人员证书'
  )

  defineOptions({ name: 'SmisSpecialEquipmentPersonnelCertificateLedger' })
  const certificatePermissionSets = {
    SmisPersonnelCertificateLedger: {
      View: 'SmisPersonnelCertificateLedger:View',
      Add: 'SmisPersonnelCertificateLedger:Add',
      Copy: 'SmisPersonnelCertificateLedger:Copy',
      Edit: 'SmisPersonnelCertificateLedger:Edit',
      Delete: 'SmisPersonnelCertificateLedger:Delete',
      Export: 'SmisPersonnelCertificateLedger:Export',
      ViewHistory: 'SmisPersonnelCertificateLedger:ViewHistory',
      AiAnalyze: 'SmisPersonnelCertificateLedger:AiAnalyze'
    },
    SmisSpecialEquipmentOperatorCertificateLedger: {
      View: 'SmisSpecialEquipmentOperatorCertificateLedger:View',
      Add: 'SmisSpecialEquipmentOperatorCertificateLedger:Add',
      Copy: 'SmisSpecialEquipmentOperatorCertificateLedger:Copy',
      Edit: 'SmisSpecialEquipmentOperatorCertificateLedger:Edit',
      Delete: 'SmisSpecialEquipmentOperatorCertificateLedger:Delete',
      Export: 'SmisSpecialEquipmentOperatorCertificateLedger:Export',
      ViewHistory: 'SmisSpecialEquipmentOperatorCertificateLedger:ViewHistory',
      AiAnalyze: 'SmisSpecialEquipmentOperatorCertificateLedger:AiAnalyze'
    },
    SmisSpecialOperationCertificate: {
      View: 'SmisSpecialOperationCertificate:View',
      Add: 'SmisSpecialOperationCertificate:Add',
      Copy: 'SmisSpecialOperationCertificate:Copy',
      Edit: 'SmisSpecialOperationCertificate:Edit',
      Delete: 'SmisSpecialOperationCertificate:Delete',
      Export: 'SmisSpecialOperationCertificate:Export',
      ViewHistory: 'SmisSpecialOperationCertificate:ViewHistory',
      AiAnalyze: 'SmisSpecialOperationCertificate:AiAnalyze'
    },
    SmisSafetyManagerCertificate: {
      View: 'SmisSafetyManagerCertificate:View',
      Add: 'SmisSafetyManagerCertificate:Add',
      Copy: 'SmisSafetyManagerCertificate:Copy',
      Edit: 'SmisSafetyManagerCertificate:Edit',
      Delete: 'SmisSafetyManagerCertificate:Delete',
      Export: 'SmisSafetyManagerCertificate:Export',
      ViewHistory: 'SmisSafetyManagerCertificate:ViewHistory',
      AiAnalyze: 'SmisSafetyManagerCertificate:AiAnalyze'
    },
    SmisRegisteredSafetyEngineerLedger: {
      View: 'SmisRegisteredSafetyEngineerLedger:View',
      Add: 'SmisRegisteredSafetyEngineerLedger:Add',
      Copy: 'SmisRegisteredSafetyEngineerLedger:Copy',
      Edit: 'SmisRegisteredSafetyEngineerLedger:Edit',
      Delete: 'SmisRegisteredSafetyEngineerLedger:Delete',
      Export: 'SmisRegisteredSafetyEngineerLedger:Export',
      ViewHistory: 'SmisRegisteredSafetyEngineerLedger:ViewHistory',
      AiAnalyze: 'SmisRegisteredSafetyEngineerLedger:AiAnalyze'
    }
  } as const
  type CertificatePermissionPrefix = keyof typeof certificatePermissionSets
  type CertificatePermissionAction =
    keyof (typeof certificatePermissionSets)[CertificatePermissionPrefix]
  interface Props {
    category?: SmisCertificateCategory
    pageTitle?: string
    eyebrow?: string
    pageDescription?: string
    permissionPrefix?: CertificatePermissionPrefix
    scopeTag?: string
  }
  const props = withDefaults(defineProps<Props>(), {
    pageTitle: '特种设备人员证件台账',
    eyebrow: 'PERSONNEL QUALIFICATION LEDGER',
    pageDescription: '以员工为主线统一管理五类安全资质证件、多项作业资格、到期提醒和复审证据。',
    permissionPrefix: 'SmisPersonnelCertificateLedger',
    scopeTag: ''
  })
  const { category, pageTitle, eyebrow, pageDescription, permissionPrefix, scopeTag } =
    toRefs(props)
  type TableParams = SmisPersonnelCertificateSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: PersonnelCertificateDialogOpenData) => Promise<void>
  }
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const searchQuery = ref<SmisPersonnelCertificateSearchParams>({})
  const overview = reactive<SmisPersonnelCertificateOverview>({
    total: 0,
    normal: 0,
    warning: 0,
    expired: 0,
    employees: 0
  })
  const dictOptions = (code: string) =>
    computed(() => (getDictMap.value[code] ?? []).map(toDictionaryOption))
  const categoryOptions = dictOptions('smisCertificateCategory')
  const warningOptions = dictOptions('commonWarningStatus')
  const permissionCode = (action: CertificatePermissionAction): string =>
    certificatePermissionSets[permissionPrefix.value][action]
  const workspaceTags = computed<BusinessWorkspaceTag[]>(() => [
    { label: '员工花名册联动', type: 'primary', effect: 'plain' },
    { label: scopeTag.value || '一证多项目', type: 'success', effect: 'light' },
    { label: '到期风险分级', type: 'warning', effect: 'plain' }
  ])
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '证件总数',
      value: overview.total,
      description: `${overview.employees} 名持证人员`,
      icon: 'ri:award-line'
    },
    {
      label: '状态正常',
      value: overview.normal,
      description: '有效期充足',
      icon: 'ri:shield-check-line',
      tone: 'success'
    },
    {
      label: '即将到期',
      value: overview.warning,
      description: '进入提前提醒期',
      icon: 'ri:alarm-warning-line',
      tone: 'warning'
    },
    {
      label: '已过期',
      value: overview.expired,
      description: '需要立即处置',
      icon: 'ri:error-warning-line',
      tone: 'danger'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => {
    const items: SearchFormItem[] = [
      {
        label: '人员姓名',
        key: 'employeeName',
        type: 'input',
        props: { clearable: true, placeholder: '请输入人员姓名' }
      },
      {
        label: '证件编号',
        key: 'certificateNumber',
        type: 'input',
        props: { clearable: true, placeholder: '请输入证件编号' }
      }
    ]
    if (!category.value) {
      items.push({
        label: '证件类别',
        key: 'certificateCategory',
        type: 'select',
        options: categoryOptions.value,
        props: { clearable: true, placeholder: '全部证件类别' }
      })
    }
    items.push(
      {
        label: '有效日期',
        key: 'effectiveDateRange',
        type: 'date',
        span: 12,
        props: {
          type: 'daterange',
          valueFormat: 'YYYY-MM-DD',
          startPlaceholder: '开始日期',
          endPlaceholder: '结束日期',
          rangeSeparator: '至',
          clearable: true,
          class: '!w-full'
        }
      },
      {
        label: '预警状态',
        key: 'warningStatus',
        type: 'select',
        options: warningOptions.value,
        props: { clearable: true, placeholder: '全部预警状态' }
      }
    )
    return items
  })
  const openDialog = (mode: PersonnelCertificateDialogMode, row?: SmisPersonnelCertificate): void =>
    void dialogRef.value?.handleOpen({
      mode,
      row,
      category: category.value,
      pageTitle: pageTitle.value,
      aiPermission: permissionCode('AiAnalyze')
    })
  const exportColumns: ArtTableQueryExcelColumn[] = [
    { key: 'employeeNo', title: '员工工号' },
    { key: 'employeeName', title: '人员姓名' },
    { key: 'gender', title: '性别' },
    { key: 'idCardNo', title: '身份证号' },
    { key: 'educationLevel', title: '最高学历' },
    { key: 'organizationName', title: '所属部门' },
    { key: 'jobTitle', title: '岗位' },
    { key: 'phone', title: '联系电话' },
    { key: 'certificateCategoryText', title: '证件类别' },
    { key: 'certificateNumber', title: '证件编号' },
    { key: 'categoryDetailText', title: '类别特有信息' },
    { key: 'warningStatusText', title: '预警状态' },
    { key: 'nearestEffectiveDate', title: '最近有效日期' },
    { key: 'reminderStateText', title: '到期状态' },
    { key: 'itemText', title: '作业项目' }
  ]
  const categoryLabel = (value: string): string =>
    categoryOptions.value.find((item) => item.value === value)?.label || value
  const warningLabel = (value: string): string =>
    warningOptions.value.find((item) => item.value === value)?.label || value

  const categoryDetail = (row: SmisPersonnelCertificate): string => {
    const meta = getCertificateCategoryMeta(row.certificateCategory)
    const details = (meta.extraFields ?? []).flatMap((field) => {
      const value = row.extraFields[field.key]?.trim()
      if (!value) return []
      return [
        `${field.label}：${field.dictCode ? userStore.getDictItemByValue(field.dictCode, value)?.label || value : value}`
      ]
    })
    return details.join('；') || '—'
  }
  const showCategoryDetail = computed(
    () => !category.value || Boolean(getCertificateCategoryMeta(category.value).extraFields?.length)
  )
  const riskMeta = (state: SmisCertificateReminderState) =>
    ({
      normal: { label: '正常', type: 'success' },
      warning: { label: '即将到期', type: 'warning' },
      expired: { label: '已过期', type: 'danger' },
      dismissed: { label: '已消除提醒', type: 'info' }
    })[state] as { label: string; type: 'success' | 'warning' | 'danger' | 'info' }
  const formatExportRows = (rows: SmisPersonnelCertificate[]) =>
    rows.map((row) => ({
      ...row,
      certificateCategoryText: categoryLabel(row.certificateCategory),
      categoryDetailText: categoryDetail(row),
      warningStatusText: warningLabel(row.warningStatus),
      reminderStateText: riskMeta(row.reminderState).label,
      itemText: row.items
        .map((item) => `${item.workCode} ${item.workName}（${item.effectiveDate}）`)
        .join('；')
    }))
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: permissionCode('Add'),
      type: 'add',
      label: '新增',
      onClick: () => openDialog('add')
    },
    {
      permission: permissionCode('Copy'),
      key: 'copy',
      label: '复制并新增',
      icon: 'ri:file-copy-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) => selectedRows.length !== 1,
      onClick: ({ selectedRows }) => openDialog('copy', selectedRows[0] as SmisPersonnelCertificate)
    },
    {
      permission: permissionCode('Edit'),
      key: 'edit',
      label: '编辑',
      icon: 'ri:edit-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) => selectedRows.length !== 1,
      onClick: ({ selectedRows }) => openDialog('edit', selectedRows[0] as SmisPersonnelCertificate)
    },
    {
      permission: permissionCode('Delete'),
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 张人员证件吗？证件项目和复审记录将一并删除。`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.certificateNumber ?? '人员证书')
          })),
          permission: permissionCode('Delete'),
          remove: async () => {
            await deletePersonnelCertificates(selectedRows.map((row) => String(row.id)))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    },
    {
      permission: permissionCode('Export'),
      type: 'export',
      label: '导出',
      exportFilename: pageTitle.value,
      exportSheetName: pageTitle.value,
      exportColumns,
      exportApi: async () => ({
        data: formatExportRows(
          await loadAllDocumentPages<
            SmisPersonnelCertificate,
            SmisPersonnelCertificateSearchParams
          >(fetchPersonnelCertificateList, {
            ...searchQuery.value,
            certificateCategory: category.value ?? searchQuery.value.certificateCategory,
            purpose: 'export'
          })
        )
      })
    }
  ])
  const renderHistory = (row: SmisPersonnelCertificate) => {
    const histories = row.items.flatMap((item) =>
      item.reviewHistory.map((history) => ({ ...history, workName: item.workName }))
    )
    if (!histories.length) return <span class="certificate-ledger-page__no-history">暂无复审</span>
    return (
      <ElPopover width={520} trigger="click" popperClass="certificate-review-popover">
        {{
          reference: () => (
            <ElButton link type="primary">
              {histories.length} 条复审记录
            </ElButton>
          ),
          default: () => (
            <div class="certificate-ledger-page__history">
              <strong>复审日期变更记录</strong>
              {histories.map((item) => (
                <div>
                  <span>{item.workName}</span>
                  <p>
                    {item.previousApprovalDate} / {item.previousEffectiveDate} → {item.approvalDate}{' '}
                    / {item.effectiveDate}
                  </p>
                  <small>
                    {dayjs(item.reviewTime).format('YYYY-MM-DD HH:mm')} ·{' '}
                    {item.reviewBy || '系统用户'}
                  </small>
                </div>
              ))}
            </div>
          )
        }}
      </ElPopover>
    )
  }
  const columnsFactory = (): ColumnOption<SmisPersonnelCertificate>[] => [
    { type: 'selection', width: 48 },
    {
      type: 'expand',
      width: 48,
      formatter: (row) => (
        <ElScrollbar class="certificate-ledger-page__details-scroll">
          <div class="certificate-ledger-page__details">
            {row.items.map((item) => {
              const meta = riskMeta(item.reminderState)
              return (
                <article class={`is-${item.reminderState}`}>
                  <div>
                    <strong>{item.workName}</strong>
                    <small>
                      {item.workCode} · 提前 {item.reminderDays} 天提醒
                    </small>
                  </div>
                  <span>
                    <small>批准日期</small>
                    {item.approvalDate}
                  </span>
                  <span>
                    <small>有效日期</small>
                    {item.effectiveDate}
                  </span>
                  <ElTag type={meta.type} effect="light">
                    {meta.label}
                  </ElTag>
                  {item.dismissalReason ? (
                    <em>{item.dismissalReason === 'trained' ? '已培训' : '已离岗'}</em>
                  ) : null}
                </article>
              )
            })}
            <footer>{renderHistory(row)}</footer>
          </div>
        </ElScrollbar>
      )
    },
    {
      prop: 'employeeName',
      label: '持证人员',
      minWidth: 210,
      fixed: 'left',
      formatter: (row) => (
        <div class="certificate-ledger-page__employee">
          <ElAvatar size={40} src={row.avatarUrl || undefined}>
            {row.employeeName.slice(-1)}
          </ElAvatar>
          <div>
            <strong>{row.employeeName}</strong>
            <small>
              {row.employeeNo} · {row.gender || '未维护性别'}
            </small>
          </div>
        </div>
      )
    },
    {
      prop: 'organizationName',
      label: '部门 / 岗位',
      minWidth: 210,
      showOverflowTooltip: true,
      formatter: (row) => [row.organizationName, row.jobTitle].filter(Boolean).join(' · ') || '—'
    },
    { prop: 'phone', label: '联系电话', width: 140 },
    ...(category.value && getCertificateCategoryMeta(category.value).showEmployeeProfile
      ? [
          {
            prop: 'idCardNo',
            label: '身份证号',
            minWidth: 180,
            showOverflowTooltip: true,
            formatter: (row: SmisPersonnelCertificate) => row.idCardNo || '—'
          },
          {
            prop: 'educationLevel',
            label: '最高学历',
            width: 120,
            formatter: (row: SmisPersonnelCertificate) => row.educationLevel || '—'
          }
        ]
      : []),
    {
      prop: 'certificateCategory',
      label: '证件类别',
      minWidth: 176,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="smisCertificateCategory"
          value={row.certificateCategory}
          display="tag"
        />
      )
    },
    { prop: 'certificateNumber', label: '证件编号', minWidth: 170, showOverflowTooltip: true },
    ...(showCategoryDetail.value
      ? [
          {
            prop: 'extraFields',
            label: '类别特有信息',
            minWidth: 180,
            showOverflowTooltip: true,
            formatter: categoryDetail
          } as ColumnOption<SmisPersonnelCertificate>
        ]
      : []),
    {
      prop: 'warningStatus',
      label: '预警状态',
      width: 110,
      align: 'center',
      dict: { code: 'commonWarningStatus', display: 'auto' }
    },
    {
      prop: 'nearestEffectiveDate',
      label: '最近有效日期',
      width: 130,
      align: 'center',
      formatter: (row) => row.nearestEffectiveDate || '—'
    },
    {
      prop: 'reminderState',
      label: '到期状态',
      width: 116,
      align: 'center',
      formatter: (row) => {
        const meta = riskMeta(row.reminderState)
        return (
          <ElTag type={meta.type} effect="light">
            {meta.label}
          </ElTag>
        )
      }
    },
    {
      prop: 'items',
      label: '作业项目',
      width: 96,
      align: 'center',
      formatter: (row) => `${row.items.length} 项`
    },
    {
      prop: 'operation',
      label: '操作',
      width: 120,
      fixed: 'right',
      formatter: (row) => (
        <div class="certificate-ledger-page__actions">
          <ArtButtonTable
            permission={permissionCode('Edit')}
            type="edit"
            onClick={() => openDialog('edit', row)}
          />
          <ArtButtonTable
            permission={permissionCode('Delete')}
            type="delete"
            onClick={() => void handleDelete(row)}
          />
        </div>
      )
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const result = await fetchPersonnelCertificateList(
      {
        ...params,
        ...buildSupabasePageRange(params),
        certificateCategory: category.value ?? params.certificateCategory
      },
      { showErrorMessage: false }
    )
    if (options?.signal?.aborted) return { records: result.data, total: result.total }
    if (result.error) {
      throw new Error('人员证件加载失败，请重新加载', { cause: result.error })
    }
    Object.assign(overview, result.overview)
    return { records: result.data, total: result.total }
  }
  const handleDelete = async (row: SmisPersonnelCertificate): Promise<void> => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.certificateNumber ?? '人员证书')
        }
      ],
      permission: 'SmisPersonnelCertificateLedger:Delete',
      confirmMessage: `确定删除“${row.employeeName}”的证件 ${row.certificateNumber} 吗？`,
      remove: async () => {
        await deletePersonnelCertificates([row.id ?? ''])
      },
      onDeleted: async () => {
        await refresh()
      }
    })
  }
  const refresh = async (): Promise<void> => {
    await tableRef.value?.getData()
  }
  onMounted(
    () =>
      void Promise.all(
        [
          'smisCertificateCategory',
          'commonWarningStatus',
          'smisCertificateReminderDays',
          'smisCertificateDismissalReason',
          'smisSafetyManagerUnitType',
          'smisSafetyManagerOccupationType',
          'smisRegisteredSafetyOfficerType',
          'smisRegisteredEngineerType',
          'smisRegisteredPracticeCategory'
        ].map((code) => userStore.ensureDictLoaded(code))
      )
  )
</script>

<style scoped lang="scss">
  .certificate-ledger-page {
    &__risk-note {
      display: flex;
      gap: 18px;
      align-items: center;
      padding: 10px 14px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      background: var(--default-box-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);

      span {
        display: inline-flex;
        gap: 6px;
        align-items: center;
        white-space: nowrap;
      }

      i {
        width: 8px;
        height: 8px;
        border-radius: 50%;

        &.is-warning {
          background: var(--el-color-warning);
        }

        &.is-expired {
          background: var(--el-color-danger);
        }
      }

      p {
        margin: 0 0 0 auto;
      }
    }

    :deep(.certificate-ledger-page__employee) {
      display: flex;
      gap: 10px;
      align-items: center;
      min-width: 0;

      > div {
        display: grid;
        min-width: 0;
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.certificate-ledger-page__details) {
      display: grid;
      gap: 8px;
      padding: 14px 24px 18px 70px;
      background: color-mix(in srgb, var(--art-gray-100) 65%, transparent);

      article {
        display: grid;
        grid-template-columns: minmax(220px, 1fr) 130px 130px 110px auto;
        gap: 16px;
        align-items: center;
        padding: 10px 12px;
        background: var(--default-box-color);
        border-left: 3px solid var(--el-color-success);
        border-radius: var(--el-border-radius-base);

        &.is-warning {
          border-left-color: var(--el-color-warning);
        }

        &.is-expired {
          border-left-color: var(--el-color-danger);
        }

        > div,
        > span {
          display: grid;
        }

        small {
          color: var(--el-text-color-secondary);
        }

        em {
          font-size: 12px;
          font-style: normal;
          color: var(--el-text-color-secondary);
        }
      }

      footer {
        display: flex;
        justify-content: flex-end;
      }
    }

    :deep(.certificate-ledger-page__history) {
      display: grid;
      gap: 10px;

      > div {
        padding: 9px 0;
        border-top: 1px solid var(--el-border-color-lighter);
      }

      p {
        margin: 3px 0;
        color: var(--el-text-color-regular);
      }

      small {
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.certificate-ledger-page__no-history) {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }
  }

  @media (width <= 900px) {
    .certificate-ledger-page__risk-note {
      flex-wrap: wrap;

      p {
        width: 100%;
        margin-left: 0;
      }
    }

    .certificate-ledger-page :deep(.certificate-ledger-page__details) {
      padding-left: 18px;

      article {
        min-width: 760px;
      }
    }
  }
</style>
