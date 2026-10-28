<template>
  <ArtDrawer ref="drawerRef">
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

      <ArtSectionTitle title="隐患信息" subtitle="来源、级别、位置与上报责任" />
      <dl class="hazard-ledger-detail__grid">
        <div
          ><dt>责任单位</dt><dd>{{ current?.hazardOrganizationName || '—' }}</dd></div
        >
        <div
          ><dt>隐患位置</dt><dd>{{ current?.location || '—' }}</dd></div
        >
        <div
          ><dt>隐患来源</dt
          ><dd
            ><ArtDictDisplay
              v-if="current"
              dict-code="smisHiddenHazardSourceType"
              :value="current.sourceType"
              display="auto" /></dd
        ></div>
        <div
          ><dt>来源编号</dt><dd>{{ current?.sourceRecordNo || '—' }}</dd></div
        >
        <div
          ><dt>隐患级别</dt
          ><dd
            ><ArtDictDisplay
              v-if="current"
              dict-code="smisHazardLevel"
              :value="current.hazardLevel"
              display="tag" /></dd
        ></div>
        <div
          ><dt>排查类型</dt><dd>{{ current?.inspectionTypeName || '—' }}</dd></div
        >
        <div
          ><dt>上报人</dt
          ><dd>{{ current?.reporterEmployeeName }} · {{ current?.reporterEmployeeNo }}</dd></div
        >
        <div
          ><dt>上报时间</dt><dd>{{ formatDate(current?.reportedAt) }}</dd></div
        >
      </dl>
      <NarrativeBlock label="隐患描述" :content="current?.description" />
      <EvidenceGallery title="隐患照片" :images="current?.imageUrls || []" />

      <ArtSectionTitle title="整改闭环" subtitle="核准、整改、验收与关闭信息" />
      <dl class="hazard-ledger-detail__grid">
        <div
          ><dt>核准人</dt><dd>{{ current?.approverEmployeeName || '—' }}</dd></div
        >
        <div
          ><dt>核准时间</dt><dd>{{ formatDate(current?.approvedAt) }}</dd></div
        >
        <div
          ><dt>整改责任人</dt
          ><dd>{{ current?.rectificationResponsibleEmployeeName || '—' }}</dd></div
        >
        <div
          ><dt>整改时限</dt
          ><dd :class="{ 'is-overdue': current?.overdue }">{{
            formatDate(current?.rectificationDeadline)
          }}</dd></div
        >
        <div
          ><dt>完成时间</dt><dd>{{ formatDate(current?.rectificationCompletedAt) }}</dd></div
        >
        <div
          ><dt>验收时间</dt><dd>{{ formatDate(current?.acceptedAt) }}</dd></div
        >
        <div
          ><dt>验收人</dt><dd>{{ current?.acceptorEmployeeName || '—' }}</dd></div
        >
        <div
          ><dt>关闭时间</dt><dd>{{ formatDate(current?.closedAt) }}</dd></div
        >
      </dl>
      <NarrativeBlock label="整改要求" :content="current?.rectificationSuggestion" />
      <NarrativeBlock label="整改措施" :content="current?.rectificationMeasures" />
      <NarrativeBlock label="整改说明" :content="current?.rectificationDescription" />
      <NarrativeBlock
        label="验收说明"
        :content="current?.acceptanceDescription || current?.closeReason"
      />
      <EvidenceGallery title="整改照片" :images="current?.rectificationImageUrls || []" />
      <EvidenceGallery title="验收照片" :images="current?.acceptanceImageUrls || []" />

      <ArtSectionTitle title="流转记录" subtitle="按时间保留隐患治理全过程证据" />
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
      <ArtEmptyState v-else title="暂无流转记录" description="该隐患尚未产生后续治理事件。" />
    </div>
  </ArtDrawer>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import { ElImage } from 'element-plus'
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

  const drawerRef = ref<ArtDrawerExpose<HazardLedgerDetailOpenData>>()
  const current = shallowRef<SmisHiddenHazardLedgerRecord>()
  const formatDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })
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

    &__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin: -8px 0 0;
      overflow: hidden;
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);

      > div {
        display: grid;
        grid-template-columns: 112px minmax(0, 1fr);
        border-bottom: 1px solid var(--el-border-color-lighter);
      }

      > div:nth-child(odd) {
        border-right: 1px solid var(--el-border-color-lighter);
      }

      dt,
      dd {
        min-width: 0;
        padding: 11px 12px;
        margin: 0;
      }

      dt {
        font-size: 12px;
        font-weight: 600;
        color: var(--el-text-color-secondary);
        background: var(--el-fill-color-light);
      }

      dd {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      dd.is-overdue {
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

    @media (width <= 900px) {
      &__grid {
        grid-template-columns: 1fr;
      }

      &__grid > div:nth-child(odd) {
        border-right: 0;
      }
    }
  }
</style>
