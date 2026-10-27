<template>
  <ArtPageShell
    class="equipment-archive-detail"
    :loading="loading"
    loading-mode="skeleton"
    :error="loadError"
    :empty="!equipment"
    empty-text="暂无设备档案详情"
    empty-description="请返回设备台账重新选择，或刷新后重试。"
    @retry="loadDetail"
  >
    <MasterDeleteProcessingNotice
      class="mb-4"
      :location-ready="deleteLocationReady"
      action-hint="请核对关联设备或检验资料后返回供应商管理重新检查。"
    />
    <ArtPageHeader
      class="equipment-archive-detail__header"
      :title="equipment?.equipmentName || '设备档案详情'"
      show-back
      @back="goBack"
    >
      <template #title>
        <div class="equipment-archive-detail__identity">
          <ArtUploadImage
            v-if="equipment?.photoUrl"
            class="equipment-archive-detail__photo"
            :model-value="equipment.photoUrl"
            :size="88"
            :limit="1"
            readonly
          />
          <span v-else class="equipment-archive-detail__photo-empty" aria-hidden="true">
            <ArtSvgIcon :icon="profileDefinition.icon" />
          </span>
          <div class="equipment-archive-detail__identity-copy">
            <div class="equipment-archive-detail__identity-primary">
              <h1>{{ equipment?.equipmentName || '设备档案详情' }}</h1>
              <div v-if="equipment" class="equipment-archive-detail__statuses">
                <ArtDictDisplay
                  dict-code="commonEnabledStatus"
                  :value="equipment.status"
                  display="tag"
                />
                <ArtDictDisplay
                  dict-code="smisEquipmentOperationStatus"
                  :value="equipment.operationStatus"
                  display="tag"
                />
              </div>
            </div>
            <p>{{ identitySummary }}</p>
            <dl v-if="equipment" class="equipment-archive-detail__summary">
              <div
                ><dt>规格型号</dt><dd>{{ modelSummary }}</dd></div
              >
              <div
                ><dt>安装位置</dt><dd>{{ locationSummary }}</dd></div
              >
              <div
                ><dt>使用部门</dt><dd>{{ equipment.usingOrganization.organizationName }}</dd></div
              >
            </dl>
          </div>
        </div>
      </template>
    </ArtPageHeader>

    <ElTabs v-if="equipment" v-model="activeTab" class="equipment-archive-detail__tabs art-card-xs">
      <ElTabPane label="设备档案信息" name="archive">
        <div class="equipment-archive-detail__sections">
          <ArtSectionCard title="基础信息" subtitle="设备识别、分类、位置与技术参数">
            <ArtDescriptions :data="equipment" :items="basicItems" :columns="3" />
          </ArtSectionCard>

          <ArtSectionCard title="组织与责任" subtitle="使用、管理、供应与安装维保关系">
            <ArtDescriptions :data="equipment" :items="responsibilityItems" :columns="3" />
          </ArtSectionCard>

          <ArtSectionCard
            v-if="specialItems.length"
            :title="`${profileDefinition.label}专用信息`"
            :subtitle="profileDefinition.description"
          >
            <ArtDescriptions :data="equipment" :items="specialItems" :columns="3" />
          </ArtSectionCard>

          <ArtSectionCard title="状态与资产" subtitle="运行状态、资产信息与生命周期日期">
            <ArtDescriptions :data="equipment" :items="assetItems" :columns="3" />
          </ArtSectionCard>
        </div>
      </ElTabPane>

      <ElTabPane label="附件" name="attachments" lazy>
        <div class="equipment-archive-detail__sections">
          <ArtSectionCard title="证照与影像" subtitle="维保资质、使用登记证、铭牌与设备照片">
            <div class="equipment-archive-detail__documents">
              <article v-for="document in archiveDocuments" :key="document.label">
                <span aria-hidden="true"><ArtSvgIcon :icon="document.icon" /></span>
                <div>
                  <strong>{{ document.label }}</strong>
                  <ArtAttachmentLink
                    v-if="document.url"
                    :file="{ name: document.label, url: document.url }"
                  />
                  <small v-else>待补充</small>
                </div>
              </article>
            </div>
          </ArtSectionCard>

          <ArtSectionCard title="设备附件" subtitle="说明书、合格证、报告及其他归档资料">
            <ArtTable
              :data="attachments"
              :columns="attachmentColumns"
              :pagination="false"
              :show-table-header="false"
              empty-height="180px"
              empty-text="暂无设备附件"
            />
          </ArtSectionCard>
        </div>
      </ElTabPane>

      <ElTabPane label="检验记录" name="inspections" lazy>
        <ArtAsyncState
          :loading="inspectionLoading"
          :error="inspectionError ? '检验记录加载失败，请重新加载' : null"
          :empty="!inspections.length"
          :empty-text="
            isInspectionReference ? '未找到可查看的目标检验记录' : '当前设备暂无检验记录'
          "
          :empty-description="
            isInspectionReference
              ? '请核对关联设备与记录权限，重新检查或清除定位后查看全部记录。'
              : '完成设备检验后，可在此查看记录与结果。'
          "
          @retry="retryInspections"
        >
          <div class="equipment-archive-detail__inspection-list">
            <article v-for="item in inspections" :key="item.id">
              <span class="equipment-archive-detail__inspection-icon" aria-hidden="true">
                <ArtSvgIcon icon="ri:shield-check-line" />
              </span>
              <div>
                <header>
                  <div>
                    <strong>{{
                      item.inspectionCategory?.categoryName || '检验类别不可查看'
                    }}</strong>
                    <small>{{ item.inspectionNo }}</small>
                  </div>
                  <ArtDictDisplay dict-code="smisEquipmentInspectionStatus" :value="item.status" />
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
                </dl>
                <p v-if="item.remark">{{ item.remark }}</p>
              </div>
            </article>
          </div>
        </ArtAsyncState>
        <div
          v-if="inspectionPagination.total"
          class="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row"
        >
          <span class="text-sm text-[var(--el-text-color-secondary)]">
            共 {{ inspectionPagination.total }} 条
          </span>
          <ElPagination
            :current-page="inspectionPagination.current"
            :page-size="inspectionPagination.size"
            :total="inspectionPagination.total"
            :pager-count="5"
            :disabled="inspectionLoading"
            layout="prev, pager, next"
            size="small"
            aria-label="设备检验记录分页"
            @current-change="handleInspectionPageChange"
          />
        </div>
      </ElTabPane>
    </ElTabs>
  </ArtPageShell>
