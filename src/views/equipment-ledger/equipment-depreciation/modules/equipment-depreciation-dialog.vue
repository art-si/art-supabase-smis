<template>
  <ArtDialog
    @open="
      () => {
        activeFormTab = 'basicSection'
      }
    "
    ref="dialogRef"
    size="lg"
  >
    <div class="equipment-depreciation-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:percent-line" /></template>
        <strong>折旧期限由系统自动换算</strong>
        <p>填写折旧年限后，系统按“折旧年限 × 12”生成只读折旧期限，并同步生成年度折旧率行。</p>
      </ArtEntitySummary>

      <ArtForm
        v-model:active-tab="activeFormTab"
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="24"
        label-position="top"
        ><template #detailItems
          ><ArtSectionCard
            class="equipment-depreciation-dialog__rates"
            title="年折旧率"
            subtitle="按折旧年度维护折旧率；调整折旧年限时，系统会保留仍在期限内的已填数据。"
          >
            <ArtTable
              ref="rateTableRef"
              :data="form.model.annualRates"
              :columns="rateColumns"
              :pagination="false"
              row-key="depreciationYear"
              table-layout="fixed"
              empty-text="请先填写折旧年限"
              empty-description="填写后将自动生成对应年度的折旧率明细。"
            /> </ArtSectionCard></template
      ></ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { toDictionaryOption } from '@/utils/form/option'

  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { ElInputNumber, ElMessage, type FormRules } from 'element-plus'
  import type { ColumnOption } from '@/types'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable, { type ArtTableExpose } from '@/components/core/tables/art-table/index.vue'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import { useUserStore } from '@/store/modules/user'
  import {
    saveEquipmentDepreciation,
    type SmisEquipmentDepreciation,
    type SmisEquipmentDepreciationRate,
    type SmisEquipmentDepreciationSavePayload,
    type SmisEquipmentDepreciationStatus
  } from '@smis/api'

  export interface EquipmentDepreciationDialogOpenData {
    row?: SmisEquipmentDepreciation
  }

  interface AnnualRateForm extends Omit<SmisEquipmentDepreciationRate, 'depreciationRate'> {
    depreciationRate?: number
  }

  interface DepreciationForm {
    id?: string
    depreciationNo: string
    depreciationName: string
    depreciationYears?: number
    depreciationPeriodMonths: number
    status: SmisEquipmentDepreciationStatus
    remark: string
    annualRates: AnnualRateForm[]
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const activeFormTab = ref('basicSection')
  const dialogRef = ref<ArtDialogExpose<EquipmentDepreciationDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const rateTableRef = ref<ArtTableExpose>()
  const numberRule = useDocumentNumberRule('smis.equipment_depreciation')

  const initialForm = (): DepreciationForm => ({
    depreciationNo: '',
    depreciationName: '',
    depreciationYears: undefined,
    depreciationPeriodMonths: 0,
    status: 'active',
    remark: '',
    annualRates: []
  })

  const formModel = reactive<DepreciationForm>(initialForm())
  const statusOptions = computed(() =>
    (getDictMap.value.smisEquipmentDepreciationStatus ?? []).map(toDictionaryOption)
  )
  const depreciationNoProps = computed<Record<string, unknown>>(() =>
    numberRule.inputProps(Boolean(formModel.id), '请输入折旧编码', true)
  )

  const form = reactive<{
    model: DepreciationForm
    items: ComputedRef<FormItem[]>
    rules: FormRules<DepreciationForm>
  }>({
    model: formModel,
    items: computed(() => [
      { label: '基本信息', key: 'basicSection', type: 'tab', span: 24 },
      {
        label: '折旧编码',
        key: 'depreciationNo',
        type: 'input',
        description: numberRule.description.value,
        props: depreciationNoProps.value
      },
      {
        label: '状态',
        key: 'status',
        type: 'select',
        options: statusOptions.value,
        props: { clearable: false, placeholder: '请选择状态' }
      },
      {
        label: '折旧名称',
        key: 'depreciationName',
        type: 'input',
        span: 24,
        props: {
          maxlength: 120,
          showWordLimit: true,
          placeholder: '例如：机器设备平均年限折旧法'
        }
      },
      {
        label: '折旧年限（年）',
        key: 'depreciationYears',
        type: 'number',
        props: {
          min: 1,
          max: 100,
          precision: 0,
          controlsPosition: 'right',
          class: '!w-full',
          placeholder: '请输入折旧年限'
        }
      },
      {
        label: '折旧期限（月）',
        key: 'depreciationPeriodMonths',
        type: 'input',
        description: '只读，由折旧年限 × 12 自动计算。',
        props: { readonly: true, placeholder: '填写折旧年限后自动计算' }
      },
      {
        label: '备注',
        key: 'remark',
        type: 'input',
        span: 24,
        props: {
          type: 'textarea',
          rows: 3,
          maxlength: 1000,
          showWordLimit: true,
          resize: 'none',
          placeholder: '补充适用资产范围、财务口径或使用说明（选填）'
        }
      },
      { key: 'detailSection', label: '年折旧率', type: 'tab' },
      { key: 'detailItems', label: '', type: 'slot', span: 24 }
    ]),
    rules: {
      depreciationNo: [
        {
          validator: (_rule, value, callback) => {
            if (numberRule.manualRequired(Boolean(formModel.id)) && !String(value || '').trim())
              callback(new Error('请输入折旧编码'))
            else callback()
          },
          trigger: 'blur'
        }
      ],
      depreciationName: [{ required: true, message: '请输入折旧名称', trigger: 'blur' }],
      depreciationYears: [{ required: true, message: '请输入折旧年限', trigger: 'change' }],
      status: [{ required: true, message: '请选择状态', trigger: 'change' }]
    }
  })

  const rateColumns = computed<ColumnOption<AnnualRateForm>[]>(() => [
    {
      prop: 'depreciationYear',
      label: '折旧年度',
      minWidth: 180,
      formatter: (row) => <strong>第 {row.depreciationYear} 年</strong>
    },
    {
      prop: 'depreciationRate',
      label: '折旧率（%）',
      required: true,
      requiredMessage: ({ rowIndex }) => `请填写第 ${rowIndex + 1} 年折旧率`,
      rules: [
        {
          validator: ({ value }) => {
            if (value === '' || value === null || value === undefined) return false
            const rate = Number(value)
            return Number.isFinite(rate) && rate >= 0 && rate <= 100
          },
          message: ({ rowIndex }) => `第 ${rowIndex + 1} 年折旧率须在 0 到 100 之间`
        }
      ],
      minWidth: 220,
      formatter: (row) => (
        <ElInputNumber
          v-model={row.depreciationRate}
          min={0}
          max={100}
          precision={4}
          controls-position="right"
          class="!w-full"
          placeholder="请输入折旧率"
        />
      )
    }
  ])

  const syncAnnualRates = (years?: number) => {
    const normalizedYears = Number.isInteger(years) && Number(years) > 0 ? Number(years) : 0
    const currentRates = new Map(
      form.model.annualRates.map((item) => [item.depreciationYear, item.depreciationRate])
    )
    form.model.depreciationPeriodMonths = normalizedYears * 12
    form.model.annualRates = Array.from({ length: normalizedYears }, (_, index) => ({
      depreciationYear: index + 1,
      depreciationRate: currentRates.get(index + 1)
    }))
    void nextTick(() => rateTableRef.value?.clearValidate())
  }

  watch(() => form.model.depreciationYears, syncAnnualRates)

  const resetForm = async () => {
    Object.assign(form.model, initialForm())
    await nextTick()
    formRef.value?.clearValidate()
    rateTableRef.value?.clearValidate()
  }

  const buildPayload = (): SmisEquipmentDepreciationSavePayload => ({
    id: form.model.id,
    depreciationNo: form.model.depreciationNo.trim(),
    depreciationName: form.model.depreciationName.trim(),
    depreciationYears: Number(form.model.depreciationYears),
    status: form.model.status,
    remark: form.model.remark.trim(),
    annualRates: form.model.annualRates.map((item) => ({
      depreciationYear: item.depreciationYear,
      depreciationRate: Number(item.depreciationRate)
    }))
  })

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const tableValidation = await rateTableRef.value?.validate({ focus: false })
      if (tableValidation && !tableValidation.valid) {
        activeFormTab.value = 'detailSection'
        await nextTick()
        if (tableValidation.firstError) {
          await rateTableRef.value?.validateField(tableValidation.firstError.prop)
          ElMessage.warning(tableValidation.firstError.message)
        }
        return false
      }
      await saveEquipmentDepreciation(buildPayload())
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '设备折旧保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: EquipmentDepreciationDialogOpenData): Promise<void> => {
    await resetForm()
    if (data.row) {
      Object.assign(form.model, {
        id: data.row.id,
        depreciationNo: data.row.depreciationNo,
        depreciationName: data.row.depreciationName,
        depreciationYears: data.row.depreciationYears,
        depreciationPeriodMonths: data.row.depreciationPeriodMonths,
        status: data.row.status,
        remark: data.row.remark || '',
        annualRates: data.row.annualRates.map((item) => ({
          id: item.id,
          depreciationYear: item.depreciationYear,
          depreciationRate: Number(item.depreciationRate)
        }))
      })
    }
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑折旧方法' : '新增折旧方法',
      subtitle: '维护折旧名称、折旧期限与逐年折旧率',
      confirmText: '保存折旧方法',
      contentMaxHeight: 'calc(100vh - 176px)',
      loading: true,
      onOpen: async (_data, api) => {
        try {
          await Promise.all([
            numberRule.loadRule(),
            userStore.ensureDictLoaded('smisEquipmentDepreciationStatus')
          ])
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit,
      onReset: () => void resetForm()
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .equipment-depreciation-dialog {
    display: grid;
    gap: var(--art-space-4);

    &__rates {
      min-width: 0;

      :deep(.el-input-number) {
        width: min(100%, 320px);
      }
    }
  }
</style>
