<template>
  <ArtDialog
    @open="
      () => {
        activeFormTab = 'measureSection'
      }
    "
    ref="dialogRef"
    size="xl"
  >
    <div class="measure-dialog">
      <div class="measure-dialog__flow"
        ><span class="is-done"><ArtSvgIcon icon="ri:checkbox-circle-line" />已完成定量评价</span
        ><i></i
        ><span class="is-current"
          ><ArtSvgIcon icon="ri:shield-check-line" />维护防控措施与岗位周期</span
        ></div
      >
      <ArtForm
        v-model:active-tab="activeFormTab"
        ref="formRef"
        v-model="model"
        :items="items"
        :rules="rules"
        :span="12"
        :gutter="20"
        label-position="top"
        ><template #positions>
          <div class="measure-dialog__positions">
            <div class="measure-dialog__positions-head"
              ><div
                ><strong>防控岗位与排查周期</strong
                ><p>一条措施可关联多个岗位，每个岗位独立配置此措施的排查频次。</p></div
              ><ElSelect
                v-model="selectedPositionIds"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="选择一个或多个防控岗位"
                ><ElOption
                  v-for="position in positions"
                  :key="position.id"
                  :label="`${position.positionName}（${position.positionCode}）`"
                  :value="position.id"
                  ><span>{{ position.positionName }}</span
                  ><small>{{ position.organizationName || position.positionCode }}</small></ElOption
                ></ElSelect
              ></div
            >
            <ArtTable
              v-if="model.positions.length"
              ref="positionTableRef"
              :data="model.positions"
              :columns="positionColumns"
              row-key="positionId"
              :pagination="false"
              max-height="320"
            />
            <ArtEmptyState
              v-else
              class="measure-dialog__position-empty"
              title="尚未选择防控岗位"
              description="从上方选择岗位后，可分别配置对应的排查频次。"
              size="compact"
              :visual-size="64"
            />
          </div> </template
      ></ArtForm>
    </div>
  </ArtDialog>
