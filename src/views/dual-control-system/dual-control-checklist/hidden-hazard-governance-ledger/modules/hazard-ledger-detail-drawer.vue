<template>
  <ArtDrawer
    @open="
      () => {
        activeDetailTab = 'section-0'
      }
    "
    ref="drawerRef"
  >
    <div class="hazard-ledger-detail">
      <div class="hazard-ledger-detail__identity">
        <span aria-hidden="true"><ArtSvgIcon icon="ri:file-list-3-line" /></span>
        <div>
          <small>隐患编号</small><strong>{{ current?.hazardNo }}</strong>
          <p>{{ current?.hazardOrganizationName || '未关联责任单位' }} · {{ current?.location }}</p>
        </div>
        <ArtDictDisplay
          v-if="current"
          dict-code="smisHiddenHazardGovernanceStatus"
          :value="current.status"
          display="tag"
        />
      </div>

      <ElTabs class="art-card-xs art-overlay-tab-card" v-model="activeDetailTab"
        ><ElTabPane name="section-0" label="隐患信息"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionTitle title="隐患信息" subtitle="来源、级别、位置与上报责任" />
            <ArtDescriptions
              v-if="current"
              :data="current"
              :items="informationItems"
              :columns="2"
              :tablet-columns="isCompact ? 1 : 2"
              :label-width="112"
              empty-text=""
            >
              <template #item-sourceType>
                <ArtDictDisplay
                  dict-code="smisHiddenHazardSourceType"
                  :value="current.sourceType"
                  display="auto"
                />
              </template>
              <template #item-hazardLevel>
                <ArtDictDisplay
                  dict-code="smisHazardLevel"
                  :value="current.hazardLevel"
                  display="tag"
                />
              </template>
            </ArtDescriptions>
            <NarrativeBlock label="隐患描述" :content="current?.description" />
            <EvidenceGallery title="隐患照片" :images="current?.imageUrls || []" /> </div
        ></ElTabPane>
        <ElTabPane name="section-1" label="整改闭环"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionTitle title="整改闭环" subtitle="核准、整改、验收与关闭信息" />
            <ArtDescriptions
              v-if="current"
              :data="current"
              :items="closureItems"
              :columns="2"
              :tablet-columns="isCompact ? 1 : 2"
              :label-width="112"
              empty-text=""
            >
              <template #item-rectificationDeadline>
                <span
                  class="hazard-ledger-detail__deadline"
                  :class="{ 'is-overdue': current.overdue }"
                >
                  {{ formatDate(current.rectificationDeadline) }}
                </span>
              </template>
            </ArtDescriptions>
            <NarrativeBlock label="整改要求" :content="current?.rectificationSuggestion" />
            <NarrativeBlock label="整改措施" :content="current?.rectificationMeasures" />
            <NarrativeBlock label="整改说明" :content="current?.rectificationDescription" />
            <NarrativeBlock
              label="验收说明"
              :content="current?.acceptanceDescription || current?.closeReason"
            />
            <EvidenceGallery title="整改照片" :images="current?.rectificationImageUrls || []" />
            <EvidenceGallery title="验收照片" :images="current?.acceptanceImageUrls || []" /> </div
        ></ElTabPane>
        <ElTabPane name="section-2" label="流转记录"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionTitle title="流转记录" subtitle="按时间保留隐患治理全过程证据" />
            <ElTimeline v-if="current?.events?.length" class="hazard-ledger-detail__timeline">
              <ElTimelineItem
                v-for="event in [...current.events].reverse()"
                :key="event.id"
                :timestamp="formatDate(event.eventAt)"
                placement="top"
              >
                <article class="hazard-ledger-detail__event">
                  <strong>{{ event.title }}</strong
                  ><p>{{ event.content || '系统记录' }}</p>
                  <small>{{ event.operatorName || '系统' }}</small>
                </article>
              </ElTimelineItem>
            </ElTimeline>
            <ArtEmptyState
              v-else
              title="暂无流转记录"
              description="该隐患尚未产生后续治理事件。" /></div></ElTabPane
      ></ElTabs>
    </div>
  </ArtDrawer>
</template>

