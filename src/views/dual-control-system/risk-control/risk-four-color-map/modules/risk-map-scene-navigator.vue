<template>
  <ArtSectionCard
    class="risk-map-scene-navigator"
    title="场景层级"
    :subtitle="`共 ${rows.length} 个场景`"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && !rows.length"
    empty-title="暂无四色图场景"
    empty-description="先创建全厂风险图，再按车间、作业区逐级补充场景。"
    :min-height="360"
    @retry="emit('refresh')"
  >
    <template #actions>
      <ArtTreeExpandToggle
        :tree="treeRef"
        :data="treeData"
        label="场景树"
        :default-expanded="true"
      />
      <ArtIconButton
        icon="ri:refresh-line"
        label="刷新四色图场景"
        :loading="loading"
        @click="emit('refresh')"
      />
    </template>
    <template #empty-action>
      <ElButton
        v-auth="'SmisDualControlRiskFourColorMap:AddScene'"
        type="primary"
        @click="emit('add-root')"
      >
        创建首个场景
      </ElButton>
    </template>

    <template #toolbar>
      <ElInput
        :model-value="keyword"
        class="risk-map-scene-navigator__search"
        clearable
        placeholder="搜索场景名称"
        aria-label="搜索四色图场景"
        @update:model-value="emit('update:keyword', $event)"
      >
        <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
      </ElInput>
    </template>
    <ElTree
      ref="treeRef"
      :data="treeData"
      node-key="id"
      :props="treeProps"
      :expand-on-click-node="false"
      default-expand-all
      highlight-current
      :current-node-key="selectedId"
      @node-click="emit('select', $event)"
    >
      <template #default="{ data }">
        <div class="risk-map-scene-navigator__node" :title="data.sceneName">
          <span><ArtSvgIcon icon="ri:map-pin-range-line" /></span>
          <div class="risk-map-scene-navigator__node-copy">
            <strong>{{ data.sceneName }}</strong>
            <small>{{ data.shapes?.length || 0 }} 个图形</small>
          </div>
          <div class="risk-map-scene-navigator__node-actions" @click.stop>
            <ArtIconButton
              icon="ri:add-line"
              label="新增下级场景"
              permission="SmisDualControlRiskFourColorMap:AddScene"
              @click="emit('add-child', data)"
            />
            <ArtIconButton
              icon="ri:edit-line"
              label="编辑场景"
              permission="SmisDualControlRiskFourColorMap:EditScene"
              @click="emit('edit', data)"
            />
            <ArtIconButton
              icon="ri:delete-bin-line"
              label="删除场景"
              tone="danger"
              permission="SmisDualControlRiskFourColorMap:DeleteScene"
              @click="emit('delete', data)"
            />
          </div>
        </div>
      </template>
      <template #empty>
        <ArtEmptyState
          :title="keyword ? '暂无匹配场景' : '暂无可显示内容'"
          :description="keyword ? '请更换关键词或清空搜索条件。' : '请稍后刷新。'"
          size="compact"
          :visual-size="64"
        />
      </template>
    </ElTree>
  </ArtSectionCard>
</template>

<script setup lang="ts">
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import type { ElTree } from 'element-plus'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { SmisRiskMapScene } from '@smis/api'

  defineOptions({ name: 'SmisRiskMapSceneNavigator' })

  defineProps<{
    rows: SmisRiskMapScene[]
    treeData: SmisRiskMapScene[]
    selectedId: string
    keyword: string
    loading: boolean
    error: string | null
  }>()

  const emit = defineEmits<{
    'update:keyword': [value: string]
    refresh: []
    select: [scene: SmisRiskMapScene]
    'add-root': []
    'add-child': [scene: SmisRiskMapScene]
    edit: [scene: SmisRiskMapScene]
    delete: [scene: SmisRiskMapScene]
  }>()

  const treeRef = ref<InstanceType<typeof ElTree>>()
  const treeProps = { label: 'sceneName', children: 'children' }
</script>

<style scoped lang="scss">
  .risk-map-scene-navigator {
    display: flex;
    flex-direction: column;

    &__search {
      margin-bottom: var(--art-space-3);
    }

    &__node {
      display: flex;
      gap: var(--art-space-2);
      align-items: center;
      width: 100%;
      min-width: 0;

      > span {
        display: grid;
        flex: none;
        place-items: center;
        width: 28px;
        height: 28px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 9%, var(--el-fill-color-blank));
        border-radius: var(--el-border-radius-small);
      }

      &-copy {
        display: grid;
        flex: 1 1 auto;
        min-width: 0;
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      &-actions {
        display: none;
        flex: none;
        align-items: center;
        margin-left: auto;

        :deep(.art-icon-button) {
          width: 28px;
          height: 28px;
          font-size: 16px;
        }
      }
    }

    &__node:hover &__node-actions,
    &__node:focus-within &__node-actions,
    :deep(.is-current > .el-tree-node__content) &__node-actions {
      display: flex;
    }

    :deep(.art-section-card__body),
    :deep(.art-async-state) {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
    }

    :deep(.el-tree-node__content) {
      min-height: 42px;
      margin-block: 2px;
      border-radius: var(--el-border-radius-small);
    }
  }
</style>
