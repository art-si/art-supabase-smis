<template>
  <div class="blind-plate-items">
    <div class="blind-plate-items__header">
      <div>
        <strong>盲板明细</strong>
        <small>逐项登记设备或管线、介质、工况和盲板标识，便于现场逐块核验。</small>
      </div>
      <ElButton type="primary" plain @click="addItem">
        <ArtSvgIcon icon="ri:add-line" />
        新增盲板
      </ElButton>
    </div>

    <ElScrollbar class="blind-plate-items__table-scroll">
      <ArtTable
        ref="tableRef"
        :data="modelValue"
        :columns="columns"
        :pagination="false"
        row-key="id"
        table-layout="fixed"
        empty-text="尚未添加盲板明细"
      />
    </ElScrollbar>
  </div>
</template>

<script setup lang="tsx">
  import { ElButton, ElInput } from 'element-plus'
  import type { SmisSpecialOperationBlindPlateItem } from '@smis/api'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtTable, {
    type ArtTableExpose,
    type ArtTableValidationResult
  } from '@/components/core/tables/art-table/index.vue'
  import type { ColumnOption } from '@/types'
  import { createBlindPlateItem } from './special-operation-permit-utils'

  type BlindPlateEditableKey = Exclude<keyof SmisSpecialOperationBlindPlateItem, 'id'>

  const props = defineProps<{ modelValue: SmisSpecialOperationBlindPlateItem[] }>()
  const emit = defineEmits<{
    'update:modelValue': [value: SmisSpecialOperationBlindPlateItem[]]
  }>()
  const tableRef = ref<ArtTableExpose>()

  const addItem = (): void =>
    emit('update:modelValue', [...props.modelValue, createBlindPlateItem()])
  const removeItem = (index: number): void =>
    emit(
      'update:modelValue',
      props.modelValue.filter((_, itemIndex) => itemIndex !== index)
    )
  const updateItem = (index: number, key: BlindPlateEditableKey, value: string): void => {
    emit(
      'update:modelValue',
      props.modelValue.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    )
  }

  const textColumn = (
    prop: BlindPlateEditableKey,
    label: string,
    minWidth: number,
    placeholder: string,
    maxlength: number,
    required = false
  ): ColumnOption<SmisSpecialOperationBlindPlateItem> => ({
    prop,
    label,
    minWidth,
    required,
    headerTooltip: required ? `每项盲板都需填写${label}，与现场隔离标识保持一致。` : undefined,
    requiredMessage: required
      ? ({ rowIndex }) => `第 ${rowIndex + 1} 项盲板的${label}不能为空`
      : undefined,
    formatter: (row) => (
      <ElInput
        modelValue={String(row[prop] ?? '')}
        maxlength={maxlength}
        placeholder={placeholder}
        onUpdate:modelValue={(value: string) =>
          updateItem(
            props.modelValue.findIndex((item) => item.id === row.id),
            prop,
            value
          )
        }
      />
    )
  })
  const columns: ColumnOption<SmisSpecialOperationBlindPlateItem>[] = [
    { type: 'globalIndex', label: '序号', width: 62, fixed: 'left' },
    textColumn('equipmentPipelineName', '设备 / 管线名称', 180, '必填', 120, true),
    textColumn('medium', '介质', 120, '介质名称', 80),
    textColumn('temperature', '温度（℃）', 112, '例如 35', 24),
    textColumn('pressure', '压力（MPa）', 118, '例如 0.6', 24),
    textColumn('material', '盲板材质', 120, '材质', 80),
    textColumn('specification', '盲板规格', 132, '必填', 80, true),
    textColumn('blindPlateNo', '盲板编号', 132, '现场标识编号', 80),
    {
      prop: 'operation',
      label: '操作',
      width: 76,
      fixed: 'right',
      formatter: (row) => (
        <ElButton
          link
          type="danger"
          onClick={() => removeItem(props.modelValue.findIndex((item) => item.id === row.id))}
        >
          移除
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
  .blind-plate-items {
    display: grid;
    gap: 12px;
    min-width: 0;

    &__header {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;

      > div {
        display: grid;
        gap: 3px;
        min-width: 0;
      }

      strong {
        color: var(--el-text-color-primary);
      }

      small {
        line-height: 1.5;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.el-table) {
      --el-table-header-bg-color: var(--art-gray-100);

      border-radius: var(--art-control-radius);
    }

    &__table-scroll {
      min-width: 0;
      border-radius: var(--art-control-radius);
    }

    &__table-scroll :deep(.art-table) {
      min-width: 1052px;
    }

    @media (width <= 640px) {
      &__header {
        flex-direction: column;
        align-items: stretch;

        .el-button {
          width: 100%;
        }
      }
    }
  }
</style>
