<template>
  <ArtDrawer ref="drawerRef" :loading="loading" loading-text="正在加载隐患详情…">
    <div v-if="detail" class="hazard-governance-detail">
      <div class="hazard-governance-detail__identity">
        <span aria-hidden="true"><ArtSvgIcon icon="ri:shield-check-line" /></span>
        <div>
          <small>隐患编号</small>
          <strong>{{ detail.hazardNo }}</strong>
          <p>{{ detail.location }} · {{ detail.inspectionTypeName || '未关联排查类型' }}</p>
        </div>
        <ArtDictDisplay
          dict-code="smisHiddenHazardGovernanceStatus"
          :value="detail.status"
          display="tag"
        />
      </div>

      <ArtSectionTitle title="隐患信息" subtitle="位置、级别、来源和上报责任" />
      <dl class="hazard-governance-detail__grid">
        <div
          ><dt>隐患位置</dt><dd>{{ detail.location }}</dd></div
        >
        <div>
          <dt>隐患级别</dt>
          <dd>
            <ArtDictDisplay dict-code="smisHazardLevel" :value="detail.hazardLevel" display="tag" />
          </dd>
        </div>
        <div>
          <dt>隐患来源</dt>
          <dd>
            <ArtDictDisplay
              dict-code="smisHiddenHazardSourceType"
              :value="detail.sourceType"
              display="auto"
            />
          </dd>
        </div>
        <div
          ><dt>来源编号</dt><dd>{{ detail.sourceRecordNo || '—' }}</dd></div
        >
        <div>
          <dt>上报人</dt>
          <dd>{{ detail.reporterEmployeeName }} · {{ detail.reporterEmployeeNo }}</dd>
        </div>
        <div
          ><dt>上报时间</dt><dd>{{ formatDate(detail.reportedAt) }}</dd></div
        >
      </dl>
      <div class="hazard-governance-detail__narrative">
        <strong>隐患描述</strong>
        <p>{{ detail.description }}</p>
        <strong>整改建议</strong>
        <p>{{ detail.rectificationSuggestion || '未填写整改建议' }}</p>
      </div>
      <EvidenceGallery title="隐患照片" :images="detail.imageUrls" />

      <template v-if="detail.approvedAt || detail.status !== 'pending_approval'">
        <ArtSectionTitle title="核准与整改" subtitle="核准结论、责任人、时限及整改证据" />
        <dl class="hazard-governance-detail__grid">
          <div>
            <dt>核准结论</dt>
            <dd>
              <ArtDictDisplay
                v-if="detail.approvalResult"
                dict-code="smisHiddenHazardApprovalResult"
                :value="detail.approvalResult"
                display="auto"
              />
              <span v-else>—</span>
            </dd>
          </div>
          <div>
            <dt>核准人</dt>
            <dd>{{ employeeText(detail.approverEmployeeName, detail.approverEmployeeNo) }}</dd>
          </div>
          <div
            ><dt>核准时间</dt><dd>{{ formatDate(detail.approvedAt) }}</dd></div
          >
          <div
            ><dt>整改时限</dt><dd>{{ formatDate(detail.rectificationDeadline) }}</dd></div
          >
          <div>
            <dt>整改责任人</dt>
            <dd>{{
              employeeText(
                detail.rectificationResponsibleEmployeeName,
                detail.rectificationResponsibleEmployeeNo
              )
            }}</dd>
          </div>
          <div
            ><dt>整改完成时间</dt><dd>{{ formatDate(detail.rectificationCompletedAt) }}</dd></div
          >
        </dl>
        <div class="hazard-governance-detail__narrative">
          <strong>{{ detail.approvalResult === 'close' ? '关闭原因' : '整改措施' }}</strong>
          <p>{{
            detail.approvalResult === 'close'
              ? detail.closeReason || detail.approvalDescription || '—'
              : detail.rectificationMeasures || '—'
          }}</p>
          <template v-if="detail.rectificationDescription">
            <strong>整改完成说明</strong>
            <p>{{ detail.rectificationDescription }}</p>
          </template>
        </div>
        <EvidenceGallery title="整改照片" :images="detail.rectificationImageUrls" />
      </template>

      <template v-if="detail.acceptedAt || detail.acceptanceResult">
        <ArtSectionTitle title="验收信息" subtitle="验收结论、验收说明与现场照片" />
        <dl class="hazard-governance-detail__grid">
          <div>
            <dt>验收结论</dt>
            <dd>
              <ArtDictDisplay
                v-if="detail.acceptanceResult"
                dict-code="smisHiddenHazardAcceptanceResult"
                :value="detail.acceptanceResult"
                display="auto"
              />
              <span v-else>—</span>
            </dd>
          </div>
          <div>
            <dt>验收人</dt>
            <dd>{{ employeeText(detail.acceptorEmployeeName, detail.acceptorEmployeeNo) }}</dd>
          </div>
          <div
            ><dt>验收时间</dt><dd>{{ formatDate(detail.acceptedAt) }}</dd></div
          >
        </dl>
        <div class="hazard-governance-detail__narrative">
          <strong>验收说明</strong>
          <p>{{ detail.acceptanceDescription || '—' }}</p>
        </div>
        <EvidenceGallery title="验收照片" :images="detail.acceptanceImageUrls" />
      </template>

      <ArtSectionTitle title="流转记录" subtitle="登记、核准、整改和验收全过程留痕" />
      <ElTimeline class="hazard-governance-detail__timeline">
        <ElTimelineItem
          v-for="event in [...detail.events].reverse()"
          :key="event.id"
          :timestamp="formatDate(event.eventAt)"
          placement="top"
        >
          <article class="hazard-governance-detail__event">
            <strong>{{ event.eventTitle }}</strong>
            <p>{{ event.eventContent || '系统记录' }}</p>
            <small>{{ employeeText(event.operatorEmployeeName, event.operatorEmployeeNo) }}</small>
            <div v-if="event.evidenceUrls.length" class="hazard-governance-detail__event-images">
              <ElImage
                v-for="(url, index) in event.evidenceUrls"
                :key="event.id + '-' + url"
                :src="url"
                :preview-src-list="event.evidenceUrls"
                :initial-index="index"
                fit="cover"
                :alt="event.eventTitle + '照片 ' + (index + 1)"
              />
            </div>
          </article>
        </ElTimelineItem>
      </ElTimeline>
    </div>
  </ArtDrawer>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import { ElImage } from 'element-plus'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import {
    fetchHiddenHazardGovernanceDetail,
    type SmisHiddenHazardGovernanceDetail,
    type SmisHiddenHazardGovernanceRecord
  } from '@smis/api'

  export interface HazardDetailDrawerOpenData {
    row: SmisHiddenHazardGovernanceRecord
  }
  interface EvidenceGalleryProps {
    title: string
    images: string[]
  }

  const EvidenceGallery = (props: EvidenceGalleryProps) => (
    <section class="hazard-governance-detail__evidence" aria-label={props.title}>
      <strong>{props.title}</strong>
      {props.images.length ? (
        <div class="hazard-governance-detail__evidence-gallery">
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
  const drawerRef = ref<ArtDrawerExpose<HazardDetailDrawerOpenData>>()
  const detail = shallowRef<SmisHiddenHazardGovernanceDetail | null>(null)
  const loading = ref(false)
  const formatDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })
  const employeeText = (name?: string | null, no?: string | null): string =>
    name ? name + (no ? ' · ' + no : '') : '—'
  const handleOpen = async (data: HazardDetailDrawerOpenData): Promise<void> => {
    detail.value = null
    await drawerRef.value?.handleOpen(data, {
      title: '隐患详情',
      subtitle: data.row.hazardNo + ' · ' + data.row.location,
      size: 'xl',
      showFooter: false,
      contentHeight: 'calc(100vh - 120px)',
      onOpen: async () => {
        loading.value = true
        try {
          detail.value = await fetchHiddenHazardGovernanceDetail(data.row.id)
        } finally {
          loading.value = false
        }
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  @use '../../../shared/detail-identity' as detail;

  .hazard-governance-detail {
    display: grid;
    gap: 18px;
    min-width: 0;

    &__identity {
      @include detail.identity('> span');
    }

    &__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin: -8px 0 0;
      overflow: hidden;
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__grid > div {
      display: grid;
      grid-template-columns: 120px minmax(0, 1fr);
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    &__grid > div:nth-child(odd) {
      border-right: 1px solid var(--el-border-color-lighter);
    }

    &__grid dt,
    &__grid dd {
      min-width: 0;
      padding: 11px 12px;
      margin: 0;
    }

    &__grid dt {
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-secondary);
      background: var(--el-fill-color-light);
    }

    &__grid dd {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__narrative,
    &__evidence {
      display: grid;
      gap: 8px;
      padding: 14px 16px;
      background: var(--el-fill-color-extra-light);
      border-left: 3px solid var(--el-border-color);
      border-radius: var(--el-border-radius-base);
    }

    &__narrative p {
      margin: 0;
      line-height: 1.7;
      color: var(--el-text-color-regular);
      white-space: pre-wrap;
    }

    &__evidence-gallery,
    &__event-images {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    &__evidence :deep(.el-image),
    &__event-images :deep(.el-image) {
      width: 96px;
      height: 96px;
      overflow: hidden;
      border-radius: var(--el-border-radius-base);
    }

    &__timeline {
      padding: 4px 12px 0;
    }

    &__event {
      padding: 12px 14px;
      background: var(--default-box-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__event p {
      margin: 4px 0;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    &__event small {
      color: var(--el-text-color-secondary);
    }

    &__event-images {
      margin-top: 10px;
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
