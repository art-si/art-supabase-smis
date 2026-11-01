<template>
  <ArtDrawer ref="drawerRef" :loading="state.loading" loading-text="正在加载防控措施…">
    <div v-if="item" class="measure-management-drawer">
      <section class="measure-management-drawer__context" aria-label="当前危险有害因素">
        <span class="measure-management-drawer__context-icon" aria-hidden="true">
          <ArtSvgIcon icon="ri:shield-check-line" />
        </span>
        <div class="measure-management-drawer__identity">
          <small>{{ riskPointName }} · {{ item.itemNo }}</small>
          <strong>{{ item.hazardFactor }}</strong>
          <span>{{ item.factorCategory?.categoryName || '未设置因素类别' }}</span>
        </div>
        <div class="measure-management-drawer__evaluation">
          <template v-if="item.evaluation">
            <span
              class="measure-management-drawer__score"
              :style="{ '--risk-level-color': item.evaluation.level?.color || undefined }"
            >
              {{ item.evaluation.methodCode }}
              <strong>{{ item.evaluation.dValue }}</strong>
            </span>
            <small>{{ item.evaluation.level?.levelName || '已完成评价' }}</small>
          </template>
          <ElTag v-else type="warning" effect="plain">待评价</ElTag>
        </div>
      </section>

      <div class="measure-management-drawer__summary" aria-label="防控措施概览">
        <div>
          <small>全部措施</small>
          <strong>{{ state.rows.length }}</strong>
        </div>
        <div>
          <small>有效措施</small>
          <strong>{{ enabledMeasures.length }}</strong>
        </div>
        <div>
          <small>责任岗位</small>
          <strong>{{ positionCount }}</strong>
        </div>
      </div>

      <ArtSectionCard
        class="measure-management-drawer__list-card"
        title="防控措施清单"
        subtitle="集中维护措施内容、管控层级、责任岗位与排查周期"
        :error="state.error"
        :empty="!state.loading && !state.rows.length"
        :empty-title="item.evaluation ? '暂无防控措施' : '请先完成定量风险评价'"
        :empty-description="
          item.evaluation
            ? '新增第一条防控措施，并配置对应责任岗位与排查周期。'
            : '完成 LEC 或 LS 评价后，才可维护该危险因素的防控措施。'
        "
        :empty-visual-size="72"
        :min-height="280"
        @retry="loadMeasures"
      >
        <template #actions>
          <div class="measure-management-drawer__toolbar">
            <ArtTooltip
              :disabled="Boolean(item.evaluation)"
              content="请先完成定量风险评价"
              placement="top"
            >
              <span>
                <ElButton
                  v-auth="'SmisDualControlRiskEvaluationControl:AddMeasure'"
                  type="primary"
                  :disabled="!item.evaluation"
                  @click="openMeasure()"
                >
                  <ArtSvgIcon icon="ri:add-line" />
                  新增措施
                </ElButton>
              </span>
            </ArtTooltip>
            <ArtTooltip
              :disabled="enabledMeasures.length > 0"
              content="当前没有可作废的有效措施"
              placement="top"
            >
              <span>
                <ElButton
                  v-auth="'SmisDualControlRiskEvaluationControl:VoidMeasure'"
                  :disabled="!enabledMeasures.length"
                  @click="voidEnabledMeasures"
                >
                  <ArtSvgIcon icon="ri:forbid-2-line" />
                  作废有效措施
                </ElButton>
              </span>
            </ArtTooltip>
          </div>
        </template>

        <ul v-if="state.rows.length" class="measure-management-drawer__measure-list">
          <li v-for="(row, index) in state.rows" :key="row.id" :data-status="row.status">
            <header>
              <span class="measure-management-drawer__measure-index">{{ index + 1 }}</span>
              <div class="measure-management-drawer__measure-title">
                <strong>{{ row.controlMeasure }}</strong>
                <div>
                  <ArtDictDisplay
                    dict-code="smisControlMeasureCategory"
                    :value="row.controlMeasureCategory"
                    display="tag"
                  />
                  <ArtDictDisplay
                    dict-code="smisControlLevel"
                    :value="row.controlLevel"
                    display="tag"
                  />
                  <ElTag :type="row.status === 'enabled' ? 'success' : 'info'" effect="plain">
                    {{ row.status === 'enabled' ? '有效' : '已作废' }}
                  </ElTag>
                </div>
              </div>
              <div class="measure-management-drawer__measure-actions">
                <ArtButtonTable
                  type="edit"
                  permission="SmisDualControlRiskEvaluationControl:EditMeasure"
                  label="编辑防控措施"
                  :disabled="row.status === 'voided'"
                  @click="openMeasure(row)"
                />
                <ArtButtonTable
                  type="delete"
                  permission="SmisDualControlRiskEvaluationControl:DeleteMeasure"
                  label="删除防控措施"
                  @click="deleteMeasure(row)"
                />
              </div>
            </header>

            <dl
              v-if="row.standardBasis || row.failureMode"
              class="measure-management-drawer__details"
            >
              <div v-if="row.standardBasis">
                <dt>标准依据</dt>
                <dd>{{ row.standardBasis }}</dd>
              </div>
              <div v-if="row.failureMode">
                <dt>失效模式</dt>
                <dd>{{ row.failureMode }}</dd>
              </div>
            </dl>

            <div class="measure-management-drawer__positions">
              <div class="measure-management-drawer__positions-heading">
                <span class="art-icon-label"
                  ><ArtSvgIcon icon="ri:briefcase-4-line" />责任岗位与周期</span
                >
                <small>{{ row.positions?.length || 0 }} 个岗位</small>
              </div>
              <div v-if="row.positions?.length" class="measure-management-drawer__position-grid">
                <div v-for="binding in row.positions" :key="binding.positionId">
                  <span class="measure-management-drawer__position-icon" aria-hidden="true">
                    <ArtSvgIcon icon="ri:user-star-line" />
                  </span>
                  <span>
                    <strong>{{ binding.position?.positionName || '岗位信息待同步' }}</strong>
                    <small>
                      每 {{ binding.frequencyCount }}
                      {{
                        userStore.getDictLabelByValue('smisFrequencyUnit', binding.frequencyUnit) ||
                        binding.frequencyUnit
                      }}排查
                    </small>
                  </span>
                </div>
              </div>
              <ArtEmptyState
                v-else
                title="暂未配置责任岗位"
                description="编辑该措施，补充责任岗位与排查周期。"
                size="compact"
                :visual-size="52"
              />
            </div>
          </li>
        </ul>
      </ArtSectionCard>

      <MeasureDialog ref="measureDialogRef" @success="handleMeasureSaved" />
    </div>
    <MasterDataDeleteGuard ref="deleteMeasureGuardRef" />
  </ArtDrawer>
