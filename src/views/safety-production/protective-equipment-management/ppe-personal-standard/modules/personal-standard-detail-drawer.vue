<template>
  <ArtDrawer
    :loading="loading"
    ref="drawerRef"
    size="lg"
    :show-footer="false"
    content-height="calc(100vh - 126px)"
  >
    <div v-if="employee" class="ppe-detail">
      <section class="ppe-detail__identity" aria-label="员工个人标准概览">
        <ElAvatar
          :size="52"
          :src="employee.avatarUrl || undefined"
          :alt="`${employee.employeeName}的头像`"
        >
          {{ employee.employeeName.trim().slice(0, 1) || '员' }}
        </ElAvatar>
        <div class="ppe-detail__person">
          <strong>{{ employee.employeeName }}</strong>
          <span translate="no">{{ employee.employeeNo }}</span>
          <small
            >{{ employee.organizationName || '未分配组织' }} ·
            {{ employee.positionName || '未配置岗位' }}</small
          >
        </div>
        <div class="ppe-detail__summary">
          <span>
            <small>生成状态</small>
            <ElTag :type="employee.personalStandardId ? 'success' : 'warning'" effect="light">
              {{ employee.personalStandardId ? '已生成' : '待生成' }}
            </ElTag>
          </span>
          <span
            ><small>用品定额</small><strong>{{ items.length }} 项</strong></span
          >
          <span
            ><small>最近生成</small><strong>{{ generatedAtLabel }}</strong></span
          >
        </div>
      </section>

      <ArtSectionCard
        class="ppe-detail__items"
        title="个人防护用品明细"
        subtitle="展示定额、发放周期、领用节点及来源标准。"
        :error="error"
        :empty="!loading && !error && !items.length"
        :empty-title="employee.personalStandardId ? '暂无用品明细' : '尚未生成个人标准'"
        :empty-description="
          employee.personalStandardId
            ? '当前个人标准中没有可用的防护用品定额。'
            : '返回员工列表，点击“生成个人标准”后再查看明细。'
        "
        :min-height="280"
        @retry="loadItems"
      >
        <template #actions>
          <ElTag type="primary" effect="plain">{{ items.length }} 项用品</ElTag>
        </template>

        <div class="ppe-detail__list">
          <article v-for="item in items" :key="item.id" class="ppe-detail__item">
            <div class="ppe-detail__material">
              <ElImage
                v-if="item.imageUrls?.[0]"
                class="ppe-detail__image"
                :src="item.imageUrls[0]"
                :preview-src-list="item.imageUrls"
                :alt="`${item.materialName}图片`"
                fit="cover"
                preview-teleported
              />
              <span v-else class="ppe-detail__image is-empty" aria-hidden="true">
                <ArtSvgIcon icon="ri:image-line" />
              </span>
              <div>
                <strong :title="item.materialName">{{ item.materialName }}</strong>
                <small :title="item.materialCode" translate="no">{{ item.materialCode }}</small>
                <span>{{ item.categoryName }} · {{ item.specificationModel || '无规格型号' }}</span>
              </div>
            </div>

            <dl class="ppe-detail__facts">
              <div>
                <dt>定额数量</dt>
                <dd>
                  <strong>{{ item.quotaQuantity }}</strong>
                  <ArtDictDisplay
                    dict-code="smisMaterialUnit"
                    :value="item.basicUnit"
                    display="text"
                  />
                </dd>
              </div>
              <div>
                <dt>发放规则</dt>
                <dd>
                  <ArtDictDisplay
                    dict-code="commonIssuanceCycle"
                    :value="item.issuanceCycle"
                    display="text"
                  />
                  <span> · {{ item.issuanceFrequency }} 次</span>
                </dd>
              </div>
              <div>
                <dt>首次 / 下次领用</dt>
                <dd
                  >{{ item.initialIssueDate || '待设置' }} /
                  {{ item.nextIssueDate || '待计算' }}</dd
                >
              </div>
              <div>
                <dt>来源标准</dt>
                <dd :title="`${item.sourceStandardName} · ${item.sourceStandardNo}`">
                  {{ item.sourceStandardName }}
                  <small translate="no">{{ item.sourceStandardNo }}</small>
                </dd>
              </div>
            </dl>

            <ArtDictDisplay
              class="ppe-detail__status"
              dict-code="commonEnabledStatus"
              :value="item.status"
              display="tag"
            />
          </article>
        </div>
      </ArtSectionCard>
    </div>
  </ArtDrawer>
</template>

<script setup lang="ts">
  import dayjs from 'dayjs'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase/error'
  import {
    fetchPpePersonalStandardItems,
    type SmisPpePersonalStandard,
    type SmisPpePersonalStandardItem
  } from '@smis/api'

  const drawerRef = ref<ArtDrawerExpose<SmisPpePersonalStandard>>()
  const employee = ref<SmisPpePersonalStandard>()
  const items = ref<SmisPpePersonalStandardItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const generatedAtLabel = computed(() =>
    employee.value?.generatedAt ? dayjs(employee.value.generatedAt).format('YYYY-MM-DD HH:mm') : '—'
  )

  const loadItems = async (): Promise<void> => {
    if (!employee.value) return
    loading.value = true
    error.value = null
    try {
      const result = await fetchPpePersonalStandardItems(employee.value.employeeId)
      if (result.error) throw result.error
      items.value = result.data ?? []
    } catch (reason) {
      items.value = []
      error.value = getFriendlySupabaseErrorMessage(reason, '个人防护用品明细加载失败，请稍后重试')
    } finally {
      loading.value = false
    }
  }
  const handleOpen = async (row: SmisPpePersonalStandard): Promise<void> => {
    employee.value = row
    items.value = []
    error.value = null
    await drawerRef.value?.handleOpen(row, {
      title: '个人防护用品明细',
      subtitle: `${row.employeeName} · ${row.employeeNo}`,
      showFooter: false,
      onOpen: loadItems
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  @use '../../../shared/personal-standard-detail' as detail;

  @include detail.personal-standard-detail('.ppe-detail');
</style>
