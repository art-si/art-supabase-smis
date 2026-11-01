<template>
  <ArtDrawer
    @open="
      () => {
        activeDetailTab = 'section-0'
      }
    "
    ref="drawerRef"
  >
    <div v-if="detail" class="hazard-detail">
      <div class="hazard-detail__hero">
        <ElImage
          v-if="detail.imageUrls[0]"
          :src="detail.imageUrls[0]"
          :preview-src-list="detail.imageUrls"
          fit="cover"
          preview-teleported
        />
        <span v-else aria-hidden="true"><ArtSvgIcon icon="ri:alarm-warning-line" /></span>
        <div class="hazard-detail__identity">
          <strong>{{ detail.hazardName }}</strong>
          <small>{{ detail.hazardNo }} · {{ detail.siteName }}</small>
        </div>
        <div class="hazard-detail__status">
          <ArtDictDisplay
            dict-code="smisHazardSourceLevel"
            :value="detail.hazardLevel"
            display="tag"
          />
          <ArtDictDisplay
            dict-code="commonDraftSubmittedStatus"
            :value="detail.recordStatus"
            display="tag"
          />
        </div>
      </div>

      <ElTabs v-model="activeDetailTab"
        ><ElTabPane name="section-0" label="危险源与责任"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionCard title="台账信息" subtitle="危险源识别、数量、地点与分级信息">
              <ArtDescriptions :data="detail" :items="ledgerItems" :columns="2" />
            </ArtSectionCard>
            <ArtSectionCard title="管控责任" subtitle="系统组织部门与责任人信息">
              <ArtDescriptions
                :data="detail"
                :items="responsibilityItems"
                :columns="2"
              /> </ArtSectionCard></div
        ></ElTabPane>
        <ElTabPane name="section-1" label="评价与资料"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionCard title="评价与备案" subtitle="危险源评价和备案记录">
              <ArtDescriptions :data="detail" :items="filingItems" :columns="2" />
            </ArtSectionCard>
            <ArtSectionCard
              v-if="detail.imageUrls.length"
              title="现场照片"
              :subtitle="`共 ${detail.imageUrls.length} 张`"
            >
              <div class="hazard-detail__gallery">
                <ElImage
                  v-for="(url, index) in detail.imageUrls"
                  :key="url"
                  :src="url"
                  :preview-src-list="detail.imageUrls"
                  :initial-index="index"
                  fit="cover"
                  preview-teleported
                />
              </div> </ArtSectionCard></div></ElTabPane
      ></ElTabs>
    </div>
  </ArtDrawer>
</template>

<script setup lang="ts">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import dayjs from 'dayjs'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import type { SmisHazardSource } from '@smis/api'

  const activeDetailTab = ref('section-0')
  const drawerRef = ref<ArtDrawerExpose<SmisHazardSource>>()
  const detail = shallowRef<SmisHazardSource | null>(null)
  const emptyText = (value?: string | null) => value || '—'
  const formatDate = createDateTimeFormatter({ format: 'YYYY-MM-DD', emptyText: '—' })
  const ledgerItems: ArtDescriptionItem<SmisHazardSource>[] = [
    { key: 'hazardNo', label: '危险源编号', field: 'hazardNo', copyable: true },
    { key: 'hazardName', label: '危险源名称', field: 'hazardName' },
    { key: 'siteName', label: '所在场所', field: 'siteName' },
    {
      key: 'location',
      label: '地点',
      value: (data: SmisHazardSource) => emptyText(data.location)
    },
    {
      key: 'quantity',
      label: '数量',
      value: (data: SmisHazardSource) => data.quantity ?? '—'
    },
    {
      key: 'hazardLevel',
      label: '危险等级',
      field: 'hazardLevel',
      dictCode: 'smisHazardSourceLevel',
      dictDisplay: 'tag'
    },
    {
      key: 'riskLevel',
      label: '风险等级',
      field: 'riskLevel',
      dictCode: 'smisHazardSourceRiskLevel',
      dictDisplay: 'tag'
    }
  ]
  const filingItems: ArtDescriptionItem<SmisHazardSource>[] = [
    {
      key: 'evaluationDate',
      label: '评价时间',
      value: (data: SmisHazardSource) => formatDate(data.evaluationDate)
    },
    {
      key: 'evaluationOrganization',
      label: '评价单位',
      value: (data: SmisHazardSource) => emptyText(data.evaluationOrganization)
    },
    {
      key: 'filingDate',
      label: '备案时间',
      value: (data: SmisHazardSource) => formatDate(data.filingDate)
    },
    {
      key: 'filingOrganization',
      label: '备案单位',
      value: (data: SmisHazardSource) => emptyText(data.filingOrganization)
    },
    {
      key: 'filingNo',
      label: '备案号',
      value: (data: SmisHazardSource) => emptyText(data.filingNo),
      span: 2
    }
  ]
  const responsibilityItems: ArtDescriptionItem<SmisHazardSource>[] = [
    { key: 'controlOrganizationName', label: '管控部门', field: 'controlOrganizationName' },
    {
      key: 'responsibleEmployeeName',
      label: '责任人',
      value: (data: SmisHazardSource) =>
        data.responsibleEmployeeName
          ? `${data.responsibleEmployeeName}${data.responsibleEmployeeNo ? ` · ${data.responsibleEmployeeNo}` : ''}`
          : '—'
    },
    {
      key: 'remark',
      label: '备注',
      value: (data: SmisHazardSource) => emptyText(data.remark),
      span: 2
    },
    {
      key: 'updateTime',
      label: '更新时间',
      value: (data: SmisHazardSource) =>
        data.updateTime ? dayjs(data.updateTime).format('YYYY-MM-DD HH:mm:ss') : '—'
    }
  ]

  const handleOpen = async (row: SmisHazardSource): Promise<void> => {
    detail.value = row
    await drawerRef.value?.handleOpen(row, {
      title: '危险源详情',
      subtitle: '查看危险源台账、评价备案与管控责任信息',
      size: 'lg',
      showFooter: false,
      contentHeight: 'calc(100vh - 138px)'
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .hazard-detail {
    display: grid;
    gap: 16px;

    &__hero {
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 14px;
      background: color-mix(in srgb, var(--el-color-danger) 6%, var(--default-box-color));
      border-left: 3px solid var(--el-color-danger);
      border-radius: var(--el-border-radius-base);
    }

    &__hero :deep(.el-image),
    &__hero > span {
      display: grid;
      place-items: center;
      width: 72px;
      height: 72px;
      color: var(--el-color-danger);
      background: var(--default-box-color);
      border-radius: var(--el-border-radius-base);
    }

    &__identity {
      display: grid;
      min-width: 0;
    }

    &__identity strong,
    &__identity small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__identity strong {
      font-size: 18px;
      color: var(--el-text-color-primary);
    }

    &__identity small {
      margin-top: 5px;
      color: var(--el-text-color-secondary);
    }

    &__status {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    &__gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 10px;
    }

    &__gallery :deep(.el-image) {
      width: 100%;
      height: 96px;
      border-radius: var(--el-border-radius-base);
    }

    @media (width <= 620px) {
      &__hero {
        grid-template-columns: 60px minmax(0, 1fr);
      }

      &__hero :deep(.el-image),
      &__hero > span {
        width: 60px;
        height: 60px;
      }

      &__status {
        grid-column: 1 / -1;
      }
    }
  }
</style>
