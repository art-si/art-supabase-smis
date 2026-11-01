<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="tool-return-dialog">
      <ElAlert
        class="mb-4"
        title="按源发放明细办理归还"
        description="支持同一领用人跨发放单多选；系统会汇总源单号，并逐行校验剩余可归还数量。"
        type="info"
        :closable="false"
        show-icon
      />

      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="formItems"
        :rules="form.rules"
        :span="8"
        :gutter="16"
        label-position="top"
      />

      <ArtSectionCard
        title="归还明细"
        :subtitle="employeeSummary"
        :empty="form.model.items.length === 0"
        empty-title="尚未选择待归还工器具"
        empty-description="从已过账发放记录中选择同一领用人的一项或多项工器具。"
      >
        <template #actions>
          <ArtTableMultipleSelect
            v-model="selection.sourceIds"
            :selected-data="selection.sources"
            :api-fn="fetchSourceOptions"
            :columns="sourceColumns"
            row-key="id"
            :label-key="sourceLabel"
            :description-key="sourceDescription"
            title="选择待归还工器具"
            subtitle="仅显示已过账且仍有可归还数量的发放明细"
            placeholder="选择归还明细"
            search-placeholder="搜索发放单号、领用人或工器具"
            empty-text="暂无可归还工器具"
            empty-description="只有已过账且仍有剩余可归还数量的工器具发放明细才会显示。"
            @update:selected-data="handleSourcesChange"
          >
            <template #empty>
              <SmisDataSourceEmptyActions source="tool-issuance-record" />
            </template>
          </ArtTableMultipleSelect>
        </template>

        <ArtTable
          v-if="form.model.items.length"
          ref="detailTableRef"
          :data="form.model.items"
          :columns="detailColumns"
          :pagination="false"
          row-key="sourceIssuanceItemId"
          table-layout="fixed"
        />
      </ArtSectionCard>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import dayjs from 'dayjs'
  import { ElButton, ElInput, ElInputNumber, ElMessage, type FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtTableMultipleSelect from '@/components/core/forms/art-data-select/table-multiple.vue'
  import type {
    DataSelectColumn,
    DataSelectFetchParams,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import type { ArtTableExpose } from '@/components/core/tables/art-table/index.vue'
  import SmisDataSourceEmptyActions from '@smis/views/components/smis-data-source-empty-actions.vue'
  import type { ColumnOption } from '@/types'
  import {
    fetchToolReturnableItems,
    saveToolReturn,
    submitToolReturn,
    type SmisToolReturn,
    type SmisToolReturnItem,
    type SmisToolReturnSaveAction,
    type SmisToolReturnableItem
  } from '@smis/api'

  export interface ToolReturnDialogOpenData {
    mode: 'add' | 'edit' | 'copy' | 'return'
    row?: SmisToolReturn
  }

  interface FormModel {
    id?: string
    returnNo: string
    returnDate: string
    remark: string
    items: SmisToolReturnItem[]
  }

  interface SelectionState {
    sourceIds: string[]
    sources: SmisToolReturnableItem[]
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<ToolReturnDialogOpenData>>()
  const formRef = ref<{ validate: () => Promise<boolean>; clearValidate: () => void }>()
  const detailTableRef = ref<ArtTableExpose>()
  const openMode = ref<ToolReturnDialogOpenData['mode']>('add')
  const createInitialForm = (): FormModel => ({
    id: undefined,
    returnNo: '',
    returnDate: dayjs().format('YYYY-MM-DD'),
    remark: '',
    items: []
  })
  const form = reactive<{ model: FormModel; rules: FormRules<FormModel> }>({
    model: createInitialForm(),
    rules: {
      returnDate: [{ required: true, message: '请选择归还日期', trigger: 'change' }]
    }
  })
  const selection = reactive<SelectionState>({ sourceIds: [], sources: [] })
  const formItems: FormItem[] = [
    {
      label: '归还单号',
      key: 'returnNo',
      type: 'input',
      props: { disabled: true, placeholder: '保存时按月生成 4 位流水码' }
    },
    {
      label: '归还日期',
      key: 'returnDate',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', class: '!w-full', placeholder: '请选择归还日期' }
    },
    {
      label: '备注',
      key: 'remark',
      type: 'input',
      props: { maxlength: 1000, showWordLimit: true, placeholder: '补充归还原因或交接说明' }
    }
  ]
  const employeeSummary = computed(() => {
    const source = selection.sources[0]
    return source
      ? `领用人：${source.employeeName} · ${source.employeeNo}；已选择 ${form.model.items.length} 项`
      : '选择第一条明细后，后续选择将自动限定为同一领用人'
  })
  const sourceColumns: DataSelectColumn[] = [
    { prop: 'issuanceNo', label: '源发放单号', width: 150 },
    { prop: 'employeeName', label: '领用人', width: 110 },
    { prop: 'materialName', label: '工器具', minWidth: 170 },
    { prop: 'specificationModel', label: '规格型号', minWidth: 130 },
    { prop: 'issueDate', label: '发放日期', width: 112 },
    { prop: 'returnableQuantity', label: '可归还数量', width: 112, align: 'right' },
    { prop: 'unit', label: '单位', width: 80 }
  ]
  const detailColumns: ColumnOption<SmisToolReturnItem>[] = [
    { prop: 'sourceIssuanceNo', label: '源发放单号', width: 150, fixed: 'left' },
    { prop: 'materialName', label: '工器具', minWidth: 170, showOverflowTooltip: true },
    { prop: 'specificationModel', label: '规格型号', minWidth: 130, showOverflowTooltip: true },
    { prop: 'issuedQuantity', label: '原发放数量', width: 112, align: 'right' },
    {
      prop: 'returnQuantity',
      label: '本次归还数量',
      required: true,
      rules: {
        validator: ({ value, row }) => {
          const quantity = Number(value)
          return quantity > 0 && quantity <= sourceMaximum(row.sourceIssuanceItemId)
        },
        message: ({ rowIndex }) => `第 ${rowIndex + 1} 行归还数量应大于 0 且不能超过可归还数量`
      },
      width: 172,
      formatter: (row) => (
        <ElInputNumber
          v-model={row.returnQuantity}
          min={0.001}
          max={sourceMaximum(row.sourceIssuanceItemId)}
          precision={3}
          controlsPosition="right"
          class="!w-full"
        />
      )
    },
    {
      prop: 'unit',
      label: '计量单位',
      width: 96,
      align: 'center',
      dict: { code: 'smisMaterialUnit', display: 'text' }
    },
    {
      prop: 'remark',
      label: '明细备注',
      minWidth: 170,
      formatter: (row) => <ElInput v-model={row.remark} maxlength={500} placeholder="选填" />
    },
    {
      prop: 'operation',
      label: '操作',
      width: 76,
      fixed: 'right',
      align: 'center',
      formatter: (row) => (
        <ElButton link type="danger" onClick={() => removeSource(row.sourceIssuanceItemId)}>
          移除
        </ElButton>
      )
    }
  ]

  const sourceLabel = (row: DataSelectRecord): string => {
    const source = row as SmisToolReturnableItem
    return `${source.materialName} · ${source.issuanceNo}`
  }
  const sourceDescription = (row: DataSelectRecord): string => {
    const source = row as SmisToolReturnableItem
    return `${source.employeeName} · 可归还 ${source.returnableQuantity} ${source.unit}`
  }
  const fetchSourceOptions = async (params: DataSelectFetchParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.page, size: params.pageSize })
    const result = await fetchToolReturnableItems({
      keyword: params.keyword,
      from,
      to
    })
    return result
  }
  const sourceMaximum = (sourceItemId: string): number =>
    selection.sources.find((item) => item.id === sourceItemId)?.returnableQuantity ??
    form.model.items.find((item) => item.sourceIssuanceItemId === sourceItemId)?.returnQuantity ??
    0

  const handleSourcesChange = (rows: DataSelectRecord[]): void => {
    const sources = rows as SmisToolReturnableItem[]
    const employeeId = sources[0]?.employeeId
    const accepted = employeeId ? sources.filter((row) => row.employeeId === employeeId) : []
    if (accepted.length !== sources.length) {
      ElMessage.warning('同一张归还单只能选择同一领用人的工器具')
    }
    const existing = new Map(
      form.model.items.map((item) => [item.sourceIssuanceItemId, item] as const)
    )
    selection.sources = accepted
    selection.sourceIds = accepted.map((item) => item.id)
    form.model.items = accepted.map((source) => {
      const current = existing.get(source.id)
      return (
        current ?? {
          sourceIssuanceRecordId: source.issuanceRecordId,
          sourceIssuanceItemId: source.id,
          sourceIssuanceNo: source.issuanceNo,
          materialId: source.materialId,
          materialCategory: source.materialCategory,
          materialName: source.materialName,
          specificationModel: source.specificationModel,
          unit: source.unit,
          issuedQuantity: source.issuedQuantity,
          returnQuantity: source.returnableQuantity,
          remark: ''
        }
      )
    })
  }
  const removeSource = (sourceItemId: string): void => {
    selection.sourceIds = selection.sourceIds.filter((id) => id !== sourceItemId)
    selection.sources = selection.sources.filter((item) => item.id !== sourceItemId)
    form.model.items = form.model.items.filter((item) => item.sourceIssuanceItemId !== sourceItemId)
  }
  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, createInitialForm())
    selection.sourceIds = []
    selection.sources = []
    await nextTick()
    formRef.value?.clearValidate()
  }
  const sourceSnapshot = (
    row: SmisToolReturn,
    item: SmisToolReturnItem
  ): SmisToolReturnableItem => ({
    id: item.sourceIssuanceItemId,
    issuanceRecordId: item.sourceIssuanceRecordId,
    issuanceNo: item.sourceIssuanceNo,
    employeeId: row.employeeId,
    employeeNo: row.employeeNo,
    employeeName: row.employeeName,
    positionName: row.positionName,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    issueDate: row.returnDate,
    materialId: item.materialId,
    materialCategory: item.materialCategory,
    materialName: item.materialName,
    specificationModel: item.specificationModel,
    unit: item.unit,
    issuedQuantity: item.issuedQuantity,
    returnableQuantity: item.returnQuantity
  })
  const initializeFromRow = (row: SmisToolReturn, copy: boolean): void => {
    Object.assign(form.model, {
      id: copy ? undefined : row.id,
      returnNo: copy ? '' : row.returnNo,
      returnDate: copy ? dayjs().format('YYYY-MM-DD') : row.returnDate,
      remark: row.remark || '',
      items: row.items.map((item) => ({ ...item, id: undefined }))
    })
    selection.sources = row.items.map((item) => sourceSnapshot(row, item))
    selection.sourceIds = selection.sources.map((item) => item.id)
  }
  const saveAction = (): SmisToolReturnSaveAction =>
    openMode.value === 'copy' ? 'copy' : openMode.value === 'return' ? 'return' : 'add'
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (!form.model.items.length) {
        ElMessage.warning('请至少选择一条待归还工器具')
        return false
      }
      const tableValidation = await detailTableRef.value?.validate()
      if (tableValidation?.valid === false) {
        return false
      }
    } catch (error) {
      notifyFriendlyError(error, '工器具归还单校验失败，请重试')
      return false
    }
    try {
      const result = await saveToolReturn(
        {
          id: form.model.id,
          returnDate: form.model.returnDate,
          remark: form.model.remark || null,
          items: form.model.items.map((item) => ({
            sourceIssuanceItemId: item.sourceIssuanceItemId,
            returnQuantity: item.returnQuantity,
            remark: item.remark
          }))
        },
        saveAction()
      )
      form.model.id = result.data || form.model.id
    } catch (error) {
      notifyFriendlyError(error, '工器具归还单保存失败，请检查内容后重试')
      return false
    }
    if (openMode.value === 'return' && !form.model.id) {
      ElMessage.warning('归还单已保存，但未返回记录编号；请在列表核实状态后继续')
      emit('success')
      return true
    }
    if (openMode.value === 'return' && form.model.id) {
      try {
        await submitToolReturn(form.model.id, { showMessage: false })
        ElMessage.success('归还单已提交审批')
      } catch (error) {
        const reason = getFriendlySupabaseErrorMessage(error, '提交审批未完成')
        ElMessage.warning(`归还单已保存，${reason}；请在列表核实状态后继续`)
        emit('success')
        return true
      }
    }
    emit('success')
    return true
  }
  const handleOpen = async (data: ToolReturnDialogOpenData): Promise<void> => {
    openMode.value = data.mode
    await resetForm()
    if (data.row) initializeFromRow(data.row, data.mode === 'copy')
    await dialogRef.value?.handleOpen(data, {
      title:
        data.mode === 'edit'
          ? '编辑工器具归还单'
          : data.mode === 'copy'
            ? '复制并新增归还单'
            : data.mode === 'return'
              ? '发起工器具归还'
              : '新增工器具归还单',
      subtitle: '归还单号按月自动生成 4 位流水码，源单关系由系统保留',
      confirmText: data.mode === 'return' ? '生成并提交审批' : '保存草稿',
      contentMaxHeight: '78vh',
      onOpen: () => {
        formRef.value?.clearValidate()
        detailTableRef.value?.clearValidate()
      },
      onConfirm: handleSubmit
    })
  }

  defineExpose({ handleOpen })
</script>
