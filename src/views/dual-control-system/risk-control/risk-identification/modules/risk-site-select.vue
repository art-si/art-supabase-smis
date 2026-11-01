<template>
  <div class="risk-site-select">
    <button
      type="button"
      class="risk-site-select__trigger"
      :class="{ 'is-selected': selectedSite }"
      aria-haspopup="dialog"
      @click="openSelector"
    >
      <span class="risk-site-select__trigger-icon" aria-hidden="true">
        <ArtSvgIcon icon="ri:map-pin-range-line" />
      </span>
      <span class="risk-site-select__trigger-copy">
        <strong>{{ selectedSite?.siteName || '选择风险点场所' }}</strong>
        <small v-if="selectedSite">
          {{ selectedSite.organizationName || '所属组织未维护' }} ·
          {{ categoryLabel(selectedSite.categoryCode) }}
        </small>
        <small v-else>从场所主数据中选择，保存后可随时调整</small>
      </span>
      <span class="risk-site-select__trigger-action">
        {{ selectedSite ? '重新选择' : '选择场所' }}
        <ArtSvgIcon icon="ri:arrow-right-s-line" />
      </span>
    </button>

    <ArtDialog ref="dialogRef" size="lg">
      <div class="risk-site-select__dialog">
        <ElInput
          v-model="keyword"
          clearable
          autofocus
          placeholder="搜索场所名称或所属组织"
          aria-label="搜索场所名称或所属组织"
        >
          <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
        </ElInput>

        <ArtSectionCard
          class="risk-site-select__panel"
          title="可选场所"
          :subtitle="`共 ${filteredSites.length} 个符合条件的场所`"
          :empty="!filteredSites.length"
          empty-title="暂无匹配场所"
          empty-description="请调整搜索条件，或先在场所维护中补充场所主数据。"
          :min-height="320"
        >
          <template #empty-action><SmisDataSourceEmptyActions source="site" /></template>

          <ul class="risk-site-select__list" aria-label="可选场所列表">
            <li v-for="site in filteredSites" :key="site.id">
              <button
                type="button"
                class="risk-site-select__option"
                :class="{ 'is-selected': draftValue === site.id }"
                :aria-pressed="draftValue === site.id"
                @click="draftValue = site.id"
              >
                <span class="risk-site-select__option-marker" aria-hidden="true">
                  <ArtSvgIcon
                    :icon="draftValue === site.id ? 'ri:check-line' : 'ri:map-pin-line'"
                  />
                </span>
                <span class="risk-site-select__option-copy">
                  <strong>{{ site.siteName }}</strong>
                  <small>{{ site.organizationName || '所属组织未维护' }}</small>
                </span>
                <ArtDictDisplay
                  dict-code="smisSiteCategory"
                  :value="site.categoryCode"
                  display="tag"
                />
              </button>
            </li>
          </ul>
        </ArtSectionCard>
      </div>
    </ArtDialog>
  </div>
</template>