</template>

<script setup lang="tsx">
  import { ElPagination, ElTabPane, ElTabs } from 'element-plus'
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { useMasterDataDeleteProcessingContext } from '@/hooks/core/useMasterDataDeleteProcessing'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import MasterDeleteProcessingNotice from '@/components/business/master-delete-processing-notice/index.vue'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import type { ColumnOption } from '@/types'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import ArtAttachmentLink from '@/components/core/media/art-file-viewer/attachment-link.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import { viewAttachment } from '@/utils/file'
  import {
    fetchEquipmentAttachments,
    fetchEquipmentInspectionList,
    fetchEquipmentInspectionReference,
    fetchEquipmentLedgerDetail,
    type SmisEquipment,
    type SmisEquipmentAttachment,
    type SmisEquipmentInspectionReference
  } from '@smis/api'
  import { getEquipmentProfileDefinition } from '@smis/domain/equipment-profile'

  defineOptions({ name: 'SmisEquipmentLedgerDetail' })

  const route = useRoute()
  const router = useRouter()
  const tenantScope = useTenantScopeStore()
  const loading = ref(false)
  const loadError = shallowRef<Error | null>(null)
  const equipment = shallowRef<SmisEquipment | null>(null)
  const attachments = ref<SmisEquipmentAttachment[]>([])
  const deleteContext = useMasterDataDeleteProcessingContext()
  const isInspectionReference = computed(
    () => deleteContext.value.active && route.query.dependencyCode === 'smis_equipment_inspection'
  )
  const fetchInspectionPage = async (params: {
    equipmentId: string
    current: number
    size: number
  }) => {
    if (isInspectionReference.value) {
      const id = deleteContext.value.recordId
      if (!id || !params.equipmentId) return { data: [], total: 0, error: null }
      const result = await fetchEquipmentInspectionReference(id, params.equipmentId)
      return {
        data: result.data ? [result.data] : [],
        total: result.data ? 1 : 0,
        error: result.error
      }
    }
    const result = await fetchEquipmentInspectionList(
      {
        equipmentId: params.equipmentId,
        ...buildSupabasePageRange(params)
      },
      { showErrorMessage: false }
    )
    return result
  }
  const {
    data: inspections,
    loading: inspectionLoading,
    error: inspectionError,
    pagination: inspectionPagination,
    replaceSearchParams: setInspectionSearch,
    getData: loadInspectionPage,
    refreshUpdate: retryInspections,
    handleCurrentChange: handleInspectionPageChange
  } = useTable<SmisEquipmentInspectionReference, typeof fetchInspectionPage>({
    core: { apiFn: fetchInspectionPage, apiParams: { current: 1, size: 20 }, immediate: false },
    performance: { enableCache: false }
  })
  const activeTab = ref(String(route.query.tab || 'archive'))
  const deleteLocationReady = computed(() =>
    isInspectionReference.value
      ? !inspectionLoading.value &&
        !inspectionError.value &&
        inspections.value.some((item) => item.id === deleteContext.value.recordId)
      : !loading.value &&
        !loadError.value &&
        Boolean(equipment.value?.id && equipment.value.id === deleteContext.value.recordId)
  )
  watch(
    () => route.query.tab,
    (tab) => {
      activeTab.value = typeof tab === 'string' ? tab : 'archive'
    }
  )

  const profileDefinition = computed(() =>
    getEquipmentProfileDefinition(
      equipment.value?.profileType || equipment.value?.category.profileType
    )
  )
  const identitySummary = computed(() => {
    if (!equipment.value) return '集中查看设备主档、附件和检验记录'
    return `${equipment.value.equipmentCode} · ${equipment.value.category.categoryName} · ${profileDefinition.value.label}`
  })
  const modelSummary = computed(
    () =>
      [equipment.value?.specification, equipment.value?.model].filter(Boolean).join(' / ') || '--'
  )
  const locationSummary = computed(() => {
    const location = equipment.value?.location?.locationName || '未设置'
    return equipment.value?.detailLocation
      ? `${location} · ${equipment.value.detailLocation}`
      : location
  })

  const basicItems = computed<ArtDescriptionItem<SmisEquipment>[]>(() => [
    { key: 'equipmentCode', label: '设备编码', field: 'equipmentCode', copyable: true },
    { key: 'equipmentName', label: '设备全称', field: 'equipmentName' },
    { key: 'equipmentShortName', label: '设备简称', field: 'equipmentShortName' },
    {
      key: 'category',
      label: '设备分类',
      value: (row: SmisEquipment) => `${row.category.categoryName} · ${row.category.categoryCode}`
    },
    { key: 'profileType', label: '档案模板', value: () => profileDefinition.value.label },
    { key: 'location', label: '安装位置', value: () => locationSummary.value },
    { key: 'specification', label: '规格', field: 'specification' },
    { key: 'model', label: '型号', field: 'model' },
    { key: 'manufacturer', label: '制造商', field: 'manufacturer' },
    { key: 'factoryNo', label: '出厂编号', field: 'factoryNo' },
    { key: 'registrationCode', label: '注册代码', field: 'registrationCode', copyable: true },
    { key: 'internalNo', label: '内部编号', field: 'internalNo', copyable: true },
    { key: 'useCertificateNo', label: '使用证号', field: 'useCertificateNo', copyable: true },
    { key: 'sort', label: '排序', field: 'sort' },
    { key: 'remark', label: '备注', field: 'remark', span: 3 }
  ])

  const responsibilityItems = computed<ArtDescriptionItem<SmisEquipment>[]>(() => [
    {
      key: 'usingOrganization',
      label: '使用部门',
      value: (row: SmisEquipment) => row.usingOrganization.organizationName
    },
    {
      key: 'managingOrganization',
      label: '管理部门',
      value: (row: SmisEquipment) => row.managingOrganization.organizationName
    },
    {
      key: 'responsible',
      label: '设备责任人',
      value: (row: SmisEquipment) =>
        row.responsible
          ? `${row.responsible.employeeName} · ${row.responsible.employeeNo}`
          : '未配置'
    },
    {
      key: 'supplier',
      label: '供应商',
      value: (row: SmisEquipment) => row.supplier?.supplierName || '未配置'
    },
    { key: 'maintenanceOrganization', label: '维保单位', field: 'maintenanceOrganization' },
    { key: 'installationOrganization', label: '安装单位', field: 'installationOrganization' },
    { key: 'designOrganization', label: '设计单位', field: 'designOrganization' }
  ])

  const specialItems = computed<ArtDescriptionItem<SmisEquipment>[]>(() =>
    profileDefinition.value.fields.map((field) => ({
      key: `special-${field.key}`,
      label: field.unit ? `${field.label}（${field.unit}）` : field.label,
      value: (row: SmisEquipment) => {
        const value = row.specialParameters?.[field.key]
        if (field.dictCode)
          return value ? <ArtDictDisplay dictCode={field.dictCode} value={String(value)} /> : '--'
        if (field.options)
          return field.options.find((item) => item.value === value)?.label || value || '--'
        return value === undefined || value === null || value === '' ? '--' : String(value)
      }
    }))
  )

  const assetItems = computed<ArtDescriptionItem<SmisEquipment>[]>(() => [
    {
      key: 'useStatus',
      label: '使用状态',
      field: 'useStatus',
      dictCode: 'smisEquipmentUseStatus',
      dictDisplay: 'tag'
    },
    {
      key: 'operationStatus',
      label: '运行状态',
      field: 'operationStatus',
      dictCode: 'smisEquipmentOperationStatus',
      dictDisplay: 'tag'
    },
    {
      key: 'assetStatus',
      label: '资产状态',
      field: 'assetStatus',
      dictCode: 'smisEquipmentAssetStatus',
      dictDisplay: 'tag'
    },
    {
      key: 'importanceLevel',
      label: '重要级别',
      field: 'importanceLevel',
      dictCode: 'smisEquipmentImportanceLevel',
      dictDisplay: 'tag'
    },
    { key: 'assetOriginalValue', label: '资产原值', field: 'assetOriginalValue', format: 'money' },
    { key: 'netValue', label: '当前净值', field: 'netValue', format: 'money' },
    { key: 'serviceLifeYears', label: '预计寿命（年）', field: 'serviceLifeYears' },
    { key: 'manufactureDate', label: '制造日期', field: 'manufactureDate', format: 'date' },
    { key: 'installationDate', label: '安装日期', field: 'installationDate', format: 'date' },
    { key: 'commissioningDate', label: '投运日期', field: 'commissioningDate', format: 'date' },
    { key: 'enableDate', label: '启用日期', field: 'enableDate', format: 'date' },
    {
      key: 'nextInspectionDueDate',
      label: '最近检验到期',
      field: 'nextInspectionDueDate',
      format: 'date'
    },
    { key: 'fixedAssetNo', label: '固定资产编号', field: 'fixedAssetNo', copyable: true },
    { key: 'erpCode', label: 'ERP 编码', field: 'erpCode', copyable: true },
    { key: 'electronicTagCode', label: '电子标签编码', field: 'electronicTagCode', copyable: true }
  ])

  const archiveDocuments = computed(() => [
    {
      label: '维保单位资质证书',
      url: equipment.value?.maintenanceQualificationUrl,
      icon: 'ri:verified-badge-line'
    },
    {
      label: '使用登记证',
      url: equipment.value?.useRegistrationCertificateUrl,
      icon: 'ri:file-shield-2-line'
    },
    { label: '设备铭牌', url: equipment.value?.nameplateUrl, icon: 'ri:price-tag-3-line' },
    { label: '设备照片', url: equipment.value?.photoUrl, icon: 'ri:image-line' }
  ])

  const attachmentColumns: ColumnOption<SmisEquipmentAttachment>[] = [
    { type: 'globalIndex', label: '序号', width: 72 },
    {
      prop: 'attachmentType',
      label: '附件类型',
      width: 140,
      dict: { code: 'smisEquipmentAttachmentType', display: 'tag' }
    },
    {
      prop: 'attachment.originName',
      label: '附件名称',
      minWidth: 220,
      link: { onClick: (row) => viewAttachment(row.attachment) }
    },
    { prop: 'attachment.sizeInfo', label: '大小', width: 110 },
    {
      prop: 'operation',
      label: '操作',
      width: 90,
      formatter: (row) => (
        <ArtButtonTable type="view" onClick={() => viewAttachment(row.attachment)} />
      )
    }
  ]

  let detailRequestSequence = 0
  const loadDetail = async (): Promise<void> => {
    const sequence = ++detailRequestSequence
    const id = String(route.params.id || '')
    if (!id) {
      equipment.value = null
      attachments.value = []
      loading.value = false
      loadError.value = new Error('缺少设备档案标识')
      return
    }
    loading.value = true
    loadError.value = null
    equipment.value = null
    attachments.value = []
    try {
      const [detailResult, attachmentResult] = await Promise.all([
        fetchEquipmentLedgerDetail(id),
        fetchEquipmentAttachments(id)
      ])
      if (sequence !== detailRequestSequence) return
      if (!detailResult.data) throw new Error('设备档案不存在或无权访问')
      equipment.value = detailResult.data
      attachments.value = attachmentResult.data ?? []
      setInspectionSearch({ equipmentId: id })
      await loadInspectionPage()
    } catch (error) {
      if (sequence !== detailRequestSequence) return
      loadError.value = error instanceof Error ? error : new Error('设备档案加载失败')
    } finally {
      if (sequence === detailRequestSequence) loading.value = false
    }
  }

  const goBack = async (): Promise<void> => {
    await router.push('/smis/equipment-ledger/equipment-ledger')
  }

  watch(
    [
      () => route.params.id,
      () => deleteContext.value.recordId,
      () => deleteContext.value.active,
      () => tenantScope.effectiveTenantId
    ],
    () => void loadDetail(),
    { immediate: true }
  )
  onBeforeUnmount(() => {
    detailRequestSequence++
  })