<script setup lang="tsx">
  import { useMediaQuery } from '@vueuse/core'
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import { ElImage } from 'element-plus'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { SmisHiddenHazardLedgerRecord } from '@smis/api'

  export interface HazardLedgerDetailOpenData {
    row: SmisHiddenHazardLedgerRecord
  }
  interface NarrativeBlockProps {
    label: string
    content?: string | null
  }
  interface EvidenceGalleryProps {
    title: string
    images: string[]
  }

  const NarrativeBlock = (props: NarrativeBlockProps) => (
    <section class="hazard-ledger-detail__narrative">
      <strong>{props.label}</strong>
      <p>{props.content || '—'}</p>
    </section>
  )
  const EvidenceGallery = (props: EvidenceGalleryProps) => (
    <section class="hazard-ledger-detail__evidence" aria-label={props.title}>
      <strong>{props.title}</strong>
      {props.images.length ? (
        <div class="hazard-ledger-detail__evidence-gallery">
          {props.images.map((url, index) => (
            <ElImage
              key={url}
              src={url}
              previewSrcList={props.images}
              initialIndex={index}
              fit="cover"
            />
          ))}
        </div>
      ) : (
        <ArtEmptyState
          title={`暂无${props.title}`}
          description="该记录尚未上传对应照片。"
          size="compact"
          visualSize={64}
        />
      )}
    </section>
  )

  const activeDetailTab = ref('section-0')
  const drawerRef = ref<ArtDrawerExpose<HazardLedgerDetailOpenData>>()
  const current = shallowRef<SmisHiddenHazardLedgerRecord>()
  const isCompact = useMediaQuery('(max-width: 900px)')
  const formatDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })
  const informationItems: ArtDescriptionItem<SmisHiddenHazardLedgerRecord>[] = [
    {
      key: 'hazardOrganizationName',
      label: '责任单位',
      value: (row) => row.hazardOrganizationName || '—'
    },
    { key: 'location', label: '隐患位置', value: (row) => row.location || '—' },
    { key: 'sourceType', label: '隐患来源', field: 'sourceType' },
    { key: 'sourceRecordNo', label: '来源编号', value: (row) => row.sourceRecordNo || '—' },
    { key: 'hazardLevel', label: '隐患级别', field: 'hazardLevel' },
    {
      key: 'inspectionTypeName',
      label: '排查类型',
      value: (row) => row.inspectionTypeName || '—'
    },
    {
      key: 'reporterEmployee',
      label: '上报人',
      value: (row) => `${row.reporterEmployeeName ?? ''} · ${row.reporterEmployeeNo ?? ''}`
    },
    { key: 'reportedAt', label: '上报时间', value: (row) => formatDate(row.reportedAt) }
  ]
  const closureItems: ArtDescriptionItem<SmisHiddenHazardLedgerRecord>[] = [
    {
      key: 'approverEmployeeName',
      label: '核准人',
      value: (row) => row.approverEmployeeName || '—'
    },
    { key: 'approvedAt', label: '核准时间', value: (row) => formatDate(row.approvedAt) },
    {
      key: 'rectificationResponsibleEmployeeName',
      label: '整改责任人',
      value: (row) => row.rectificationResponsibleEmployeeName || '—'
    },
    {
      key: 'rectificationDeadline',
      label: '整改时限',
      field: 'rectificationDeadline'
    },
    {
      key: 'rectificationCompletedAt',
      label: '完成时间',
      value: (row) => formatDate(row.rectificationCompletedAt)
    },
    { key: 'acceptedAt', label: '验收时间', value: (row) => formatDate(row.acceptedAt) },
    {
      key: 'acceptorEmployeeName',
      label: '验收人',
      value: (row) => row.acceptorEmployeeName || '—'
    },
    { key: 'closedAt', label: '关闭时间', value: (row) => formatDate(row.closedAt) }
  ]
  const handleOpen = async (data: HazardLedgerDetailOpenData): Promise<void> => {
    current.value = data.row
    await drawerRef.value?.handleOpen(data, {
      title: '隐患治理详情',
      subtitle: `${data.row.hazardNo} · ${data.row.location}`,
      size: 'xl',
      showFooter: false,
      contentHeight: 'calc(100vh - 120px)'
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  @use '../../../shared/detail-identity' as detail;

  .hazard-ledger-detail {
    display: grid;
    gap: 18px;

    &__identity {
      @include detail.identity;
    }

    &__deadline {
      &.is-overdue {
        font-weight: 700;
        color: var(--el-color-danger);
      }
    }

    &__narrative,
    &__evidence,
    &__event {
      padding: 14px 16px;
      background: var(--el-fill-color-extra-light);
      border-left: 3px solid var(--el-border-color);
      border-radius: var(--el-border-radius-base);
    }

    &__narrative p,
    &__event p {
      margin: 6px 0 0;
      line-height: 1.7;
      white-space: pre-wrap;
    }

    &__evidence-gallery {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
    }

    &__evidence :deep(.el-image) {
      width: 96px;
      height: 96px;
      overflow: hidden;
      border-radius: var(--el-border-radius-base);
    }

    &__timeline {
      padding: 4px 12px 0;
    }

    &__event small {
      color: var(--el-text-color-secondary);
    }
  }
</style>
