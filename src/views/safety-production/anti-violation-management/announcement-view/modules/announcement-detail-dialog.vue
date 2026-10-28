<template>
  <ArtDialog ref="dialogRef" size="xl">
    <article v-if="announcement" class="announcement-detail-dialog">
      <header class="announcement-detail-dialog__header">
        <div class="announcement-detail-dialog__status">
          <ArtDictDisplay
            dict-code="smisAnnouncementStatus"
            :value="announcement.displayStatus"
            display="tag"
          />
          <ElTag v-if="announcement.isPinned" effect="plain" type="warning">置顶</ElTag>
          <ElTag effect="plain">{{ announcement.categoryName }}</ElTag>
        </div>
        <h1>{{ announcement.title }}</h1>
        <p>
          <span>{{ announcement.createByName }}</span>
          <span v-if="announcement.createOrganizationName">{{
            announcement.createOrganizationName
          }}</span>
          <span>{{
            dayjs(announcement.publishedAt || announcement.createTime).format('YYYY-MM-DD HH:mm')
          }}</span>
          <span>{{ audienceLabel }}</span>
        </p>
      </header>

      <ElScrollbar class="announcement-detail-dialog__content-scroll">
        <div class="announcement-detail-dialog__content" v-html="safeContent" />
      </ElScrollbar>

      <section
        v-if="announcement.attachmentUrls.length"
        class="announcement-detail-dialog__attachments"
      >
        <ArtSectionTitle title="相关附件" subtitle="附件将在新窗口打开" />
        <div class="announcement-detail-dialog__attachment-list">
          <a
            v-for="(url, index) in announcement.attachmentUrls"
            :key="url"
            :href="safeAttachmentUrl(url)"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ArtSvgIcon icon="ri:attachment-2" />
            <span>{{ getAttachmentNameFromUrl(url, `公告附件 ${index + 1}`) }}</span>
            <ArtSvgIcon icon="ri:external-link-line" />
          </a>
        </div>
      </section>
    </article>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { resolveHttpUrl } from '@/utils/http-url'
  import { getAttachmentNameFromUrl } from '@/utils/file/attachment'
  import DOMPurify from 'dompurify'
  import dayjs from 'dayjs'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import { markAnnouncementRead, type SmisAnnouncement } from '@smis/api'

  const emit = defineEmits<{ read: [id: string] }>()
  const dialogRef = ref<ArtDialogExpose<SmisAnnouncement>>()
  const announcement = shallowRef<SmisAnnouncement>()
  const safeContent = computed(() => DOMPurify.sanitize(announcement.value?.contentHtml || ''))
  const audienceLabel = computed(() => {
    if (!announcement.value) return ''
    if (announcement.value.audienceType === 'all') return '所有人员'
    if (announcement.value.audienceType === 'employees')
      return `指定人员 ${announcement.value.audienceEmployees.length} 人`
    return `指定组织 ${announcement.value.audienceOrganizations.length} 个`
  })
  const safeAttachmentUrl = (value: string): string =>
    resolveHttpUrl(value, window.location.origin) ?? '#'
  const handleOpen = async (row: SmisAnnouncement): Promise<void> => {
    announcement.value = row
    await dialogRef.value?.handleOpen(row, {
      title: '公告详情',
      showFooter: false,
      contentMaxHeight: 'calc(100vh - 132px)',
      onOpen: async (_data, api) => {
        if (row.lifecycleStatus !== 'published' || row.myRead) return
        api.setLoading(true)
        try {
          await markAnnouncementRead(row.id)
          emit('read', row.id)
        } finally {
          api.setLoading(false)
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .announcement-detail-dialog {
    width: min(920px, 100%);
    margin: 0 auto;
    color: var(--el-text-color-primary);

    &__header {
      padding: 8px 4px 24px;
      text-align: center;
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    &__status {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }

    h1 {
      margin: 18px 0 12px;
      font-size: clamp(24px, 3vw, 34px);
      line-height: 1.3;
      letter-spacing: 0.02em;
    }

    header p {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 18px;
      justify-content: center;
      margin: 0;
      color: var(--el-text-color-secondary);
    }

    &__content {
      min-height: 280px;
      padding: 30px 12px;
      font-size: 15px;
      line-height: 1.9;
      overflow-wrap: anywhere;
    }

    &__content :deep(img) {
      max-width: 100%;
      height: auto;
    }

    &__content :deep(table) {
      width: max-content;
      max-width: none;
      border-collapse: collapse;
    }

    &__content :deep(th),
    &__content :deep(td) {
      padding: 8px 10px;
      border: 1px solid var(--el-border-color);
    }

    &__attachments {
      padding: 20px 12px 4px;
      border-top: 1px solid var(--el-border-color-lighter);
    }

    &__attachment-list {
      display: grid;
      gap: 8px;
      margin-top: 14px;
    }

    &__attachment-list a {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      min-height: 44px;
      padding: 8px 12px;
      color: var(--el-text-color-regular);
      background: var(--art-gray-100);
      border-radius: var(--el-border-radius-base);
      transition:
        color var(--art-duration-fast),
        background-color var(--art-duration-fast);
    }

    &__attachment-list a:hover,
    &__attachment-list a:focus-visible {
      color: var(--theme-color);
      outline: 2px solid color-mix(in srgb, var(--theme-color) 45%, transparent);
      outline-offset: 2px;
      background: color-mix(in srgb, var(--theme-color) 8%, var(--default-box-color));
    }

    &__attachment-list span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
</style>
