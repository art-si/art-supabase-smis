<template>
  <div class="equipment-ledger-page business-workspace-page art-full-height">
    <BusinessWorkspaceHeader
      eyebrow="EQUIPMENT LIFECYCLE MASTER"
      title="设备台账"
      description="以设备为主线统一分类、位置、责任组织、锅炉扩展、安全附件和检验生命周期数据，并为每台设备生成唯一二维码。"
      icon="ri:archive-stack-line"
      :tags="[
        { label: '分类 / 位置双树', type: 'primary', effect: 'plain' },
        { label: '一物一码', type: 'success', effect: 'light' },
        { label: '租户与权限隔离', type: 'info', effect: 'plain' }
      ]"
      :metrics="workspaceMetrics"
    >
      <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
    </BusinessWorkspaceHeader>

    <div class="equipment-ledger-page__workspace">
      <ArtWorkspaceSplitter
        primary-size="272px"
        primary-min="238px"
        primary-max="400px"
        :breakpoint="820"
        stacked-primary-size="320px"
      >
        <template #primary>
          <EquipmentDimensionNavigator
            :category-tree="tree.categoryTree"
            :location-tree="tree.locationTree"
            :selected-dimension="tree.dimension"
            :selected-key="tree.selectedKey"
            :loading="tree.loading"
            :error="tree.error"
            @update:dimension="handleDimensionChange"
            @select="handleTreeSelect"
            @refresh="refreshWorkspace"
          />
        </template>
        <ArtTableQuery
          ref="tableQueryRef"
          v-model="table.searchQuery"
          class="equipment-ledger-page__table"
          :api-fn="fetchTableData"
          :search-items="table.searchItems"
          :columns-factory="columnsFactory"
          :header-actions="table.headerActions"
          header-actions-placement="workspace"
          :search-bar-props="{ span: 6, labelWidth: 78 }"
          :table-props="{
            rowKey: 'id',
            tableLayout: 'fixed',
            emptyText: '暂无设备台账',
            emptyDescription: '可先维护设备分类与存放位置，再新增第一台设备。'
          }"
          focusable
          focus-scope-selector=".equipment-ledger-page__workspace"
        />
      </ArtWorkspaceSplitter>
    </div>

    <EquipmentLedgerDialog
      ref="dialogRef"
      @success="refreshWorkspace"
      @create-accessory="openAccessoryDialog"
    />
    <EquipmentLedgerDialog
      ref="accessoryDialogRef"
      @success="handleAccessorySuccess"
      @closed="handleAccessoryClosed"
    />

    <ArtDialog ref="qrDialogRef" size="sm" :show-footer="false">
      <div v-if="qr.row" class="equipment-ledger-page__qr-card">
        <div class="equipment-ledger-page__qr-code">
          <QrcodeVue :value="qrValue" :size="210" level="H" />
        </div>
        <strong>{{ qr.row.equipmentName }}</strong>
        <span>{{ qr.row.equipmentCode }}</span>
        <p>二维码包含设备主键与随机令牌，可用于标签打印和移动端安全识别。</p>
      </div>
    </ArtDialog>

    <ArtDrawer ref="lifecycleDrawerRef" size="lg" :show-footer="false">
      <div class="equipment-ledger-page__drawer-title">
        <span><ArtSvgIcon icon="ri:history-line" /></span>
        <div>
          <strong>{{ lifecycle.row?.equipmentName }}</strong>
          <small>{{ lifecycle.row?.equipmentCode }} · 设备全生命周期</small>
        </div>
      </div>
      <ElTabs v-if="lifecycle.row" v-model="lifecycle.active">
        <ElTabPane name="overview" label="生命周期概览">
          <div class="equipment-ledger-page__lifecycle-grid">
            <article
              ><ArtSvgIcon icon="ri:attachment-2" /><strong>{{
                lifecycle.row.attachmentCount
              }}</strong
              ><span>设备附件</span></article
            >
            <article
              ><ArtSvgIcon icon="ri:shield-check-line" /><strong>{{
                lifecycle.row.inspectionCount
              }}</strong
              ><span>检验记录</span></article
            >
            <article
              ><ArtSvgIcon icon="ri:calendar-check-line" /><strong>{{
                lifecycle.row.nextInspectionDueDate || '未计划'
              }}</strong
              ><span>最近到期日</span></article
            >
          </div>
          <ElAlert
            type="info"
            :closable="false"
            show-icon
            title="附件、外部检验、内部检验、年度检验和定期检验已采用独立子表结构，可持续扩展设备全生命周期记录。"
          />
        </ElTabPane>
        <ElTabPane name="attachments" label="附件与证照">
          <div class="equipment-ledger-page__attachment-toolbar">
            <ElSelect v-model="attachmentType" aria-label="设备附件类型">
              <ElOption
                v-for="item in dictOptions('smisEquipmentAttachmentType')"
                :key="String(item.value)"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
            <ElButton
              v-auth="'SmisEquipmentLedger:Attachment'"
              type="primary"
              @click="resourcePickerVisible = true"
            >
              <ArtSvgIcon icon="ri:upload-cloud-2-line" />上传附件
            </ElButton>
          </div>
          <div class="equipment-ledger-page__attachments" :aria-busy="attachmentsLoading">
            <ArtOverlayLoading
              v-if="attachmentsLoading"
              loading
              overlay
              text="正在加载设备附件…"
              description="正在获取最新附件，请稍候"
            />
            <article v-for="item in attachments" :key="item.attachmentId">
              <span><ArtSvgIcon icon="ri:file-text-line" /></span>
              <div>
                <ArtAttachmentLink
                  :file="{
                    name: item.attachment.originName,
                    url: item.attachment.url,
                    fileType: item.attachment.suffix || item.attachment.mimeType || undefined
                  }"
                />
                <small>
                  <ArtDictDisplay
                    dict-code="smisEquipmentAttachmentType"
                    :value="item.attachmentType"
                  />
                  <template v-if="item.attachment.sizeInfo">
                    · {{ item.attachment.sizeInfo }}</template
                  >
                </small>
              </div>
              <ElButton
                v-auth="'SmisEquipmentLedger:Attachment'"
                text
                type="danger"
                aria-label="移除设备附件"
                @click="removeAttachment(item)"
              >
                <ArtSvgIcon icon="ri:delete-bin-line" />
              </ElButton>
            </article>
            <ArtEmptyState
              v-if="!attachmentsLoading && !attachments.length"
              title="暂无设备附件"
              description="可上传证照、铭牌、设备照片、说明书或检验报告。"
              :visual-size="96"
            />
          </div>
        </ElTabPane>
        <ElTabPane name="inspections" label="检验记录">
          <ArtAsyncState
            :loading="inspectionsLoading"
            :error="inspectionsError ? '检验记录加载失败，请重新加载' : null"
            :empty="!inspections.length"
            empty-text="当前设备暂无检验记录"
            empty-description="可前往“检验申报”创建第一条生命周期记录。"
            @retry="retryInspections"
          >
            <div class="equipment-ledger-page__inspections">
              <article v-for="item in inspections" :key="item.id">
                <span class="equipment-ledger-page__inspection-marker">
                  <ArtSvgIcon icon="ri:shield-check-line" />
                </span>
                <div class="equipment-ledger-page__inspection-content">
                  <header>
                    <div>
                      <strong>{{ item.inspectionCategory.categoryName }}</strong>
                      <small>{{ item.inspectionNo }}</small>
                    </div>
                    <ArtDictDisplay
                      dict-code="smisEquipmentInspectionStatus"
                      :value="item.status"
                    />
                  </header>
                  <dl>
                    <div
                      ><dt>检验日期</dt><dd>{{ item.inspectionDate }}</dd></div
                    >
                    <div
                      ><dt>检验结论</dt
                      ><dd
                        ><ArtDictDisplay
                          dict-code="smisEquipmentInspectionConclusion"
                          :value="item.conclusion" /></dd
                    ></div>
                    <div
                      ><dt>检验机构</dt
                      ><dd>{{ item.inspectionInstitution?.supplierName || '未设置' }}</dd></div
                    >
                    <div
                      ><dt>下次检验</dt><dd>{{ item.nextDueDate || '未计划' }}</dd></div
                    >
                    <div v-if="item.needsExtension"
                      ><dt>延期至</dt><dd>{{ item.extensionDate }}</dd></div
                    >
                  </dl>
                  <div v-if="item.images.length" class="equipment-ledger-page__inspection-images">
                    <button
                      v-for="(image, index) in item.images"
                      :key="image.attachmentId"
                      type="button"
                      :aria-label="`预览检验图片 ${image.originName}`"
                      @click="previewInspectionImages(item.images, index)"
                    >
                      <img :src="image.url" :alt="image.originName" width="76" height="54" />
                    </button>
                  </div>
                  <p v-if="item.remark">{{ item.remark }}</p>
                </div>
              </article>
            </div>
          </ArtAsyncState>
          <div
            v-if="inspectionsPagination.total"
            class="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row"
          >
            <span class="text-sm text-[var(--el-text-color-secondary)]"
              >共 {{ inspectionsPagination.total }} 条</span
            >
            <ElPagination
              :current-page="inspectionsPagination.current"
              :page-size="inspectionsPagination.size"
              :total="inspectionsPagination.total"
              :pager-count="5"
              :disabled="inspectionsLoading"
              layout="prev, pager, next"
              size="small"
              aria-label="设备检验记录分页"
              @current-change="handleInspectionPageChange"
            />
          </div>
        </ElTabPane>
      </ElTabs>
    </ArtDrawer>
    <ArtResourcePicker
      v-model:visible="resourcePickerVisible"
      title="上传设备附件"
      default-file-type="document"
      multiple
      :limit="10"
      @confirm="handleResourceConfirm"
    />
  </div>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import { useTable, type TableRequestOptions } from '@/hooks/core/useTable'
  import { ElMessage, ElPagination } from 'element-plus'
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import QrcodeVue from 'qrcode.vue'
  import type { Resource } from '@/components/core/forms/art-resource-picker/type'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useImageViewer } from '@/hooks/core/useImageViewer'
  import { useUserStore } from '@/store/modules/user'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtResourcePicker from '@/components/core/forms/art-resource-picker/index.vue'
  import ArtAttachmentLink from '@/components/core/media/art-file-viewer/attachment-link.vue'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import {
    deleteEquipmentAttachment,
    deleteEquipmentLedger,
    fetchEquipmentAttachments,
    fetchEquipmentLedgerDetail,
    fetchEquipmentInspectionList,
    fetchEquipmentLedgerList,
    fetchSupplierList,
    linkEquipmentAttachment,
    type SmisEquipment,
    type SmisEquipmentAttachment,
    type SmisEquipmentInspection,
    type SmisEquipmentInspectionImage,
    type SmisEquipmentCategory,
    type SmisEquipmentOverview,
    type SmisEquipmentSearchParams,
    type SmisStorageLocation
  } from '@smis/api'
  import EquipmentDimensionNavigator, {
    type EquipmentTreeDimension
  } from './modules/equipment-dimension-navigator.vue'
  import EquipmentLedgerDialog, {
    type EquipmentAccessoryKind,
    type EquipmentLedgerDialogOpenData
  } from './modules/equipment-ledger-dialog.vue'
  import { getEquipmentProfileLabel } from '@smis/domain/equipment-profile'

  const formatTableDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD',
    emptyText: '未计划',
    invalidText: '未计划'
  })
  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  defineOptions({ name: 'SmisEquipmentLedgerList' })
  const ALL_KEY = 'all'
  type TableParams = SmisEquipmentSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'> & { enableDateRange?: string[] }
  interface DialogExpose {
    handleOpen: (data: EquipmentLedgerDialogOpenData) => Promise<void>
    openAccessorySelector: (kind: EquipmentAccessoryKind) => Promise<void>
  }
  const { confirmDelete } = useArtFeedback()
  const router = useRouter()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const accessoryDialogRef = ref<DialogExpose>()
  const accessoryWorkflow = reactive<{
    kind: EquipmentAccessoryKind | null
    saved: boolean
  }>({ kind: null, saved: false })
  const qrDialogRef = ref<ArtDialogExpose<SmisEquipment>>()
  const lifecycleDrawerRef = ref<ArtDrawerExpose<SmisEquipment>>()
  const overview = reactive<SmisEquipmentOverview>({
    total: 0,
    inUse: 0,
    boilerCount: 0,
    dueSoon: 0
  })
  const tree = reactive<{
    categoryTree: SmisEquipmentCategory[]
    locationTree: SmisStorageLocation[]
    dimension: EquipmentTreeDimension
    selectedKey: string
    loading: boolean
    error: string | null
  }>({
    categoryTree: [],
    locationTree: [],
    dimension: 'category',
    selectedKey: ALL_KEY,
    loading: false,
    error: null
  })
  const supplierOptions = ref<{ label: string; value: string }[]>([])
  const qr = reactive<{ row: SmisEquipment | null }>({ row: null })
  const lifecycle = reactive<{ row: SmisEquipment | null; active: string }>({
    row: null,
    active: 'overview'
  })
  const attachments = ref<SmisEquipmentAttachment[]>([])
  const attachmentsLoading = ref(false)
  const fetchInspectionPage = async (params: {
    equipmentId: string
    current: number
    size: number
  }) => {
    const result = await fetchEquipmentInspectionList(
      { equipmentId: params.equipmentId, ...buildSupabasePageRange(params) },
      { showErrorMessage: false }
    )
    return result
  }
  const {
    data: inspections,
    loading: inspectionsLoading,
    error: inspectionsError,
    pagination: inspectionsPagination,
    replaceSearchParams: setInspectionSearch,
    getData: loadInspectionPage,
    refreshUpdate: retryInspections,
    handleCurrentChange: handleInspectionPageChange
  } = useTable<SmisEquipmentInspection, typeof fetchInspectionPage>({
    core: { apiFn: fetchInspectionPage, apiParams: { current: 1, size: 20 }, immediate: false },
    performance: { enableCache: false }
  })
  const resourcePickerVisible = ref(false)
  const attachmentType = ref('other')
  const qrValue = computed(() =>
    qr.row ? JSON.stringify({ type: 'smis-equipment', id: qr.row.id, token: qr.row.qrToken }) : ''
  )
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)

  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '设备总数',
      value: overview.total,
      description: '当前租户设备主档',
      icon: 'ri:archive-line'
    },
    {
      label: '在用设备',
      value: overview.inUse,
      description: '当前使用状态为在用',
      icon: 'ri:play-circle-line',
      tone: 'success'
    },
    {
      label: '锅炉设备',
      value: overview.boilerCount,
      description: '已维护锅炉扩展信息',
      icon: 'ri:fire-line',
      tone: 'warning'
    },
    {
      label: '30 天内到期',
      value: overview.dueSoon,
      description: '需要关注的检验计划',
      icon: 'ri:alarm-warning-line',
      tone: overview.dueSoon ? 'danger' : undefined
    }
  ])

  const openDialog = async (row?: SmisEquipment): Promise<void> => {
    await dialogRef.value?.handleOpen({
      row,
      loadDetail: row
        ? async () => (await fetchEquipmentLedgerDetail(row.id)).data || row
        : undefined,
      categoryTree: tree.categoryTree,
      locationTree: tree.locationTree,
      presetCategoryId:
        !row && tree.dimension === 'category' && tree.selectedKey !== ALL_KEY
          ? tree.selectedKey
          : undefined,
      presetLocationId:
        !row && tree.dimension === 'location' && tree.selectedKey !== ALL_KEY
          ? tree.selectedKey
          : undefined
    })
  }
  const findCategoryByProfile = (
    items: SmisEquipmentCategory[],
    kind: EquipmentAccessoryKind
  ): SmisEquipmentCategory | undefined => {
    for (const item of items) {
      if (item.profileType === kind) return item
      const child = findCategoryByProfile(item.children || [], kind)
      if (child) return child
    }
    return undefined
  }
  const openAccessoryDialog = async (kind: EquipmentAccessoryKind): Promise<void> => {
    const category = findCategoryByProfile(tree.categoryTree, kind)
    if (!category) {
      ElMessage.warning(
        kind === 'pressure_gauge'
          ? '请先在设备分类中配置“压力表”档案模板'
          : '请先在设备分类中配置“安全阀”档案模板'
      )
      return
    }
    accessoryWorkflow.kind = kind
    accessoryWorkflow.saved = false
    await accessoryDialogRef.value?.handleOpen({
      categoryTree: tree.categoryTree,
      locationTree: tree.locationTree,
      presetCategoryId: category.id,
      presetKind: kind
    })
  }
  const handleAccessorySuccess = async (): Promise<void> => {
    accessoryWorkflow.saved = true
    await refreshWorkspace()
  }
  const handleAccessoryClosed = async (): Promise<void> => {
    const kind = accessoryWorkflow.kind
    const shouldReopen = accessoryWorkflow.saved && kind
    accessoryWorkflow.kind = null
    accessoryWorkflow.saved = false
    if (shouldReopen) await dialogRef.value?.openAccessorySelector(kind)
  }
  const openDetail = (row: SmisEquipment): void => {
    void router.push(`/smis/equipment-ledger/equipment-ledger-detail/${row.id}`)
  }
  const loadAttachments = async (): Promise<void> => {
    if (!lifecycle.row) return
    attachmentsLoading.value = true
    try {
      const result = await fetchEquipmentAttachments(lifecycle.row.id)
      attachments.value = result.data ?? []
    } finally {
      attachmentsLoading.value = false
    }
  }
  const loadInspections = async (): Promise<void> => {
    if (!lifecycle.row) return
    setInspectionSearch({ equipmentId: lifecycle.row.id })
    await loadInspectionPage()
  }
  const previewInspectionImages = (
    images: SmisEquipmentInspectionImage[],
    initialIndex: number
  ): void => {
    useImageViewer(
      images.map((image) => image.url),
      { initialIndex }
    )
  }
  const openLifecycle = async (row: SmisEquipment): Promise<void> => {
    lifecycle.row = row
    lifecycle.active = 'overview'
    await lifecycleDrawerRef.value?.handleOpen(row, {
      title: '设备全生命周期',
      subtitle: `${row.equipmentName} · ${row.equipmentCode}`
    })
    await Promise.all([loadAttachments(), loadInspections()])
  }
  const openQrCode = async (row: SmisEquipment): Promise<void> => {
    qr.row = row
    await qrDialogRef.value?.handleOpen(row, {
      title: '设备二维码',
      subtitle: `${row.equipmentName} · ${row.equipmentCode}`
    })
  }
  const handleResourceConfirm = async (resources: Resource[]): Promise<void> => {
    if (!lifecycle.row) return
    for (const resource of resources) {
      if (resource.id == null) continue
      await linkEquipmentAttachment(lifecycle.row.id, String(resource.id), attachmentType.value)
    }
    resourcePickerVisible.value = false
    await Promise.all([loadAttachments(), refreshWorkspace()])
  }
  const removeAttachment = async (item: SmisEquipmentAttachment): Promise<void> => {
    if (!lifecycle.row) return
    await deleteEquipmentAttachment(lifecycle.row.id, item.attachmentId)
    await Promise.all([loadAttachments(), refreshWorkspace()])
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisEquipmentLedger:Add',
      type: 'add',
      label: '新增设备',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisEquipmentLedger:Delete',
      type: 'delete',
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 台设备吗？被锅炉关联的压力表或安全阀需先解除关系。`,
      onClick: async ({ selectedRows, api }) => {
        const ids = selectedRows
          .map((row) => row.id)
          .filter((id): id is string => typeof id === 'string')
        await deleteEquipmentLedger(ids)
        await api.refreshRemove()
      }
    }
  ])
  const table = reactive<{
    searchQuery: TableParams
    searchItems: ComputedRef<SearchFormItem[]>
    headerActions: ComputedRef<ArtTableQueryHeaderAction[]>
  }>({
    searchQuery: { current: 1, size: 20 },
    searchItems: computed(() => [
      {
        label: '关键字',
        key: 'keyword',
        type: 'input',
        props: { clearable: true, placeholder: '设备编码、名称、规格或出厂编号' }
      },
      {
        label: '基础类型',
        key: 'equipmentKind',
        type: 'select',
        props: {
          options: dictOptions('smisEquipmentKind'),
          clearable: true,
          placeholder: '全部类型'
        }
      },
      {
        label: '设备型号',
        key: 'model',
        type: 'input',
        props: { clearable: true, placeholder: '输入型号' }
      },
      {
        label: '运行状态',
        key: 'operationStatus',
        type: 'select',
        props: {
          options: dictOptions('smisEquipmentOperationStatus'),
          clearable: true
        }
      },
      {
        label: '供应商',
        key: 'supplierId',
        type: 'select',
        props: {
          options: supplierOptions.value,
          clearable: true,
          filterable: true,
          placeholder: '全部供应商'
        }
      },
      {
        label: '重要级别',
        key: 'importanceLevel',
        type: 'select',
        props: {
          options: dictOptions('smisEquipmentImportanceLevel'),
          clearable: true
        }
      },
      {
        label: '启用日期',
        key: 'enableDateRange',
        type: 'date',
        props: {
          type: 'daterange',
          valueFormat: 'YYYY-MM-DD',
          startPlaceholder: '开始日期',
          endPlaceholder: '结束日期',
          clearable: true
        }
      },
      {
        label: '资产状态',
        key: 'assetStatus',
        type: 'select',
        props: { options: dictOptions('smisEquipmentAssetStatus'), clearable: true }
      },
      {
        label: '使用状态',
        key: 'useStatus',
        type: 'select',
        props: { options: dictOptions('smisEquipmentUseStatus'), clearable: true }
      }
    ]),
    headerActions
  })

  const columnsFactory = (): ColumnOption<SmisEquipment>[] => [
    { type: 'selection', width: 48 },
    { prop: 'sort', label: '排序', width: 86, align: 'center', sortable: true },
    {
      prop: 'equipmentName',
      label: '设备信息',
      minWidth: 230,
      fixed: 'left',
      formatter: (row) => (
        <button
          type="button"
          class="equipment-ledger-page__identity"
          aria-label={`查看设备 ${row.equipmentName}`}
          onClick={() => openDetail(row)}
        >
          <span aria-hidden="true">
            <ArtSvgIcon
              icon={
                row.equipmentKind === 'boiler'
                  ? 'ri:fire-line'
                  : row.equipmentKind === 'pressure_gauge'
                    ? 'ri:speed-up-line'
                    : row.equipmentKind === 'safety_valve'
                      ? 'ri:shield-flash-line'
                      : 'ri:archive-line'
              }
            />
          </span>
          <span>
            <strong title={row.equipmentName}>{row.equipmentName}</strong>
            <small title={row.equipmentCode}>{row.equipmentCode}</small>
          </span>
        </button>
      )
    },
    {
      prop: 'equipmentKind',
      label: '档案模板',
      width: 112,
      formatter: (row) => getEquipmentProfileLabel(row.profileType || row.category.profileType)
    },
    {
      prop: 'category',
      label: '设备分类',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.category.categoryName
    },
    {
      prop: 'location',
      label: '安装位置',
      minWidth: 160,
      showOverflowTooltip: true,
      formatter: (row) => row.location?.locationName || '未设置'
    },
    {
      prop: 'model',
      label: '型号 / 规格',
      minWidth: 160,
      formatter: (row) => (
        <div class="equipment-ledger-page__stack">
          <span>{row.model || '—'}</span>
          <small>{row.specification || '未设置规格'}</small>
        </div>
      )
    },
    {
      prop: 'usingOrganization',
      label: '使用部门',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.usingOrganization.organizationName
    },
    {
      prop: 'responsible',
      label: '责任人',
      width: 110,
      formatter: (row) => row.responsible?.employeeName || '未配置'
    },
    {
      prop: 'operationStatus',
      label: '运行状态',
      width: 105,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisEquipmentOperationStatus" value={row.operationStatus} />
      )
    },
    {
      prop: 'importanceLevel',
      label: '重要级别',
      width: 105,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisEquipmentImportanceLevel" value={row.importanceLevel} />
      )
    },
    {
      prop: 'nextInspectionDueDate',
      label: '最近检验到期',
      width: 135,
      formatter: (row) => formatTableDate(row.nextInspectionDueDate)
    },
    {
      prop: 'lifecycle',
      label: '生命周期',
      width: 128,
      formatter: (row) => (
        <button
          class="equipment-ledger-page__lifecycle-link"
          type="button"
          onClick={() => void openLifecycle(row)}
        >
          {row.attachmentCount} 附件 · {row.inspectionCount} 检验
        </button>
      )
    },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 165,
      formatter: (row) => formatTableDateTime(row.updateTime)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 198,
      fixed: 'right',
      formatter: (row) => (
        <div class="flex items-center gap-1">
          <ArtButtonTable
            permission="SmisEquipmentLedger:View"
            type="view"
            label="查看设备"
            onClick={() => openDetail(row)}
          />
          <ArtButtonTable
            type="view"
            icon="ri:qr-code-line"
            label="查看二维码"
            onClick={() => void openQrCode(row)}
          />
          <ArtButtonTable
            permission="SmisEquipmentLedger:Edit"
            type="edit"
            onClick={() => void openDialog(row)}
          />
          <ArtButtonTable
            permission="SmisEquipmentLedger:Delete"
            type="delete"
            onClick={async () => {
              await confirmDelete(`确定删除设备“${row.equipmentName}”吗？`)
              await deleteEquipmentLedger([row.id])
              await refreshWorkspace()
            }}
          />
        </div>
      )
    }
  ]

  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    tree.loading = !tree.categoryTree.length && !tree.locationTree.length
    tree.error = null
    try {
      const [enableDateFrom, enableDateTo] = params.enableDateRange ?? []
      const result = await fetchEquipmentLedgerList({
        ...buildSupabasePageRange(params),
        ...params,
        enableDateFrom,
        enableDateTo,
        categoryId:
          tree.dimension === 'category' && tree.selectedKey !== ALL_KEY
            ? tree.selectedKey
            : undefined,
        locationId:
          tree.dimension === 'location' && tree.selectedKey !== ALL_KEY
            ? tree.selectedKey
            : undefined
      })
      if (!options?.signal?.aborted) {
        tree.categoryTree = result.categoryTree
        tree.locationTree = result.locationTree
        Object.assign(overview, result.overview)
      }
      return { records: result.data, total: result.total }
    } catch (error) {
      if (!options?.signal?.aborted) tree.error = '台账结构加载失败，请重试。'
      throw error
    } finally {
      if (!options?.signal?.aborted) tree.loading = false
    }
  }
  const handleDimensionChange = (dimension: EquipmentTreeDimension): void => {
    tree.dimension = dimension
    tree.selectedKey = ALL_KEY
    void tableQueryRef.value?.getData()
  }
  const handleTreeSelect = (dimension: EquipmentTreeDimension, key: string): void => {
    tree.dimension = dimension
    tree.selectedKey = key
    void tableQueryRef.value?.getData()
  }
  const refreshWorkspace = async (): Promise<void> => {
    await tableQueryRef.value?.getData()
  }

  onMounted(async () => {
    await Promise.all(
      [
        'smisEquipmentKind',
        'smisEquipmentOperationStatus',
        'smisEquipmentImportanceLevel',
        'smisEquipmentAssetStatus',
        'smisEquipmentUseStatus',
        'commonEnabledStatus',
        'smisBoilerType',
        'smisEquipmentAttachmentType',
        'smisEquipmentInspectionConclusion',
        'smisEquipmentInspectionStatus'
      ].map((code) => userStore.ensureDictLoaded(code))
    )
    const suppliers = await fetchSupplierList({ from: 0, to: 9999 })
    supplierOptions.value = suppliers.data
      .map((item) => ({
        label: `${item.supplierName} · ${item.supplierCode}`,
        value: item.id || ''
      }))
      .filter((item) => item.value)
  })
</script>

<style scoped lang="scss">
  .equipment-ledger-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;

    &__workspace {
      flex: 1;
      width: 100%;
      min-height: 0;
    }

    &__table {
      min-width: 0;
      min-height: 0;
    }

    :deep(.equipment-ledger-page__identity) {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;
      padding: 0;
      font: inherit;
      color: inherit;
      text-align: left;
      cursor: pointer;
      background: transparent;
      border: 0;
      border-radius: var(--el-border-radius-base);

      > span:first-child {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
        border-radius: var(--el-border-radius-base);
      }

      > span:last-child {
        display: grid;
        min-width: 0;
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        color: var(--theme-color);
      }

      small {
        margin-top: 2px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.equipment-ledger-page__identity:hover strong) {
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    :deep(.equipment-ledger-page__identity:focus-visible) {
      outline: 2px solid var(--theme-color);
      outline-offset: 3px;
    }

    :deep(.equipment-ledger-page__stack) {
      display: grid;
      min-width: 0;

      span,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        margin-top: 3px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    &__lifecycle-link {
      padding: 0;
      font: inherit;
      font-size: 12px;
      color: var(--theme-color);
      cursor: pointer;
      background: none;
      border: 0;
    }

    &__lifecycle-link:hover {
      text-decoration: underline;
    }

    &__qr-card {
      display: grid;
      justify-items: center;
      padding: 8px 12px 18px;
      text-align: center;
    }

    &__qr-code {
      padding: 16px;
      margin-bottom: 14px;
      background: #fff;
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--art-surface-radius);
      box-shadow: 0 18px 40px rgb(15 23 42 / 10%);
    }

    &__qr-card strong {
      font-size: 18px;
      color: var(--el-text-color-primary);
    }

    &__qr-card > span {
      margin-top: 4px;
      color: var(--theme-color);
    }

    &__qr-card p {
      max-width: 310px;
      margin: 12px 0 0;
      font-size: 12px;
      line-height: 1.7;
      color: var(--el-text-color-secondary);
    }

    &__drawer-title {
      display: grid;
      grid-template-columns: 42px 1fr;
      gap: 11px;
      align-items: center;
    }

    &__drawer-title > span {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
      border-radius: var(--art-surface-radius);
    }

    &__drawer-title > div {
      display: grid;
    }

    &__drawer-title small {
      margin-top: 3px;
      color: var(--el-text-color-secondary);
    }

    &__lifecycle-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin: 8px 0 18px;
    }

    &__lifecycle-grid article {
      display: grid;
      gap: 5px;
      justify-items: center;
      min-height: 126px;
      padding: 18px 10px;
      text-align: center;
      background: var(--art-gray-100);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--art-surface-radius);
    }

    &__lifecycle-grid svg {
      font-size: 23px;
      color: var(--theme-color);
    }

    &__lifecycle-grid strong {
      font-size: 19px;
      color: var(--el-text-color-primary);
    }

    &__lifecycle-grid span {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__attachment-toolbar {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin: 6px 0 14px;
    }

    &__attachment-toolbar :deep(.el-select) {
      width: 180px;
    }

    &__attachments {
      position: relative;
      min-height: 220px;
    }

    &__attachments article {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr) auto;
      gap: 11px;
      align-items: center;
      padding: 12px;
      margin-bottom: 8px;
      background: var(--art-gray-100);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--art-surface-radius);
    }

    &__attachments article > span {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      color: var(--theme-color);
      background: var(--default-box-color);
      border-radius: var(--art-surface-radius);
    }

    &__attachments article > div {
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    &__attachments small {
      display: flex;
      align-items: center;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    &__inspections {
      position: relative;
      display: grid;
      gap: 12px;
      min-height: 220px;
      padding-top: 8px;
    }

    &__inspections > article {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 12px;
      padding: 14px;
      background: var(--art-gray-100);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__inspection-marker {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      font-size: 20px;
      color: var(--theme-color);
      background: var(--default-box-color);
      border-radius: var(--el-border-radius-base);
    }

    &__inspection-content {
      min-width: 0;

      header {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        justify-content: space-between;
      }

      header > div {
        display: grid;
        min-width: 0;
      }

      header small {
        margin-top: 3px;
        color: var(--theme-color);
      }

      dl {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px 16px;
        margin: 14px 0 0;
      }

      dl > div {
        min-width: 0;
      }

      dt {
        margin-bottom: 3px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      dd {
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      > p {
        margin: 10px 0 0;
        font-size: 12px;
        line-height: 1.65;
        color: var(--el-text-color-secondary);
      }
    }

    &__inspection-images {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;

      button {
        width: 76px;
        height: 54px;
        padding: 0;
        overflow: hidden;
        cursor: pointer;
        background: var(--default-box-color);
        border: 1px solid var(--el-border-color-lighter);
        border-radius: var(--el-border-radius-small);
      }

      button:focus-visible {
        outline: 2px solid var(--theme-color);
        outline-offset: 2px;
      }

      img {
        width: 76px;
        height: 54px;
        object-fit: cover;
      }
    }

    @media (width <= 820px) {
      &__lifecycle-grid {
        grid-template-columns: 1fr;
      }

      &__inspection-content dl {
        grid-template-columns: 1fr;
      }
    }
  }
</style>