<script setup lang="ts">
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import SmisDataSourceEmptyActions from '@smis/views/components/smis-data-source-empty-actions.vue'
  import type { SmisRiskIdentificationSite } from '@smis/api'

  const props = withDefaults(
    defineProps<{ modelValue?: string; sites?: SmisRiskIdentificationSite[] }>(),
    { modelValue: undefined, sites: () => [] }
  )
  const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>()
  const dialogRef = ref<ArtDialogExpose>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const keyword = ref('')
  const draftValue = ref<string>()
  const selectedSite = computed(() => props.sites.find((site) => site.id === props.modelValue))
  const categoryMap = computed(
    () =>
      new Map(
        (getDictMap.value.smisSiteCategory ?? []).map((item) => [
          String(item.value),
          item.label || item.name
        ])
      )
  )
  const filteredSites = computed(() => {
    const normalized = keyword.value.trim().toLocaleLowerCase()
    if (!normalized) return props.sites
    return props.sites.filter((site) =>
      [site.siteName, site.organizationName]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(normalized))
    )
  })

  const categoryLabel = (value: string): string => categoryMap.value.get(value) || '其他'
  const confirmSelection = (): boolean => {
    if (!draftValue.value) {
      ElMessage.warning('请选择一个场所')
      return false
    }
    emit('update:modelValue', draftValue.value)
    return true
  }
  const openSelector = async (): Promise<void> => {
    keyword.value = ''
    draftValue.value = props.modelValue
    await dialogRef.value?.handleOpen(undefined, {
      title: '选择风险点场所',
      subtitle: '场所名称、所属组织与分类信息来自场所主数据',
      confirmText: '确认选择',
      contentMaxHeight: 'min(620px, calc(100vh - 180px))',
      loading: true,
      loadingText: '正在加载场所分类…',
      onOpen: async (_data, api) => {
        try {
          await userStore.ensureDictLoaded('smisSiteCategory')
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: confirmSelection
    })
  }

  onMounted(() => void userStore.ensureDictLoaded('smisSiteCategory'))
</script>

<style scoped lang="scss">
  .risk-site-select {
    width: 100%;

    &__trigger {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr) auto;
      gap: var(--art-space-3);
      align-items: center;
      width: 100%;
      min-height: 56px;
      padding: var(--art-space-2) var(--art-space-3);
      font: inherit;
      color: var(--el-text-color-regular);
      text-align: left;
      cursor: pointer;
      background: var(--el-fill-color-blank);
      border: 1px solid var(--el-border-color);
      border-radius: var(--el-border-radius-base);
      transition:
        border-color var(--art-motion-duration-fast) ease,
        box-shadow var(--art-motion-duration-fast) ease,
        background-color var(--art-motion-duration-fast) ease;

      &:hover,
      &:focus-visible,
      &.is-selected {
        outline: none;
        border-color: color-mix(in srgb, var(--theme-color) 58%, var(--el-border-color));
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-color) 9%, transparent);
      }
    }

    &__trigger-icon,
    &__option-marker {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 9%, var(--el-fill-color-blank));
      border-radius: var(--el-border-radius-base);
    }

    &__trigger-copy,
    &__option-copy {
      display: grid;
      gap: 2px;
      min-width: 0;

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        font-size: var(--art-font-size-caption);
        color: var(--el-text-color-secondary);
      }
    }

    &__trigger-action {
      display: inline-flex;
      gap: var(--art-space-1);
      align-items: center;
      font-size: var(--art-font-size-caption);
      color: var(--theme-color);
    }

    &__dialog {
      display: grid;
      gap: var(--art-space-4);
      min-width: 0;
    }

    &__panel :deep(.art-section-card__scrollbar) {
      flex: none;
      height: min(420px, calc(100vh - 330px));
    }

    &__list {
      display: grid;
      gap: var(--art-space-2);
      padding: 0;
      margin: 0;
      list-style: none;
    }

    &__option {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr) auto;
      gap: var(--art-space-3);
      align-items: center;
      width: 100%;
      min-height: 64px;
      padding: var(--art-space-3);
      font: inherit;
      color: var(--el-text-color-primary);
      text-align: left;
      cursor: pointer;
      background: var(--el-fill-color-blank);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
      transition:
        border-color var(--art-motion-duration-fast) ease,
        background-color var(--art-motion-duration-fast) ease,
        box-shadow var(--art-motion-duration-fast) ease;

      &:hover,
      &:focus-visible {
        outline: none;
        border-color: color-mix(in srgb, var(--theme-color) 42%, var(--el-border-color));
        box-shadow: var(--art-themed-action-hover-shadow);
      }

      &.is-selected {
        background: color-mix(in srgb, var(--theme-color) 7%, var(--el-fill-color-blank));
        border-color: color-mix(in srgb, var(--theme-color) 64%, var(--el-border-color));
      }
    }
  }

  @media (width <= 640px) {
    .risk-site-select {
      &__trigger-action {
        display: none;
      }

      &__trigger,
      &__option {
        grid-template-columns: 36px minmax(0, 1fr);
      }

      &__option :deep(.el-tag) {
        grid-column: 2;
        justify-self: start;
      }
    }
  }
</style>
