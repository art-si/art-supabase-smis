<template>
  <ArtDialog
    ref="dialogRef"
    size="xl"
    show-fullscreen-button
    :show-cancel-button="false"
    confirm-text="关闭"
    content-max-height="calc(100dvh - 184px)"
    :loading="loading"
    loading-text="正在加载作业票详情…"
  >
    <template #footer-left>
      <ElButton v-if="record && canPrint" @click="handlePrintAction">
        <ArtSvgIcon icon="ri:printer-line" />
        {{ activeView === 'print' ? '打印' : '打印预览' }}
      </ElButton>
    </template>

    <div v-if="record" class="permit-detail">
      <div class="permit-detail__view-switch">
        <div>
          <ArtSvgIcon icon="ri:layout-2-line" />
          <span>查看方式</span>
        </div>
        <ElSegmented
          v-model="activeView"
          :options="[
            { label: '业务详情', value: 'detail' },
            { label: '打印预览', value: 'print' }
          ]"
          aria-label="切换作业票查看方式"
        />
      </div>

      <template v-if="activeView === 'detail'">
        <div class="permit-detail__identity">
          <div class="permit-detail__icon" aria-hidden="true"
            ><ArtSvgIcon icon="ri:file-shield-2-line"
          /></div>
          <div class="permit-detail__heading"
            ><small>特殊作业证</small><h3>{{ record.permitNo }}</h3
            ><p
              >{{ record.operationTypeName }} · {{ record.workContent || '未填写作业内容' }}</p
            ></div
          >
          <ArtDictDisplay
            dict-code="smisSpecialOperationPermitStatus"
            :value="record.status"
            display="tag"
          />
        </div>

        <ArtSectionCard title="基础信息" subtitle="作业范围、时间与当前流程节点">
          <ArtDescriptions :data="record" :items="basicItems" :columns="3" />
        </ArtSectionCard>

        <ArtSectionCard
          v-if="customDetailItems.length"
          title="作业专有信息"
          :subtitle="`${record.operationTypeName}的专项控制参数`"
        >
          <div class="permit-detail__info-grid">
            <div v-for="item in customDetailItems" :key="item.label">
              <span>{{ item.label }}</span
              ><strong>{{ item.value }}</strong>
            </div>
          </div>
        </ArtSectionCard>

        <ArtSectionCard
          v-if="blindPlateItems.length"
          title="盲板明细"
          :subtitle="`共 ${blindPlateItems.length} 项现场隔离记录`"
        >
          <ArtTable
            :data="blindPlateItems"
            :columns="blindPlateColumns"
            :pagination="false"
            table-layout="fixed"
          />
        </ArtSectionCard>

        <ArtSectionCard title="责任人员" subtitle="负责人、监护、验证与交底人员">
          <div class="permit-detail__people">
            <div v-for="group in peopleGroups" :key="group.label">
              <ArtSvgIcon :icon="group.icon" />
              <div>
                <span>{{ group.label }}</span>
                <strong>{{ group.value }}</strong>
              </div>
            </div>
          </div>
        </ArtSectionCard>

        <ArtSectionCard title="作业人员明细" :subtitle="`共 ${record.workers.length} 人`">
          <ArtTable
            :data="record.workers"
            :columns="workerColumns"
            :pagination="false"
            table-layout="fixed"
            empty-text="暂无作业人员"
          />
        </ArtSectionCard>

        <div class="permit-detail__two-column">
          <ArtSectionCard title="现场分析" subtitle="本次现场检测记录">
            <ArtTable
              :data="record.siteAnalysisRecords"
              :columns="siteAnalysisColumns"
              :pagination="false"
              table-layout="fixed"
              empty-text="暂无现场分析记录"
            />
          </ArtSectionCard>
          <ArtSectionCard title="安全措施" subtitle="作业前安全确认结果">
            <div v-if="record.safetyMeasures.length" class="permit-detail__measures">
              <div v-for="item in record.safetyMeasures" :key="item.id"
                ><ArtSvgIcon
                  :icon="item.involved ? 'ri:checkbox-circle-fill' : 'ri:close-circle-line'"
                /><span>{{ item.itemName }}</span></div
              >
            </div>
            <ArtEmptyState
              v-else
              title="暂无安全措施记录"
              description="填写安全措施后，可在此查看落实情况。"
              size="compact"
              :visual-size="64"
            />
          </ArtSectionCard>
        </div>

        <div class="permit-detail__two-column">
          <ArtSectionCard
            title="关联作业"
            :subtitle="`共 ${record.relatedPermits.length} 项`"
            :empty="!record.relatedPermits.length"
            empty-title="暂无关联作业"
            empty-description="关联其他作业许可后可在此核对。"
          >
            <ArtTable
              :data="record.relatedPermits"
              :columns="relatedPermitColumns"
              :pagination="false"
              table-layout="fixed"
            />
          </ArtSectionCard>
          <ArtSectionCard
            title="现场照片"
            :subtitle="`共 ${record.sitePhotoUrls.length} 张`"
            :empty="!record.sitePhotoUrls.length"
            empty-title="暂无现场照片"
            empty-description="上传作业现场照片后可在此查看。"
          >
            <ArtUploadImage :model-value="record.sitePhotoUrls" multiple readonly :size="96" />
          </ArtSectionCard>
        </div>

        <ArtSectionCard title="流程记录" subtitle="完整保留提交、审批、验收和作废痕迹">
          <ElTimeline v-if="record.events?.length">
            <ElTimelineItem
              v-for="event in record.events"
              :key="event.id"
              :timestamp="formatDate(event.createTime)"
              placement="top"
            >
              <strong>{{ event.eventTitle }}</strong
              ><p
                >{{ event.operatorName || '系统'
                }}<template v-if="event.eventDescription">
                  · {{ event.eventDescription }}</template
                ></p
              >
            </ElTimelineItem>
          </ElTimeline>
          <ArtEmptyState
            v-else
            title="暂无流程记录"
            description="提交审批后，可在此查看流转过程。"
            size="compact"
            :visual-size="64"
          />
        </ArtSectionCard>
      </template>

      <SpecialOperationPermitPrint
        v-else
        ref="permitPrintRef"
        :record="record"
        :field-definitions="fieldDefinitions"
        :hot-work-level-labels="hotWorkLevelLabels"
        :hot-work-method-labels="hotWorkMethodLabels"
      />
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import type { ColumnOption } from '@/types'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchSpecialOperationPermit,
    type SmisSpecialOperationBlindPlateItem,
    type SmisSpecialOperationCatalogSelection,
    type SmisSpecialOperationPermit,
    type SmisSpecialOperationPerson,
    type SmisSpecialOperationRelatedPermit,
    type SmisSpecialOperationType
  } from '@smis/api'
  import SpecialOperationPermitPrint from './special-operation-permit-print.vue'
  import { normalizeBlindPlateItems, readCustomValue } from './special-operation-permit-utils'

  const props = defineProps<{
    printPermission: string
    operationTypes: SmisSpecialOperationType[]
  }>()
  interface OpenData {
    row: Pick<SmisSpecialOperationPermit, 'id' | 'tenantId' | 'permitNo'>
    mode?: 'detail' | 'print'
  }
  const dialogRef = ref<ArtDialogExpose<OpenData>>()
  const permitPrintRef = ref<InstanceType<typeof SpecialOperationPermitPrint>>()
  const record = shallowRef<SmisSpecialOperationPermit>()
  const loading = ref(false)
  const activeView = ref<'detail' | 'print'>('detail')
  const { hasAuth } = useAuth()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const canPrint = computed(() => hasAuth(props.printPermission))
  const fieldDefinitions = computed(
    () =>
      props.operationTypes.find((item) => item.id === record.value?.operationTypeId)
        ?.fieldDefinitions ?? []
  )
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—'
    if (Array.isArray(value)) {
      const values = value.map(formatValue).filter((item) => item !== '—')
      return values.join('、') || '—'
    }
    if (typeof value === 'boolean') return value ? '是' : '否'
    const text = String(value).trim()
    return !text || text === '-' || text === '--' ? '—' : text
  }
  const toDictLabelMap = (dictCode: string): Record<string, string> =>
    Object.fromEntries(
      (getDictMap.value[dictCode] ?? []).map((item) => [
        String(item.value),
        item.label || item.name || String(item.value)
      ])
    )
  const hotWorkLevelLabels = computed(() => toDictLabelMap('smisHotWorkLevel'))
  const hotWorkMethodLabels = computed(() => toDictLabelMap('smisHotWorkMethod'))
  const formatDictValue = (labels: Record<string, string>, value: unknown): string => {
    const values = Array.isArray(value) ? value : [value]
    return (
      values
        .map((item) => labels[String(item)] || formatValue(item))
        .filter((item) => item !== '—')
        .join('、') || '—'
    )
  }
  const workAtHeightLevel = computed(() => {
    const height = Number(
      record.value ? readCustomValue(record.value.customValues, 'work_height') : undefined
    )
    if (!Number.isFinite(height) || height < 2) return '—'
    if (height <= 5) return '一级'
    if (height <= 15) return '二级'
    if (height <= 30) return '三级'
    return '特级'
  })
  const blindPlateItems = computed(() =>
    normalizeBlindPlateItems(
      record.value ? readCustomValue(record.value.customValues, 'blind_plate_items') : undefined
    )
  )
  const customDetailItems = computed(() => {
    const currentRecord = record.value
    if (!currentRecord) return []
    const items = fieldDefinitions.value
      .filter(
        (field) =>
          currentRecord.operationTypeCode !== 'HOT_WORK' ||
          !['hot_work_level', 'fire_method', 'hot_work_method', 'hot_work_methods'].includes(
            field.fieldCode
          )
      )
      .map((field) => ({
        label: field.unit ? `${field.fieldLabel}（${field.unit}）` : field.fieldLabel,
        value: formatValue(readCustomValue(currentRecord.customValues, field.fieldCode))
      }))
    if (currentRecord.operationTypeCode === 'HOT_WORK') {
      items.unshift(
        {
          label: '动火级别',
          value: formatDictValue(hotWorkLevelLabels.value, currentRecord.hotWorkLevel)
        },
        {
          label: '动火方式',
          value: formatDictValue(hotWorkMethodLabels.value, currentRecord.hotWorkMethods)
        },
        {
          label: '危害因素',
          value: currentRecord.hazardFactors.map((item) => item.itemName).join('、') || '—'
        }
      )
    }
    if (currentRecord.operationTypeCode === 'WORK_AT_HEIGHT') {
      items.push({ label: '作业级别', value: workAtHeightLevel.value })
    }
    return items
  })
  const formatDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })
  const basicItems = computed<ArtDescriptionItem<SmisSpecialOperationPermit>[]>(() => [
    { key: 'permitNo', label: '作业证编号', field: 'permitNo', copyable: true },
    {
      key: 'operationTypeName',
      label: '作业类型',
      value: (item: SmisSpecialOperationPermit) => formatValue(item.operationTypeName)
    },
    {
      key: 'currentNode',
      label: '当前节点',
      value: (item: SmisSpecialOperationPermit) => formatValue(item.currentNode)
    },
    {
      key: 'workStartTime',
      label: '作业开始时间',
      value: (item: SmisSpecialOperationPermit) => formatDate(item.workStartTime)
    },
    {
      key: 'workEndTime',
      label: '作业结束时间',
      value: (item: SmisSpecialOperationPermit) => formatDate(item.workEndTime)
    },
    {
      key: 'workLocation',
      label: '作业地点',
      value: (item: SmisSpecialOperationPermit) => formatValue(item.workLocation)
    },
    {
      key: 'workUnit',
      label: '作业单位',
      value: (item: SmisSpecialOperationPermit) => formatValue(item.workUnit)
    },
    {
      key: 'workSection',
      label: '作业部位',
      value: (item: SmisSpecialOperationPermit) => formatValue(item.workSection)
    },
    {
      key: 'applicantName',
      label: '申请人',
      value: (item: SmisSpecialOperationPermit) => formatValue(item.applicantName)
    },
    {
      key: 'applicationTime',
      label: '申请时间',
      value: (item: SmisSpecialOperationPermit) => formatDate(item.applicationTime)
    },
    {
      key: 'workContent',
      label: '作业内容',
      value: (item: SmisSpecialOperationPermit) => formatValue(item.workContent),
      span: 2
    },
    {
      key: 'workDescription',
      label: '作业描述',
      value: (item: SmisSpecialOperationPermit) => formatValue(item.workDescription),
      span: 3
    }
  ])
  const names = (people: Array<{ employeeName: string }>) =>
    people.map((item) => item.employeeName).join('、') || '—'
  const workerColumns: ColumnOption<SmisSpecialOperationPerson>[] = [
    { type: 'globalIndex', label: '序号', width: 62 },
    { prop: 'employeeName', label: '作业人员', minWidth: 120 },
    {
      prop: 'organizationName',
      label: '部门',
      minWidth: 150,
      formatter: (row) => formatValue(row.organizationName)
    },
    {
      prop: 'idCardNo',
      label: '身份证号',
      minWidth: 180,
      formatter: (row) => formatValue(row.idCardNo)
    },
    {
      prop: 'phone',
      label: '手机号',
      minWidth: 140,
      formatter: (row) => formatValue(row.phone)
    },
    {
      prop: 'certificateName',
      label: '证件',
      minWidth: 150,
      formatter: (row) => formatValue(row.certificateName)
    },
    {
      prop: 'certificateNumber',
      label: '证书编号',
      minWidth: 160,
      formatter: (row) => formatValue(row.certificateNumber)
    }
  ]
  const siteAnalysisColumns: ColumnOption<SmisSpecialOperationCatalogSelection>[] = [
    { prop: 'itemName', label: '分析项', minWidth: 150 },
    {
      prop: 'normalValue',
      label: '正常值',
      minWidth: 110,
      formatter: (row) => formatValue(row.normalValue)
    },
    {
      prop: 'recordedValue',
      label: '本次记录',
      minWidth: 120,
      formatter: (row) => formatValue(row.recordedValue)
    }
  ]
  const blindPlateColumns: ColumnOption<SmisSpecialOperationBlindPlateItem>[] = [
    { type: 'globalIndex', label: '序号', width: 62 },
    { prop: 'equipmentPipelineName', label: '设备 / 管线名称', minWidth: 170 },
    { prop: 'medium', label: '介质', minWidth: 110, formatter: (row) => formatValue(row.medium) },
    {
      prop: 'temperature',
      label: '温度（℃）',
      minWidth: 110,
      formatter: (row) => formatValue(row.temperature)
    },
    {
      prop: 'pressure',
      label: '压力（MPa）',
      minWidth: 116,
      formatter: (row) => formatValue(row.pressure)
    },
    {
      prop: 'material',
      label: '材质',
      minWidth: 110,
      formatter: (row) => formatValue(row.material)
    },
    { prop: 'specification', label: '规格', minWidth: 120 },
    {
      prop: 'blindPlateNo',
      label: '盲板编号',
      minWidth: 130,
      formatter: (row) => formatValue(row.blindPlateNo)
    }
  ]
  const relatedPermitColumns: ColumnOption<SmisSpecialOperationRelatedPermit>[] = [
    { prop: 'operationTypeName', label: '作业类型', minWidth: 120 },
    {
      prop: 'permitNo',
      label: '作业编号',
      minWidth: 150,
      formatter: (row) => formatValue(row.permitNo)
    },
    {
      prop: 'workLocation',
      label: '作业地点',
      minWidth: 140,
      formatter: (row) => formatValue(row.workLocation)
    }
  ]
  const peopleGroups = computed(() =>
    record.value
      ? [
          {
            label: '作业负责人',
            value: record.value.responsibleEmployee?.employeeName || '—',
            icon: 'ri:user-star-line'
          },
          {
            label: '现场监护人',
            value: names(record.value.guardianEmployees),
            icon: 'ri:shield-user-line'
          },
          {
            label: '作业验证人',
            value: names(record.value.verifierEmployees),
            icon: 'ri:user-follow-line'
          },
          {
            label: '安全交底人',
            value: names(record.value.briefingGiverEmployees),
            icon: 'ri:speak-line'
          },
          {
            label: '接受交底人',
            value: names(record.value.briefingReceiverEmployees),
            icon: 'ri:user-received-2-line'
          },
          {
            label: '现场分析人',
            value: names(record.value.analysts),
            icon: 'ri:flask-line'
          }
        ]
      : []
  )
  const handlePrintAction = (): void => {
    if (activeView.value === 'detail') {
      activeView.value = 'print'
      return
    }
    void permitPrintRef.value?.print().catch((error: unknown) => {
      console.error('作业票打印失败', error)
      ElMessage.error('作业票打印失败，请重试')
    })
  }
  const handleOpen = async (data: OpenData): Promise<void> => {
    record.value = undefined
    activeView.value = data.mode ?? 'detail'
    loading.value = true
    try {
      await dialogRef.value?.handleOpen(data, {
        title: data.mode === 'print' ? '打印预览' : '查看特殊作业票',
        subtitle: data.row.permitNo
      })
      const result = await fetchSpecialOperationPermit(data.row.id, data.row.tenantId)
      record.value = result.data || undefined
    } finally {
      loading.value = false
    }
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .permit-detail {
    display: grid;
    gap: 16px;
    min-width: 0;
  }

  .permit-detail__view-switch {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px 8px 14px;
    background: color-mix(in srgb, var(--theme-color) 4%, var(--default-box-color));
    border: 1px solid var(--art-border-color);
    border-radius: var(--art-control-radius);
  }

  .permit-detail__view-switch > div {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .permit-detail__view-switch > div svg {
    font-size: 16px;
    color: var(--theme-color);
  }

  .permit-detail__view-switch :deep(.el-segmented) {
    --el-segmented-item-selected-bg-color: var(--theme-color);
    --el-segmented-item-selected-color: #fff;

    flex: 0 0 auto;
    padding: 3px;
    background: var(--art-gray-100);
    border-radius: var(--art-control-radius);
  }

  .permit-detail__view-switch :deep(.el-segmented__item) {
    min-width: 88px;
    border-radius: var(--art-surface-radius);
  }

  .permit-detail__identity {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
    padding: 18px;
    overflow: hidden;
    background:
      radial-gradient(
        circle at 92% 20%,
        color-mix(in srgb, var(--theme-color) 12%, transparent),
        transparent 34%
      ),
      var(--art-gray-100);
    border: 1px solid color-mix(in srgb, var(--theme-color) 12%, var(--art-border-color));
    border-radius: var(--art-surface-radius);
  }

  .permit-detail__identity::after {
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    content: '';
    background: var(--theme-color);
  }

  .permit-detail__icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    font-size: 24px;
    color: #fff;
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--theme-color) 78%, white),
      var(--theme-color)
    );
    border-radius: var(--art-control-radius);
    box-shadow: 0 8px 20px color-mix(in srgb, var(--theme-color) 20%, transparent);
  }

  .permit-detail__heading {
    min-width: 0;
  }

  .permit-detail__heading small,
  .permit-detail__heading p {
    color: var(--el-text-color-secondary);
  }

  .permit-detail__heading small {
    font-size: 12px;
    letter-spacing: 0.08em;
  }

  .permit-detail__heading h3 {
    margin: 3px 0;
    font-size: 20px;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }

  .permit-detail__heading p {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .permit-detail__info-grid,
  .permit-detail__people {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .permit-detail__info-grid > div {
    display: grid;
    gap: 6px;
    align-content: center;
    min-height: 68px;
    padding: 12px 14px;
    background: color-mix(in srgb, var(--art-gray-100) 74%, transparent);
    border: 1px solid var(--art-border-color);
    border-radius: var(--art-control-radius);
  }

  .permit-detail__info-grid span,
  .permit-detail__people span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .permit-detail__info-grid strong,
  .permit-detail__people strong {
    line-height: 1.55;
    color: var(--el-text-color-primary);
    overflow-wrap: anywhere;
  }

  .permit-detail__people > div {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    min-height: 72px;
    padding: 12px 14px;
    background: color-mix(in srgb, var(--art-gray-100) 74%, transparent);
    border: 1px solid var(--art-border-color);
    border-radius: var(--art-control-radius);
  }

  .permit-detail__people > div > svg {
    width: 34px;
    height: 34px;
    padding: 8px;
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 10%, transparent);
    border-radius: 50%;
  }

  .permit-detail__people > div > div {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .permit-detail__two-column {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .permit-detail__measures {
    display: grid;
    gap: 8px;
  }

  .permit-detail__measures > div {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 8px 10px;
    line-height: 1.5;
    background: color-mix(in srgb, var(--art-gray-100) 60%, transparent);
    border-radius: var(--art-control-radius);
  }

  .permit-detail__measures svg {
    flex: 0 0 auto;
    margin-top: 2px;
    color: var(--el-color-success);
  }

  :deep(.el-table) {
    --el-table-header-bg-color: var(--art-gray-100);

    border-radius: var(--art-control-radius);
  }

  :deep(.el-timeline) {
    padding-left: 4px;
  }

  :deep(.el-timeline-item__content p) {
    margin: 4px 0 0;
    color: var(--el-text-color-secondary);
  }

  @media (width <= 900px) {
    .permit-detail__info-grid,
    .permit-detail__people {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .permit-detail__two-column {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (width <= 600px) {
    .permit-detail__view-switch {
      flex-direction: column;
      align-items: stretch;
    }

    .permit-detail__view-switch :deep(.el-segmented) {
      width: 100%;
    }

    .permit-detail__view-switch :deep(.el-segmented__item) {
      flex: 1;
      min-width: 0;
    }

    .permit-detail__identity {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .permit-detail__identity > :last-child {
      grid-column: 1 / -1;
      justify-self: start;
    }

    .permit-detail__info-grid,
    .permit-detail__people {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