</template>

<script setup lang="ts">
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'

  import { uniq } from 'lodash-es'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useUserStore } from '@/store/modules/user'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase/error'
  import {
    deleteRiskControlMeasures,
    fetchRiskControlMeasures,
    voidRiskControlMeasures,
    type SmisRiskControlMeasure,
    type SmisRiskItem
  } from '@smis/api'
  import MeasureDialog, { type MeasureDialogOpenData } from './measure-dialog.vue'

  const { deleteGuardRef: deleteMeasureGuardRef, deleteRecords: deleteMeasureRecords } =
    useRecordDeleteGuard('smis_risk_control_measure', '防控措施')

  export interface MeasureManagementDrawerExpose {
    handleOpen: (item: SmisRiskItem) => Promise<void>
  }

  interface MeasureDialogExpose {
    handleOpen: (data: MeasureDialogOpenData) => Promise<void>
  }

  const emit = defineEmits<{ success: [] }>()
  const drawerRef = ref<ArtDrawerExpose<SmisRiskItem>>()
  const measureDialogRef = ref<MeasureDialogExpose>()
  const item = shallowRef<SmisRiskItem>()
  const state = reactive({ rows: [] as SmisRiskControlMeasure[], loading: false, error: '' })
  const { confirmAction } = useArtFeedback()
  const userStore = useUserStore()

  const riskPointName = computed(
    () => item.value?.riskPointRecord?.pointName || item.value?.riskPoint || '风险点'
  )
  const enabledMeasures = computed(() => state.rows.filter((row) => row.status === 'enabled'))
  const positionCount = computed(
    () =>
      uniq(state.rows.flatMap((row) => row.positions.map((binding) => binding.positionId))).length
  )

  const loadMeasures = async (): Promise<void> => {
    if (!item.value) return
    state.loading = true
    state.error = ''
    try {
      const result = await fetchRiskControlMeasures(item.value.id)
      if (result.error) {
        state.rows = []
        state.error = getFriendlySupabaseErrorMessage(result.error, '防控措施加载失败，请稍后重试')
        return
      }
      state.rows = result.data ?? []
    } catch (error) {
      state.error = getFriendlySupabaseErrorMessage(error, '防控措施加载失败，请稍后重试')
    } finally {
      state.loading = false
    }
  }

  const openMeasure = (row?: SmisRiskControlMeasure): void => {
    if (!item.value?.evaluation) return
    void measureDialogRef.value?.handleOpen({ item: item.value, row })
  }

  const handleMeasureSaved = async (): Promise<void> => {
    await loadMeasures()
    emit('success')
  }

  const voidEnabledMeasures = async (): Promise<void> => {
    if (!enabledMeasures.value.length) return
    try {
      await confirmAction(
        `确定作废当前 ${enabledMeasures.value.length} 条有效防控措施吗？作废后将保留历史记录。`,
        '作废防控措施'
      )
    } catch {
      return
    }
    await voidRiskControlMeasures(enabledMeasures.value.map((row) => row.id))
    await loadMeasures()
    emit('success')
  }

  const deleteMeasure = async (row: SmisRiskControlMeasure): Promise<void> => {
    await deleteMeasureRecords({
      resources: [{ id: row.id ?? '', label: row.controlMeasure }],
      permission: 'SmisDualControlRiskEvaluationControl:DeleteMeasure',
      remove: () => deleteRiskControlMeasures([row.id ?? '']),
      onDeleted: async () => {
        await loadMeasures()
        emit('success')
      }
    })
  }

  const handleOpen = async (selectedItem: SmisRiskItem): Promise<void> => {
    item.value = selectedItem
    state.rows = []
    state.error = ''
    await drawerRef.value?.handleOpen(selectedItem, {
      title: '防控措施与责任岗位',
      subtitle: `${selectedItem.itemNo} · ${selectedItem.hazardFactor}`,
      size: 'xl',
      showFooter: false,
      contentHeight: 'calc(100vh - 120px)',
      drawerProps: { resizable: true },
      onOpen: loadMeasures
    })
  }

  defineExpose<MeasureManagementDrawerExpose>({ handleOpen })