</script>

<style scoped lang="scss">
  .equipment-archive-detail {
    min-height: 100%;
    padding: 16px;
    background: var(--default-box-color);

    &__identity {
      display: flex;
      gap: 16px;
      align-items: center;
      min-width: 0;
    }

    &__photo {
      flex: none;
    }

    &__photo-empty {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 88px;
      height: 88px;
      font-size: 30px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 7%, var(--el-bg-color));
      border: 1px dashed color-mix(in srgb, var(--theme-color) 35%, var(--el-border-color));
      border-radius: var(--art-surface-radius);
    }

    &__identity-copy {
      display: grid;
      gap: 8px;
      min-width: 0;

      > p {
        margin: 0;
        font-size: 13px;
        color: var(--el-text-color-secondary);
      }
    }

    &__identity-primary,
    &__statuses {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    h1 {
      margin: 0;
      font-size: 22px;
      color: var(--el-text-color-primary);
    }

    &__summary {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 26px;
      margin: 0;

      > div {
        display: flex;
        gap: 7px;
      }

      dt {
        color: var(--el-text-color-secondary);
      }

      dd {
        margin: 0;
        color: var(--el-text-color-primary);
      }
    }

    &__tabs {
      padding: 0 20px 24px;
      margin-top: 14px;

      :deep(.el-tabs__header) {
        margin-bottom: 20px;
      }
    }

    &__sections {
      display: grid;
      gap: 14px;
    }

    &__documents {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;

      article {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr);
        gap: 11px;
        align-items: center;
        min-height: 78px;
        padding: 12px;
        background: var(--el-fill-color-lighter);
        border: 1px solid var(--el-border-color-lighter);
        border-radius: var(--art-surface-radius);
      }

      article > span {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        color: var(--theme-color);
        background: var(--el-bg-color);
        border-radius: var(--art-surface-radius);
      }

      article > div {
        display: grid;
        gap: 5px;
        min-width: 0;
      }

      small {
        color: var(--el-text-color-placeholder);
      }
    }

    &__inspection-list {
      position: relative;
      display: grid;
      gap: 12px;
      min-height: 220px;

      > article {
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr);
        gap: 13px;
        padding: 15px;
        background: var(--el-bg-color);
        border: 1px solid var(--el-border-color-lighter);
        border-radius: var(--art-surface-radius);
      }

      header,
      dl {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 22px;
        align-items: center;
        justify-content: space-between;
      }

      header > div,
      dl > div {
        display: grid;
        gap: 3px;
      }

      header small,
      dt {
        color: var(--el-text-color-secondary);
      }

      dl {
        justify-content: flex-start;
        margin: 13px 0 0;
      }

      dd {
        margin: 0;
        color: var(--el-text-color-primary);
      }

      p {
        margin: 12px 0 0;
        color: var(--el-text-color-regular);
      }
    }

    &__inspection-icon {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      color: var(--el-color-success);
      background: var(--el-color-success-light-9);
      border-radius: var(--art-surface-radius);
    }
  }

  @media (width <= 980px) {
    .equipment-archive-detail__documents {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (width <= 620px) {
    .equipment-archive-detail {
      padding: 10px;

      &__tabs {
        padding: 0 12px 16px;

        :deep(.el-tabs__header) {
          margin-bottom: 16px;
        }
      }

      &__identity {
        align-items: flex-start;
      }

      &__photo-empty {
        width: 68px;
        height: 68px;
      }

      &__summary,
      &__documents {
        display: grid;
        grid-template-columns: 1fr;
      }
    }
  }
</style>
