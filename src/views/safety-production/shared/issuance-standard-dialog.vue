<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="issuance-dialog">
      <ArtEntitySummary spaced>
        <template #icon
          ><ArtSvgIcon :icon="isTool ? 'ri:tools-line' : 'ri:shield-check-line'"
        /></template>
        <strong>配置发放口径</strong
        ><p>适用岗位或组织至少选择一项；保存时按编号规则自动生成 3 位流水标准编号。</p>
      </ArtEntitySummary>
      <ArtForm
        ref="formRef"
        :model-value="form"
        @update:model-value="replaceReactiveModel(form, $event)"
        :items="formItems"
        :rules="rules"
        :span="8"
        :gutter="20"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      >
        <template #positionIds>
          <ArtTableMultipleSelect
            v-model="form.positionIds"
            :selected-data="selectedPositions"
            :api-fn="fetchPositions"
            :columns="positionColumns"
            row-key="id"
            label-key="name"
            description-key="organizationName"
            title="选择适用工种 / 岗位"
            subtitle="数据来源 HR 岗位主数据，支持跨组织多选"
            placeholder="请选择适用岗位"
            search-placeholder="搜索岗位名称或编码"
            empty-text="暂无可选岗位"
            empty-description="请先在 HR 岗位管理中新增并启用岗位。"
            @update:selected-data="selectedPositions = normalizeScopeRows($event)"
          >
            <template #empty><SmisDataSourceEmptyActions source="position" /></template>
          </ArtTableMultipleSelect>
        </template>
        <template #organizationIds>
          <ArtTreeMultipleSelect
            v-model="form.organizationIds"
            :selected-data="selectedOrganizations"
            :data="organizationTree"
            row-key="id"
            label-key="name"
            description-key="code"
            children-key="children"
            title="选择适用公司 / 部门"
            subtitle="数据来源系统组织管理，可跨层级多选"
            placeholder="请选择适用公司或部门"
            search-placeholder="搜索组织名称或编码"
            :tree-check-strictly="true"
            :show-selected-panel="true"
            :max-tag-count="4"
            empty-text="暂无可选组织"
            empty-description="请先在系统组织管理中维护当前租户的公司或部门。"
            @update:selected-data="selectedOrganizations = normalizeScopeRows($event)"
          >
            <template #empty><SmisDataSourceEmptyActions source="organization" /></template>
          </ArtTreeMultipleSelect>
        </template>
      </ArtForm>

      <ArtSectionCard
        :title="isTool ? '工器具明细标准' : '防护用品明细标准'"
        subtitle="选择物料后自动带入名称、编码、规格型号、计量单位与图片。"
      >
        <template #actions>
          <ArtTableMultipleSelect
            v-model="selectedMaterialIds"
            :selected-data="selectedMaterials"
            :api-fn="fetchMaterials"
            :columns="materialColumns"
            row-key="id"
            label-key="materialName"
            description-key="materialCode"
            :title="isTool ? '选择工器具物料' : '选择防护用品物料'"
            subtitle="支持多选，确认后批量加入明细标准"
            placeholder="新增明细"
            search-placeholder="搜索物料名称或编码"
            :empty-text="isTool ? '暂无可选的工器具物料' : '暂无可选防护用品'"
            :empty-description="
              isTool
                ? '当前租户没有匹配的启用工器具。请在物料信息中新增物料，将物料类型设为“工器具”并启用；仅在现有类别不适用时再维护类别。'
                : '当前租户没有匹配的启用防护用品，请在物料信息中新增或调整物料类型。'
            "
            @update:selected-data="handleMaterialsSelected"
          >
            <template #empty>
              <SmisDataSourceEmptyActions source="material" />
            </template>
          </ArtTableMultipleSelect>
        </template>
        <ArtTable
          ref="detailTableRef"
          :data="form.details"
          :columns="detailColumns"
          :pagination="false"
          row-key="materialId"
          table-layout="fixed"
          empty-text="暂无明细"
          :empty-description="isTool ? '点击新增明细选择工器具。' : '点击新增明细选择防护用品。'"
        />
      </ArtSectionCard>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { toDictionaryOption } from '@/utils/form/option'

  import { replaceReactiveModel } from '@/utils/form/model'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import {
    ElButton,
    ElInput,
    ElInputNumber,
    ElOption,
    ElSelect,
    type FormRules
  } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtTableMultipleSelect from '@/components/core/forms/art-data-select/table-multiple.vue'
  import ArtTreeMultipleSelect from '@/components/core/forms/art-data-select/tree-multiple.vue'
  import type {
    DataSelectColumn,
    DataSelectFetchParams,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtTable, { type ArtTableExpose } from '@/components/core/tables/art-table/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import SmisDataSourceEmptyActions from '@smis/views/components/smis-data-source-empty-actions.vue'
  import type { ColumnOption } from '@/types'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchMaterialList,
    fetchToolScopeOptions,
    fetchPpeScopeOptions,
    saveToolIssuanceStandard,
    savePpeIssuanceStandard,
    type SmisMaterial,
    type SmisPpeIssuanceStandard,
    type SmisPpeIssuanceStandardDetail,
    type SmisPpeIssuanceStandardSavePayload,
    type SmisPpeScopeOption,
    type SmisPpeStandardStatus
  } from '@smis/api'

  export interface IssuanceStandardDialogOpenData {
    row?: SmisPpeIssuanceStandard
  }
  export interface IssuanceStandardDialogExpose {
    handleOpen: (data: IssuanceStandardDialogOpenData) => Promise<void>
  }
  interface FormModel extends Omit<SmisPpeIssuanceStandardSavePayload, 'details'> {
    details: SmisPpeIssuanceStandardDetail[]
  }
  const props = defineProps<{ kind: 'tool' | 'ppe' }>()
  const isTool = props.kind === 'tool'
  const fetchScopeOptions = isTool ? fetchToolScopeOptions : fetchPpeScopeOptions
  const saveIssuanceStandard = isTool ? saveToolIssuanceStandard : savePpeIssuanceStandard
  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const dialogRef = ref<ArtDialogExpose<IssuanceStandardDialogOpenData>>()
  const formRef = ref<{ validate: () => Promise<boolean>; clearValidate: () => void }>()
  const detailTableRef = ref<ArtTableExpose>()
  const numberRule = useDocumentNumberRule(
    isTool ? 'smis.tool_issuance_standard' : 'smis.ppe_issuance_standard'
  )
  const organizationTree = ref<SmisPpeScopeOption[]>([])
  const selectedPositions = ref<SmisPpeScopeOption[]>([])
  const selectedOrganizations = ref<SmisPpeScopeOption[]>([])
  const selectedMaterials = ref<SmisMaterial[]>([])
  const selectedMaterialIds = ref<string[]>([])
  const initialForm = (): FormModel => ({
    standardNo: '',
    standardName: '',
    positionIds: [],
    organizationIds: [],
    ratedQuantity: 1,
    issuanceCycle: 'year',
    issuanceFrequency: 1,
    status: 'enabled',
    description: '',
    details: []
  })
  const form = reactive<FormModel>(initialForm())
  const numberProps = computed(() =>
    numberRule.inputProps(Boolean(form.id), '保存时自动生成', true)
  )
  const cycleOptions = computed(() =>
    (userStore.getDictMap.commonIssuanceCycle ?? []).map(toDictionaryOption)
  )
  const statusOptions = computed(() =>
    (userStore.getDictMap.commonEnabledStatus ?? []).map(toDictionaryOption)
  )
  const formItems = computed<FormItem[]>(() => [
    { label: '标准基础', key: 'basicSection', type: 'divider', span: 24 },
    {
      label: '标准编号',
      key: 'standardNo',
      type: 'input',
      description: numberRule.description.value,
      props: numberProps.value
    },
    {
      label: '发放标准名称',
      key: 'standardName',
      type: 'input',
      props: { maxlength: 120, showWordLimit: true, placeholder: '例如：焊接岗位基础防护标准' }
    },
    {
      label: '额定数量',
      key: 'ratedQuantity',
      type: 'number',
      width: 130,
      props: { min: 0.001, precision: 3, controlsPosition: 'right', class: '!w-full' }
    },
    {
      label: '发放周期',
      key: 'issuanceCycle',
      type: 'select',
      options: cycleOptions.value,
      props: { placeholder: '请选择周期', clearable: false }
    },
    {
      label: '发放频次',
      key: 'issuanceFrequency',
      type: 'number',
      props: { min: 1, max: 9999, precision: 0, controlsPosition: 'right', class: '!w-full' }
    },
    {
      label: '启用状态',
      key: 'status',
      type: 'select',
      options: statusOptions.value,
      props: { clearable: false }
    },
    { label: '适用范围', key: 'scopeSection', type: 'divider', span: 24 },
    { label: '适用工种 / 岗位', key: 'positionIds', type: 'input', span: 12 },
    { label: '适用公司 / 部门', key: 'organizationIds', type: 'input', span: 12 },
    {
      label: '标准说明',
      key: 'description',
      type: 'textarea',
      span: 24,
      props: { maxlength: 1000, placeholder: '补充适用场景、领取约束或更换条件' }
    }
  ])
  const rules: FormRules<FormModel> = {
    standardName: [{ required: true, message: '请输入发放标准名称', trigger: 'blur' }],
    ratedQuantity: [{ required: true, message: '请输入额定数量', trigger: 'change' }],
    issuanceCycle: [{ required: true, message: '请选择发放周期', trigger: 'change' }],
    issuanceFrequency: [{ required: true, message: '请输入发放频次', trigger: 'change' }],
    status: [{ required: true, message: '请选择启用状态', trigger: 'change' }]
  }
  const positionColumns: DataSelectColumn[] = [
    { prop: 'name', label: '岗位名称', minWidth: 150 },
    { prop: 'code', label: '岗位编码', width: 130 },
    { prop: 'organizationName', label: '所属组织', minWidth: 180 }
  ]
  const materialColumns: DataSelectColumn<SmisMaterial>[] = [
    { prop: 'materialName', label: '物料名称', minWidth: 170 },
    { prop: 'materialCode', label: '物料编码', width: 150 },
    { prop: 'specificationModel', label: '规格型号', minWidth: 150 },
    {
      prop: 'basicUnit',
      label: '计量单位',
      width: 100,
      dict: { code: 'smisMaterialUnit', display: 'text' }
    }
  ]
  const detailColumns = computed<ColumnOption<SmisPpeIssuanceStandardDetail>[]>(() => [
    {
      prop: 'materialName',
      label: '物料信息',
      minWidth: 200,
      formatter: (row) => (
        <div class="material-cell">
          <strong>{row.materialName}</strong>
          <small>{row.materialCode}</small>
        </div>
      )
    },
    {
      prop: 'specificationModel',
      label: '规格型号',
      minWidth: 130,
      showOverflowTooltip: true,
      formatter: (row) => row.specificationModel || '—'
    },
    {
      prop: 'basicUnit',
      label: '计量单位',
      width: 96,
      align: 'center',
      dict: { code: 'smisMaterialUnit', display: 'text' }
    },
    {
      prop: 'quotaQuantity',
      label: '定额数量',
      required: true,
      requiredMessage: ({ rowIndex }) => `第 ${rowIndex + 1} 行定额数量必须大于 0`,
      rules: [
        {
          validator: ({ value }) => Number(value) > 0,
          message: ({ rowIndex }) => `第 ${rowIndex + 1} 行定额数量必须大于 0`
        }
      ],
      width: 150,
      formatter: (row) => (
        <ElInputNumber v-model={row.quotaQuantity} min={0.001} precision={3} class="!w-full" />
      )
    },
    {
      prop: 'issuanceCycle',
      label: '发放周期',
      width: 132,
      formatter: (row) => (
        <ElSelect v-model={row.issuanceCycle}>
          {cycleOptions.value.map((item) => (
            <ElOption key={item.value} label={item.label} value={item.value} />
          ))}
        </ElSelect>
      )
    },
    {
      prop: 'issuanceFrequency',
      label: '发放频次',
      required: true,
      requiredMessage: ({ rowIndex }) => `第 ${rowIndex + 1} 行发放频次必须为 1 至 9999`,
      rules: [
        {
          validator: ({ value }) => {
            const frequency = Number(value)
            return Number.isInteger(frequency) && frequency >= 1 && frequency <= 9999
          },
          message: ({ rowIndex }) => `第 ${rowIndex + 1} 行发放频次必须为 1 至 9999`
        }
      ],
      width: 130,
      formatter: (row) => (
        <ElInputNumber
          v-model={row.issuanceFrequency}
          min={1}
          max={9999}
          precision={0}
          class="!w-full"
        />
      )
    },
    {
      prop: 'status',
      label: '状态',
      width: 116,
      formatter: (row) => (
        <ElSelect v-model={row.status}>
          {statusOptions.value.map((item) => (
            <ElOption key={item.value} label={item.label} value={item.value} />
          ))}
        </ElSelect>
      )
    },
    {
      prop: 'remark',
      label: '备注',
      minWidth: 150,
      formatter: (row) => <ElInput v-model={row.remark} maxlength={500} placeholder="选填" />
    },
    {
      prop: 'operation',
      label: '操作',
      width: 74,
      fixed: 'right',
      align: 'center',
      formatter: (row) => (
        <ElButton link type="danger" onClick={() => removeDetail(row.materialId)}>
          移除
        </ElButton>
      )
    }
  ])
  const normalizeScopeRows = (rows: DataSelectRecord[]): SmisPpeScopeOption[] =>
    rows as SmisPpeScopeOption[]
  const fetchPositions = async (params: DataSelectFetchParams) => {
    const result = await fetchScopeOptions('position', params.keyword)
    const from = (params.page - 1) * params.pageSize
    return { data: result.data.slice(from, from + params.pageSize), total: result.data.length }
  }
  const fetchMaterials = async (params: DataSelectFetchParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.page, size: params.pageSize })
    const result = await fetchMaterialList(
      {
        materialName: params.keyword,
        materialType: isTool ? 'tool' : 'protective_equipment',
        status: 'enabled',
        from,
        to
      },
      { showErrorMessage: false }
    )
    return result
  }
  const handleMaterialsSelected = (materials: SmisMaterial[]): void => {
    selectedMaterials.value = materials
    const current = new Map(form.details.map((item) => [item.materialId, item]))
    form.details = materials.map(
      (material, index) =>
        current.get(material.id) ?? {
          materialId: material.id,
          materialCode: material.materialCode,
          materialName: material.materialName,
          categoryName: material.category.categoryName,
          specificationModel: material.specificationModel,
          basicUnit: material.basicUnit,
          imageUrls: material.imageUrls ?? [],
          quotaQuantity: form.ratedQuantity,
          issuanceCycle: form.issuanceCycle,
          issuanceFrequency: form.issuanceFrequency,
          status: 'enabled' as SmisPpeStandardStatus,
          remark: '',
          sort: (index + 1) * 10
        }
    )
  }
  const removeDetail = (materialId: string) => {
    form.details = form.details.filter((item) => item.materialId !== materialId)
    selectedMaterialIds.value = selectedMaterialIds.value.filter((id) => id !== materialId)
    selectedMaterials.value = selectedMaterials.value.filter((item) => item.id !== materialId)
  }
  const reset = async () => {
    Object.assign(form, initialForm())
    selectedPositions.value = []
    selectedOrganizations.value = []
    selectedMaterials.value = []
    selectedMaterialIds.value = []
    await nextTick()
    formRef.value?.clearValidate()
    detailTableRef.value?.clearValidate()
  }
  const submit = async () => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (!form.positionIds.length && !form.organizationIds.length) {
        ElMessage.warning('适用岗位和适用公司/部门至少选择一项')
        return false
      }
      if (!form.details.length) {
        ElMessage.warning(isTool ? '请至少添加一条工器具明细' : '请至少添加一条防护用品明细')
        return false
      }
      const tableValidation = await detailTableRef.value?.validate()
      if (tableValidation && !tableValidation.valid) {
        return false
      }
      await saveIssuanceStandard({
        ...form,
        details: form.details.map(
          ({
            materialId,
            quotaQuantity,
            issuanceCycle,
            issuanceFrequency,
            status,
            remark,
            sort
          }) => ({
            materialId,
            quotaQuantity,
            issuanceCycle,
            issuanceFrequency,
            status,
            remark,
            sort
          })
        )
      })
      emit('success', form.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '发放标准保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: IssuanceStandardDialogOpenData): Promise<void> => {
    await reset()
    if (data.row) {
      Object.assign(form, {
        id: data.row.id,
        standardNo: data.row.standardNo,
        standardName: data.row.standardName,
        positionIds: data.row.positions.map((item) => item.id),
        organizationIds: data.row.organizations.map((item) => item.id),
        ratedQuantity: Number(data.row.ratedQuantity),
        issuanceCycle: data.row.issuanceCycle,
        issuanceFrequency: data.row.issuanceFrequency,
        status: data.row.status,
        description: data.row.description || '',
        details: data.row.details.map((item) => ({ ...item }))
      })
      selectedPositions.value = [...data.row.positions]
      selectedOrganizations.value = [...data.row.organizations]
      selectedMaterialIds.value = data.row.details.map((item) => item.materialId)
      selectedMaterials.value = data.row.details.map(
        (item) =>
          ({
            id: item.materialId,
            materialCode: item.materialCode,
            materialName: item.materialName,
            specificationModel: item.specificationModel,
            basicUnit: item.basicUnit,
            imageUrls: item.imageUrls,
            category: { id: '', categoryCode: '', categoryName: item.categoryName || '' }
          }) as SmisMaterial
      )
    }
    await dialogRef.value?.handleOpen(data, {
      title: data.row
        ? isTool
          ? '编辑工器具发放标准'
          : '编辑防护用品发放标准'
        : isTool
          ? '新增工器具发放标准'
          : '新增防护用品发放标准',
      subtitle: isTool
        ? '配置适用范围、发放节奏与工器具明细'
        : '配置适用范围、发放节奏与防护用品明细',
      confirmText: '保存标准',
      contentMaxHeight: '78vh',
      onOpen: async (_data, api) => {
        api.setLoading(true)
        try {
          const [, organizations] = await Promise.all([
            Promise.all(
              ['commonIssuanceCycle', 'commonEnabledStatus', 'smisMaterialUnit'].map((code) =>
                userStore.ensureDictLoaded(code)
              )
            ),
            fetchScopeOptions('organization'),
            numberRule.loadRule()
          ])
          organizationTree.value = organizations.data
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: submit
    })
  }
  defineExpose<IssuanceStandardDialogExpose>({ handleOpen })
</script>

<style scoped lang="scss">
  .issuance-dialog {
    .el-select,
    .el-input-number {
      width: 100%;
    }

    :deep(.material-cell) {
      display: flex;
      flex-direction: column;
      min-width: 0;

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        margin-top: 3px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.art-section-card) {
      margin-top: 8px;
    }
  }
</style>