</script>

<style scoped lang="scss">
  .measure-management-drawer {
    display: grid;
    gap: 16px;
    min-width: 0;
  }

  .measure-management-drawer__context {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
    padding: 16px;
    background: color-mix(in srgb, var(--theme-color) 6%, var(--default-box-color));
    border-left: 3px solid var(--theme-color);
    border-radius: var(--el-border-radius-base);
  }

  .measure-management-drawer__context-icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    font-size: 23px;
    color: var(--theme-color);
    background: var(--default-box-color);
    border-radius: var(--el-border-radius-base);
  }

  .measure-management-drawer__identity {
    min-width: 0;
  }

  .measure-management-drawer__identity small,
  .measure-management-drawer__identity strong,
  .measure-management-drawer__identity span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .measure-management-drawer__identity small,
  .measure-management-drawer__identity span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .measure-management-drawer__identity strong {
    margin: 3px 0;
    font-size: 16px;
    color: var(--el-text-color-primary);
  }

  .measure-management-drawer__evaluation {
    display: grid;
    gap: 5px;
    justify-items: end;
  }

  .measure-management-drawer__evaluation > small {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .measure-management-drawer__score {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 700;
    color: var(--risk-level-color, var(--theme-color));
    background: color-mix(
      in srgb,
      var(--risk-level-color, var(--theme-color)) 9%,
      var(--default-box-color)
    );
    border-radius: var(--el-border-radius-base);
  }

  .measure-management-drawer__score strong {
    font-size: 18px;
    font-variant-numeric: tabular-nums;
  }

  .measure-management-drawer__summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    overflow: hidden;
    background: var(--default-box-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
  }

  .measure-management-drawer__summary > div {
    display: flex;
    gap: 10px;
    align-items: baseline;
    justify-content: center;
    min-width: 0;
    padding: 12px 16px;
  }

  .measure-management-drawer__summary > div + div {
    border-left: 1px solid var(--el-border-color-lighter);
  }

  .measure-management-drawer__summary small {
    color: var(--el-text-color-secondary);
  }

  .measure-management-drawer__summary strong {
    font-size: 20px;
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-primary);
  }

  .measure-management-drawer__toolbar,
  .measure-management-drawer__measure-actions,
  .measure-management-drawer__measure-title > div {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .measure-management-drawer__toolbar :deep(.el-button) {
    margin-left: 0;
  }

  .measure-management-drawer__measure-list {
    display: grid;
    gap: 10px;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .measure-management-drawer__measure-list > li {
    display: grid;
    gap: 14px;
    padding: 15px;
    background: var(--el-fill-color-extra-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
  }

  .measure-management-drawer__measure-list > li[data-status='voided'] {
    opacity: 0.76;
  }

  .measure-management-drawer__measure-list header {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: start;
  }

  .measure-management-drawer__measure-index {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    font-size: 12px;
    font-weight: 700;
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
    border-radius: var(--el-border-radius-small);
  }

  .measure-management-drawer__measure-title {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .measure-management-drawer__measure-title > strong {
    line-height: 1.6;
    color: var(--el-text-color-primary);
  }

  .measure-management-drawer__details {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
  }

  .measure-management-drawer__details > div {
    padding: 10px 12px;
    background: var(--default-box-color);
    border-radius: var(--el-border-radius-small);
  }

  .measure-management-drawer__details dt,
  .measure-management-drawer__details dd {
    margin: 0;
  }

  .measure-management-drawer__details dt {
    margin-bottom: 4px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .measure-management-drawer__details dd {
    line-height: 1.6;
    color: var(--el-text-color-regular);
  }

  .measure-management-drawer__positions {
    display: grid;
    gap: 9px;
    padding-top: 12px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .measure-management-drawer__positions-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .measure-management-drawer__positions-heading > span {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    font-size: 12px;
    font-weight: 650;
    color: var(--el-text-color-primary);
  }

  .measure-management-drawer__positions-heading > small {
    margin: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .measure-management-drawer__position-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .measure-management-drawer__position-grid > div {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 9px;
    align-items: center;
    min-width: 0;
    padding: 9px 10px;
    background: var(--default-box-color);
    border-radius: var(--el-border-radius-small);
  }

  .measure-management-drawer__position-icon {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
    border-radius: var(--el-border-radius-small);
  }

  .measure-management-drawer__position-grid strong,
  .measure-management-drawer__position-grid small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .measure-management-drawer__position-grid small {
    margin-top: 2px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  @media (width <= 720px) {
    .measure-management-drawer__context {
      grid-template-columns: 42px minmax(0, 1fr);
    }

    .measure-management-drawer__context-icon {
      width: 42px;
      height: 42px;
    }

    .measure-management-drawer__evaluation {
      grid-column: 1 / -1;
      justify-items: start;
    }

    .measure-management-drawer__summary,
    .measure-management-drawer__details,
    .measure-management-drawer__position-grid {
      grid-template-columns: 1fr;
    }

    .measure-management-drawer__summary > div + div {
      border-top: 1px solid var(--el-border-color-lighter);
      border-left: 0;
    }

    .measure-management-drawer__measure-list header {
      grid-template-columns: 32px minmax(0, 1fr);
    }

    .measure-management-drawer__measure-actions {
      grid-column: 2;
    }
  }
</style>
