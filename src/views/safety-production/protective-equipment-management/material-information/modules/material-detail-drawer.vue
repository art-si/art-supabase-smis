<template>
  <ArtDrawer
    @open="
      () => {
        activeDetailTab = 'section-0'
      }
    "
    ref="drawerRef"
  >
    <div v-if="detail" class="material-detail-drawer">
      <div class="material-detail-drawer__hero">
        <ElImage
          v-if="detail.imageUrls?.[0]"
          :src="detail.imageUrls[0]"
          :preview-src-list="detail.imageUrls"
          fit="cover"
          preview-teleported
        />
        <span v-else aria-hidden="true"><ArtSvgIcon icon="ri:archive-stack-line" /></span>
        <div
          ><strong>{{ detail.materialName }}</strong
          ><small>{{ detail.materialCode }} · {{ detail.category.categoryName }}</small></div
        >
        <ArtDictDisplay dict-code="commonEnabledStatus" :value="detail.status" display="tag" />
      </div>
      <ElTabs v-model="activeDetailTab"
        ><ElTabPane name="section-0" label="基本信息"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionCard title="基本信息" subtitle="物料识别、分类与计量口径">
              <ArtDescriptions
                :data="detail"
                :items="basicItems"
                :columns="2"
              /> </ArtSectionCard></div
        ></ElTabPane>
        <ElTabPane name="section-1" label="扩展与图片"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionCard title="扩展信息" subtitle="品牌、材质、产地与业务说明">
              <ArtDescriptions :data="detail" :items="extendedItems" :columns="2" />
            </ArtSectionCard>
            <ArtSectionCard
              v-if="detail.imageUrls?.length"
              title="物料图片"
              :subtitle="`共 ${detail.imageUrls.length} 张`"
            >
              <div class="material-detail-drawer__gallery">
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
  import dayjs from 'dayjs'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { SmisMaterial } from '@smis/api'
  const activeDetailTab = ref('section-0')
  const drawerRef = ref<ArtDrawerExpose<SmisMaterial>>()
  const detail = shallowRef<SmisMaterial | null>(null)
  const basicItems: ArtDescriptionItem<SmisMaterial>[] = [
    { key: 'materialCode', label: '物料编码', field: 'materialCode', copyable: true },
    { key: 'materialName', label: '物料名称', field: 'materialName' },
    {
      key: 'category',
      label: '物料类别',
      value: (data: SmisMaterial) => `${data.category.categoryName} · ${data.category.categoryCode}`
    },
    {
      key: 'basicUnit',
      label: '基本单位',
      value: (data: SmisMaterial) => data.baseUnitName || data.basicUnit
    },
    {
      key: 'materialType',
      label: '物料类型',
      value: (data: SmisMaterial) => data.materialTypeName || data.materialType
    },
    {
      key: 'materialSource',
      label: '物料来源',
      field: 'materialSource',
      dictCode: 'mdmMaterialSource',
      dictDisplay: 'tag'
    },
    { key: 'specificationModel', label: '规格型号', field: 'specificationModel' },
    { key: 'drawingNo', label: '图号', field: 'drawingNo' }
  ]
  const extendedItems: ArtDescriptionItem<SmisMaterial>[] = [
    { key: 'brand', label: '品牌', field: 'brand' },
    { key: 'manufacturer', label: '制造商', field: 'manufacturer' },
    { key: 'materialComposition', label: '材质', field: 'materialComposition' },
    { key: 'placeOfOrigin', label: '产地', field: 'placeOfOrigin' },
    { key: 'color', label: '颜色', field: 'color' },
    { key: 'sort', label: '显示顺序', field: 'sort' },
    { key: 'description', label: '说明', field: 'description', span: 2 },
    {
      key: 'updateTime',
      label: '更新时间',
      value: (data: SmisMaterial) =>
        data.updateTime ? dayjs(data.updateTime).format('YYYY-MM-DD HH:mm:ss') : '—'
    },
    { key: 'updateBy', label: '更新人', field: 'updateBy' }
  ]
  const handleOpen = async (row: SmisMaterial): Promise<void> => {
    detail.value = row
    await drawerRef.value?.handleOpen(row, {
      title: '物料台账详情',
      subtitle: '查看物料主数据与维护信息',
      size: 'lg',
      showFooter: false,
      contentHeight: 'calc(100vh - 138px)'
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .material-detail-drawer {
    display: grid;
    gap: 16px;

    &__hero {
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 14px;
      background: color-mix(in srgb, var(--theme-color) 6%, var(--default-box-color));
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-base);
    }

    &__hero :deep(.el-image),
    &__hero > span {
      display: grid;
      place-items: center;
      width: 72px;
      height: 72px;
      color: var(--theme-color);
      background: var(--default-box-color);
      border-radius: var(--el-border-radius-base);
    }

    &__hero > div {
      display: grid;
      min-width: 0;
    }

    &__hero strong {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 18px;
      color: var(--el-text-color-primary);
      white-space: nowrap;
    }

    &__hero small {
      margin-top: 5px;
      color: var(--el-text-color-secondary);
    }

    &__gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 10px;
    }

    &__gallery :deep(.el-image) {
      width: 100%;
      height: 92px;
      border-radius: var(--el-border-radius-base);
    }

    @media (width <= 620px) {
      &__hero {
        grid-template-columns: 60px minmax(0, 1fr);
      }

      &__hero > .art-dict-display {
        grid-column: 1 / -1;
      }
    }
  }
</style>