</template>
<script setup lang="tsx">
  import { toDictionaryOption } from '@/utils/form/option'

  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import { ElInputNumber, ElSelect, ElOption, ElMessage, type FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtTable, { type ArtTableExpose } from '@/components/core/tables/art-table/index.vue'
  import type { ColumnOption } from '@/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchRiskPositionOptions,
    saveRiskControlMeasure,
    type SmisRiskControlMeasure,
    type SmisRiskControlMeasurePayload,
    type SmisRiskItem,
    type SmisRiskPositionOption
  } from '@smis/api'
  export interface MeasureDialogOpenData {
    item: SmisRiskItem
    row?: SmisRiskControlMeasure
  }
  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<MeasureDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const activeFormTab = ref('measureSection')
  type PositionBinding = SmisRiskControlMeasurePayload['positions'][number]
  const positionTableRef = ref<ArtTableExpose<PositionBinding>>()
  const positions = ref<SmisRiskPositionOption[]>([])
  const selectedPositionIds = ref<string[]>([])
  const initial = (): SmisRiskControlMeasurePayload => ({
    id: undefined,
    riskItemId: '',
    controlMeasure: '',
    controlMeasureCategory: '',
    controlLevel: '',
    standardBasis: '',
    failureMode: '',
    hazardLevel: '',
    sort: 10,
    positions: []
  })
  const model = ref(initial())
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const categoryOptions = computed(() => dictOptions('smisControlMeasureCategory'))
  const controlLevelOptions = computed(() => dictOptions('smisControlLevel'))
  const hazardLevelOptions = computed(() => dictOptions('smisHazardLevel'))
  const frequencyOptions = computed(() => dictOptions('smisFrequencyUnit'))
  const items = computed<FormItem[]>(() => [
    { key: 'measureSection', label: '防控措施', type: 'tab' },
    {
      label: '防控措施',
      key: 'controlMeasure',
      type: 'input',
      span: 24,
      props: {
        type: 'textarea',
        rows: 4,
        maxlength: 1000,
        showWordLimit: true,
        resize: 'none',
        placeholder: '描述可执行、可检查的工程、管理或个体防护措施'
      }
    },
    {
      label: '措施类别',
      key: 'controlMeasureCategory',
      type: 'select',
      options: categoryOptions.value,
      props: { clearable: false, placeholder: '请选择措施类别' }
    },
    {
      label: '管控层级',
      key: 'controlLevel',
      type: 'select',
      options: controlLevelOptions.value,
      props: { clearable: false, placeholder: '请选择管控层级' }
    },
    {
      label: '隐患等级',
      key: 'hazardLevel',
      type: 'select',
      options: hazardLevelOptions.value,
      props: { clearable: false, placeholder: '请选择隐患等级' }
    },
    {
      label: '排序',
      key: 'sort',
      type: 'number',
      props: { min: 0, max: 9999, controlsPosition: 'right' }
    },
    {
      label: '标准依据',
      key: 'standardBasis',
      type: 'input',
      span: 24,
      props: { maxlength: 500, clearable: true, placeholder: '法规、标准或制度条款（可选）' }
    },
    {
      label: '失效模式',
      key: 'failureMode',
      type: 'input',
      span: 24,
      props: { maxlength: 500, clearable: true, placeholder: '措施未执行时的可能失效表现（可选）' }
    },
    { key: 'positionSection', label: '岗位与周期', type: 'tab' },
    { key: 'positions', label: '', type: 'slot', span: 24 }
  ])
  const rules: FormRules = {
    controlMeasure: [{ required: true, message: '请输入防控措施', trigger: 'blur' }],
    controlMeasureCategory: [{ required: true, message: '请选择措施类别', trigger: 'change' }],
    controlLevel: [{ required: true, message: '请选择管控层级', trigger: 'change' }],
    hazardLevel: [{ required: true, message: '请选择隐患等级', trigger: 'change' }]
  }
  const positionOf = (id: string) => positions.value.find((i) => i.id === id)
  const removePosition = (id: string) => {
    selectedPositionIds.value = selectedPositionIds.value.filter((i) => i !== id)
  }
  watch(
    selectedPositionIds,
    (ids) => {
      const existing = new Map(model.value.positions.map((i) => [i.positionId, i]))
      model.value.positions = ids.map(
        (id) => existing.get(id) || { positionId: id, frequencyCount: 1, frequencyUnit: 'day' }
      )
    },
    { deep: true }
  )

  const positionColumns = computed<ColumnOption<PositionBinding>[]>(() => [
    {
      prop: 'positionId',
      label: '防控岗位',
      minWidth: 220,
      formatter: (row) => (
        <div class="grid gap-1">
          <strong>{positionOf(row.positionId)?.positionName || '—'}</strong>
          <small class="text-g-700">{positionOf(row.positionId)?.positionCode || '—'}</small>
        </div>
      )
    },
    {
      prop: 'frequencyCount',
      label: '排查频次',
      width: 160,
      required: true,
      headerTooltip: '每个岗位分别设置排查周期，频次至少为 1。',
      rules: { validator: ({ value }) => Number(value) >= 1, message: '排查频次至少为 1' },
      formatter: (row) => (
        <ElInputNumber
          v-model={row.frequencyCount}
          min={1}
          max={999}
          controlsPosition="right"
          class="w-full!"
          aria-label="排查频次"
        />
      )
    },
    {
      prop: 'frequencyUnit',
      label: '频次单位',
      width: 180,
      required: true,
      headerTooltip: '与排查频次组合为岗位执行周期。',
      formatter: (row) => (
        <ElSelect
          v-model={row.frequencyUnit}
          class="w-full"
          placeholder="请选择"
          aria-label="频次单位"
        >
          {frequencyOptions.value.map((option) => (
            <ElOption key={String(option.value)} label={option.label} value={option.value} />
          ))}
        </ElSelect>
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 76,
      fixed: 'right',
      formatter: (row) => (
        <ArtIconButton
          icon="ri:close-line"
          label="移除防控岗位"
          tone="danger"
          onClick={() => removePosition(row.positionId)}
        />
      )
    }
  ])

  const submit = async () => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (!model.value.positions.length) {
        await formRef.value?.focusField('positions')
        ElMessage.warning('请至少选择一个防控岗位')
        return false
      }
      const validation = await positionTableRef.value?.validate({ focus: false })
      if (!validation?.valid) {
        activeFormTab.value = 'positionSection'
        await nextTick()
        if (validation?.firstError) {
          await positionTableRef.value?.validateField(validation.firstError.prop)
          ElMessage.warning(validation.firstError.message)
        }
        return false
      }
      await saveRiskControlMeasure({
        ...model.value,
        controlMeasure: model.value.controlMeasure.trim(),
        standardBasis: normalizeNullableText(model.value.standardBasis),
        failureMode: normalizeNullableText(model.value.failureMode)
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '风险管控措施保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: MeasureDialogOpenData) => {
    Object.assign(model.value, initial(), { riskItemId: data.item.id })
    selectedPositionIds.value = []
    positions.value = []
    if (data.row) {
      Object.assign(model.value, {
        id: data.row.id,
        riskItemId: data.item.id,
        controlMeasure: data.row.controlMeasure,
        controlMeasureCategory: data.row.controlMeasureCategory,
        controlLevel: data.row.controlLevel,
        standardBasis: data.row.standardBasis || '',
        failureMode: data.row.failureMode || '',
        hazardLevel: data.row.hazardLevel,
        sort: data.row.sort,
        positions: data.row.positions.map((i) => ({
          positionId: i.positionId,
          frequencyCount: i.frequencyCount,
          frequencyUnit: i.frequencyUnit
        }))
      })
      selectedPositionIds.value = model.value.positions.map((i) => i.positionId)
    }
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑防控措施' : '新增防控措施',
      subtitle: `${data.item.itemNo} · 完成评价后配置岗位责任和排查周期`,
      confirmText: '保存防控措施',
      loading: true,
      loadingText: '正在加载岗位与防控选项…',
      onOpen: async (_openData, api) => {
        formRef.value?.clearValidate()
        try {
          const [positionResult] = await Promise.all([
            fetchRiskPositionOptions('', 0, 499),
            ...[
              'smisControlMeasureCategory',
              'smisControlLevel',
              'smisHazardLevel',
              'smisFrequencyUnit'
            ].map((code) => userStore.ensureDictLoaded(code))
          ])
          positions.value = positionResult.data
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: submit
    })
  }
  defineExpose({ handleOpen })
</script>
<style scoped lang="scss">
  .measure-dialog__flow {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 14px;
    margin-bottom: 16px;
    background: var(--el-fill-color-light);
    border-radius: var(--el-border-radius-base);
  }

  .measure-dialog__flow span {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .measure-dialog__flow span.is-done {
    color: var(--el-color-success);
  }

  .measure-dialog__flow span.is-current {
    font-weight: 700;
    color: var(--theme-color);
  }

  .measure-dialog__flow i {
    flex: 1;
    height: 1px;
    background: var(--el-border-color);
  }

  .measure-dialog__positions {
    padding: 14px;
    margin-top: 4px;
    background: var(--el-fill-color-extra-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
  }

  .measure-dialog__positions-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 46%);
    gap: 18px;
    align-items: start;
    margin-bottom: 12px;
  }

  .measure-dialog__positions-head p {
    margin: 3px 0 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .measure-dialog__positions-head :deep(.el-select) {
    width: 100%;
  }

  .measure-dialog__positions-head :deep(.el-select-dropdown__item) {
    display: flex;
    justify-content: space-between;
  }

  .measure-dialog__positions-head small {
    color: var(--el-text-color-secondary);
  }

  .measure-dialog__position-empty {
    min-height: 140px;
    background: var(--default-box-color);
    border: 1px dashed var(--el-border-color);
    border-radius: var(--el-border-radius-base);
  }

  @media (width <= 760px) {
    .measure-dialog__positions-head {
      grid-template-columns: 1fr;
    }
  }
</style>
