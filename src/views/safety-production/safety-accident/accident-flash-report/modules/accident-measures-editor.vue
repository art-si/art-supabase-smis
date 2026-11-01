<template>
  <div class="accident-measures-editor">
    <div class="accident-measures-editor__toolbar">
      <div>
        <strong>计划防范措施</strong>
        <span>明确措施、计划落实时间和责任人</span>
      </div>
      <ElButton type="primary" plain @click="addRow">
        <ArtSvgIcon icon="ri:add-line" />添加措施
      </ElButton>
    </div>

    <ArtTable
      v-if="rows.length"
      ref="tableRef"
      :data="rows"
      :columns="columns"
      :pagination="false"
      row-key="localKey"
      table-layout="fixed"
    />
    <ArtEmptyState
      v-else
      title="暂未添加防范措施"
      description="事故原因明确后，可补充计划措施、完成日期与责任人。"
      size="compact"
    />
  </div>
</template>

<script setup lang="tsx">
  import { cloneDeep, isEqual } from 'lodash-es'
  import { serializeOrderedEditorRows } from '@/utils/form/model'
  import { ref, watch } from 'vue'
  import { ElButton, ElDatePicker, ElInput } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import type { ColumnOption } from '@/types'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtTable, {
    type ArtTableExpose,
    type ArtTableValidationResult
  } from '@/components/core/tables/art-table/index.vue'
  import {
    fetchAccidentEmployeeCandidates,
    type SmisAccidentEmployee,
    type SmisAccidentPreventionMeasure
  } from '@smis/api'

  interface EditorRow extends SmisAccidentPreventionMeasure {
    localKey: string
  }

  const props = withDefaults(defineProps<{ modelValue?: SmisAccidentPreventionMeasure[] }>(), {
    modelValue: () => []
  })
  const emit = defineEmits<{
    'update:modelValue': [value: SmisAccidentPreventionMeasure[]]
  }>()
  const rows = ref<EditorRow[]>([])
  const tableRef = ref<ArtTableExpose>()
  let localSequence = 0
  const createLocalKey = (): string => `measure-${Date.now()}-${localSequence++}`
  const toEditorRows = (value: SmisAccidentPreventionMeasure[]): EditorRow[] => {
    const currentRows = rows.value
    return cloneDeep(value).map((item, index) => ({
      ...item,
      localKey: item.id || currentRows[index]?.localKey || createLocalKey()
    }))
  }
  const sync = (): void => emit('update:modelValue', serializeOrderedEditorRows(rows.value))
  watch(
    () => props.modelValue,
    (value) => {
      if (isEqual(value, serializeOrderedEditorRows(rows.value))) return
      rows.value = toEditorRows(value)
    },
    { immediate: true }
  )
  watch(rows, sync, { deep: true, flush: 'sync' })
  const addRow = (): void => {
    rows.value.push({
      localKey: createLocalKey(),
      plannedMeasure: '',
      plannedImplementationDate: null,
      responsibleEmployeeId: null,
      responsibleEmployee: null,
      sort: rows.value.length
    })
  }
  const removeRow = (index: number): void => {
    rows.value.splice(index, 1)
  }
  const handleResponsibleChange = (row: EditorRow, selected: EmployeeIntegrationItem[]): void => {
    const employee = selected[0] as SmisAccidentEmployee | undefined
    row.responsibleEmployeeId = employee?.id || null
    row.responsibleEmployee = employee ?? null
  }
  const getRowIndex = (row: EditorRow): number => rows.value.findIndex((item) => item === row)
  const columns: ColumnOption<EditorRow>[] = [
    { type: 'globalIndex', label: '序号', width: 64, align: 'center' },
    {
      prop: 'plannedMeasure',
      label: '计划防范措施',
      required: true,
      headerTooltip: '每行填写可执行、可核验的防范措施，计划落实时间和责任人可按业务补充。',
      requiredMessage: ({ rowIndex }) => `第 ${rowIndex + 1} 行计划防范措施不能为空`,
      minWidth: 420,
      showOverflowTooltip: false,
      formatter: (row) => (
        <ElInput
          v-model={row.plannedMeasure}
          type="textarea"
          rows={2}
          maxlength={1000}
          showWordLimit
          resize="none"
          class="w-full!"
          placeholder="请输入可执行、可核验的防范措施"
        />
      )
    },
    {
      prop: 'plannedImplementationDate',
      label: '计划落实时间',
      width: 170,
      showOverflowTooltip: false,
      formatter: (row) => (
        <ElDatePicker
          v-model={row.plannedImplementationDate}
          type="date"
          valueFormat="YYYY-MM-DD"
          placeholder="选择日期"
          class="w-full!"
        />
      )
    },
    {
      prop: 'responsibleEmployeeId',
      label: '落实责任人',
      width: 240,
      showOverflowTooltip: false,
      formatter: (row) => (
        <ArtEmployeeSelect
          v-model={row.responsibleEmployeeId}
          selectedData={row.responsibleEmployee ? [row.responsibleEmployee] : []}
          apiFn={fetchAccidentEmployeeCandidates}
          title="选择防范措施责任人"
          subtitle="数据来自当前租户员工花名册"
          placeholder="选择责任人"
          onUpdate:selectedData={(selected: EmployeeIntegrationItem[]) =>
            handleResponsibleChange(row, selected)
          }
        />
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 76,
      align: 'center',
      formatter: (row) => (
        <ElButton
          link
          type="danger"
          aria-label="删除防范措施"
          onClick={() => removeRow(getRowIndex(row))}
        >
          删除
        </ElButton>
      )
    }
  ]

  const validate = async (options?: { focus?: boolean }): Promise<ArtTableValidationResult> =>
    (await tableRef.value?.validate(options)) ?? { valid: true, errors: [] }
  const validateField = async (prop: string): Promise<ArtTableValidationResult> =>
    (await tableRef.value?.validateField(prop)) ?? { valid: true, errors: [] }
  const clearValidate = (): void => tableRef.value?.clearValidate()

  defineExpose({ validate, validateField, clearValidate })
</script>

<style scoped lang="scss">
  .accident-measures-editor {
    min-width: 0;

    &__toolbar {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;

      > div {
        display: grid;
        gap: 3px;
      }

      span {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.el-table__cell) {
      vertical-align: top;
    }

    @media (width <= 760px) {
      &__toolbar {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  }
</style>
