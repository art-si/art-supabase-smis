<template>
  <ArtDialog
    @open="
      () => {
        activeDetailTab = 'section-0'
      }
    "
    ref="dialogRef"
    size="lg"
    :show-footer="false"
  >
    <div v-if="record" class="inspection-rectification-detail">
      <div class="inspection-rectification-detail__identity">
        <span aria-hidden="true"><ArtSvgIcon icon="ri:shield-check-line" /></span>
        <div>
          <small>隐患编号</small>
          <strong>{{ record.hazardNo }}</strong>
          <p>{{ record.hazardDescription }}</p>
        </div>
        <ArtDictDisplay
          class="inspection-rectification-detail__status"
          dict-code="smisHiddenHazardGovernanceStatus"
          :value="record.status"
          display="tag"
        />
      </div>

      <ElTabs v-model="activeDetailTab"
        ><ElTabPane name="section-0" label="检查与整改要求"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionCard title="检查与整改要求" subtitle="隐患来源、责任单位及整改要求">
              <ArtDescriptions
                :data="record"
                :items="inspectionItems"
                :columns="2"
              /> </ArtSectionCard></div
        ></ElTabPane>
        <ElTabPane name="section-1" label="整改落实结果"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionCard title="整改落实结果" subtitle="实际整改说明、完成时间与现场证据">
              <ArtDescriptions :data="record" :items="rectificationItems" :columns="2" />
              <div class="inspection-rectification-detail__evidence">
                <section>
                  <strong>隐患照片</strong>
                  <div
                    v-if="record.hazardImageUrls.length"
                    class="inspection-rectification-detail__evidence-gallery"
                  >
                    <ElImage
                      v-for="(url, index) in record.hazardImageUrls"
                      :key="url"
                      :src="url"
                      :preview-src-list="record.hazardImageUrls"
                      :initial-index="index"
                      fit="cover"
                      preview-teleported
                      :alt="`隐患照片 ${index + 1}`"
                    />
                  </div>
                  <ArtEmptyState
                    v-else
                    title="暂无隐患照片"
                    description="该记录尚未上传现场照片。"
                    size="compact"
                    :visual-size="64"
                  />
                </section>
                <section>
                  <strong>整改照片</strong>
                  <div
                    v-if="record.rectificationImageUrls.length"
                    class="inspection-rectification-detail__evidence-gallery"
                  >
                    <ElImage
                      v-for="(url, index) in record.rectificationImageUrls"
                      :key="url"
                      :src="url"
                      :preview-src-list="record.rectificationImageUrls"
                      :initial-index="index"
                      fit="cover"
                      preview-teleported
                      :alt="`整改照片 ${index + 1}`"
                    />
                  </div>
                  <ArtEmptyState
                    v-else
                    title="尚未上传整改照片"
                    description="整改完成后可在记录中补充现场照片。"
                    size="compact"
                    :visual-size="64"
                  />
                </section>
              </div> </ArtSectionCard></div></ElTabPane
      ></ElTabs>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import type { SmisRectificationNoticeRecord } from '@smis/api'

  const activeDetailTab = ref('section-0')
  const dialogRef = ref<ArtDialogExpose<SmisRectificationNoticeRecord>>()
  const record = shallowRef<SmisRectificationNoticeRecord | null>(null)
  const formatDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })
  const inspectionItems: ArtDescriptionItem<SmisRectificationNoticeRecord>[] = [
    { key: 'noticeNo', label: '通知单号', field: 'noticeNo', copyable: true },
    { key: 'rectificationPlanNo', label: '整改计划号', field: 'rectificationPlanNo' },
    {
      key: 'hazardLevel',
      label: '隐患级别',
      field: 'hazardLevel',
      dictCode: 'smisHazardLevel',
      dictDisplay: 'tag'
    },
    { key: 'location', label: '隐患位置', field: 'location' },
    {
      key: 'inspectionTime',
      label: '检查时间',
      value: (data: SmisRectificationNoticeRecord) => formatDate(data.inspectionTime)
    },
    { key: 'inspectorNames', label: '检查人员', field: 'inspectorNames' },
    {
      key: 'inspectionOrganizationName',
      label: '检查单位',
      field: 'inspectionOrganizationName'
    },
    {
      key: 'inspectedOrganizationName',
      label: '被检查单位',
      field: 'inspectedOrganizationName'
    },
    {
      key: 'rectificationDeadline',
      label: '整改时限',
      value: (data: SmisRectificationNoticeRecord) => formatDate(data.rectificationDeadline)
    },
    {
      key: 'responsibleEmployeeName',
      label: '整改负责人',
      field: 'responsibleEmployeeName'
    },
    {
      key: 'hazardDescription',
      label: '检查问题',
      field: 'hazardDescription',
      span: 2
    },
    {
      key: 'rectificationRequirement',
      label: '整改措施',
      field: 'rectificationRequirement',
      span: 2
    }
  ]
  const rectificationItems: ArtDescriptionItem<SmisRectificationNoticeRecord>[] = [
    {
      key: 'rectificationCompletedAt',
      label: '整改完成时间',
      value: (data: SmisRectificationNoticeRecord) => formatDate(data.rectificationCompletedAt)
    },
    {
      key: 'status',
      label: '当前状态',
      field: 'status',
      dictCode: 'smisHiddenHazardGovernanceStatus',
      dictDisplay: 'tag'
    },
    {
      key: 'rectificationDescription',
      label: '实际整改说明',
      field: 'rectificationDescription',
      span: 2
    }
  ]
  const handleOpen = async (row: SmisRectificationNoticeRecord): Promise<void> => {
    record.value = row
    const organizationContext =
      row.inspectedOrganizationName && row.inspectedOrganizationName !== '—'
        ? row.inspectedOrganizationName
        : row.location
    await dialogRef.value?.handleOpen(row, {
      title: '整改落实详情',
      subtitle: `${row.hazardNo} · ${organizationContext}`,
      showFooter: false,
      contentMaxHeight: 'calc(100vh - 150px)'
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .inspection-rectification-detail {
    display: grid;
    gap: var(--art-space-4);
    min-width: 0;

    &__identity {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr) auto;
      gap: var(--art-space-3);
      align-items: center;
      padding: var(--art-space-4);
      background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-base);
    }

    &__identity > span[aria-hidden='true'] {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      color: var(--theme-color);
      background: var(--default-box-color);
      border-radius: var(--el-border-radius-base);
    }

    &__status {
      justify-self: start;
    }

    &__identity > div {
      display: grid;
      gap: var(--art-space-1);
      min-width: 0;
    }

    &__identity small,
    &__identity p {
      margin: 0;
      color: var(--el-text-color-secondary);
    }

    &__identity strong,
    &__identity p {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__identity strong {
      color: var(--el-text-color-primary);
    }

    &__evidence {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--art-space-4);
      margin-top: var(--art-space-4);
    }

    &__evidence section {
      min-width: 0;
    }

    &__evidence section > strong {
      display: block;
      margin-bottom: var(--art-space-2);
      color: var(--el-text-color-primary);
    }

    &__evidence-gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
      gap: var(--art-space-2);
    }

    &__evidence :deep(.el-image) {
      width: 100%;
      height: 92px;
      border-radius: var(--el-border-radius-base);
    }

    @media (width <= 680px) {
      &__identity {
        grid-template-columns: 48px minmax(0, 1fr);
      }

      &__status {
        grid-column: 1 / -1;
      }

      &__evidence {
        grid-template-columns: 1fr;
      }
    }
  }
</style>
