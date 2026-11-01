<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="safety-risk-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:shield-check-line" /></template>
        <strong>风险点与危害因素一体维护</strong>
        <p>危险编号由系统生成；完成定量评价后，该记录进入分级管控与巡查任务链路。</p>
      </ArtEntitySummary>

      <ArtForm ref="formRef" v-model="form" :items="formItems" :rules="rules" :span="12" />
    </div>

    <template #footer="{ api }">
      <ElButton @click="api.handleClose()">取消</ElButton>
      <ElButton
        v-auth="row ? 'SmisDualControlSafetyRiskList:Edit' : 'SmisDualControlSafetyRiskList:Add'"
        type="primary"
        :loading="submitting"
        :disabled="!formRef?.readyToSubmit"
        @click="handleSubmit"
        >保存安全风险</ElButton
      >
    </template>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'
  import { computed, onDeactivated, ref, shallowRef } from 'vue'
  import { storeToRefs } from 'pinia'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchRiskHazardWorkspace,
    saveSafetyRisk,
    type SmisRiskActivity,
    type SmisSafetyRiskOptions,
    type SmisSafetyRiskRecord,
    type SmisSafetyRiskSavePayload
  } from '@smis/api'

  export interface SafetyRiskDialogOpenData {
    row?: SmisSafetyRiskRecord
    options: SmisSafetyRiskOptions
    loadOptions?: () => Promise<SmisSafetyRiskOptions>
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<SafetyRiskDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const row = shallowRef<SmisSafetyRiskRecord>()
  const options = shallowRef<SmisSafetyRiskOptions>({ riskPoints: [], hazardCategories: [] })
  const activities = shallowRef<SmisRiskActivity[]>([])
  const activityLoading = ref(false)
  const submitting = ref(false)
  const initial = (): SmisSafetyRiskSavePayload => ({
    id: undefined,
    riskPointId: '',
    hazardFactor: '',
    factorCategoryId: null,
    accidentTypes: [],
    consequence: '',
    sort: 0,
    activityIds: []
  })
  const form = ref<SmisSafetyRiskSavePayload>(initial())
  const accidentTypeOptions = computed(() =>
    (getDictMap.value.smisAccidentCategory ?? []).map(toDictionaryOption)
  )
  const rules: FormRules<SmisSafetyRiskSavePayload> = {
    riskPointId: [{ required: true, message: '请选择关联风险点', trigger: 'change' }],
    hazardFactor: [{ required: true, message: '请输入危险源或危害因素', trigger: 'blur' }]
  }

  const loadActivities = async (riskPointId: string): Promise<void> => {
    activities.value = []
    if (!riskPointId) return
    activityLoading.value = true
    try {
      activities.value = (await fetchRiskHazardWorkspace(riskPointId)).activities
    } finally {
      activityLoading.value = false
    }
  }

  const handleRiskPointChange = async (riskPointId: string): Promise<void> => {
    form.value.activityIds = []
    await loadActivities(riskPointId)
  }

  const formItems = computed<FormItem[]>(() => [
    {
      key: 'identitySection',
      label: '风险身份',
      type: 'divider',
      span: 24,
      description: '选择已有风险点并明确危险源类别'
    },
    {
      key: 'hazardNoDisplay',
      label: '危险编号',
      type: 'text',
      props: { formatter: () => row.value?.hazardNo || '保存后自动生成' }
    },
    {
      key: 'riskPointId',
      label: '关联风险点',
      type: 'select',
      options: options.value.riskPoints.map((item) => ({
        label: [item.pointName, item.pointNo, item.siteName].filter(Boolean).join(' · '),
        value: item.id
      })),
      props: {
        filterable: true,
        placeholder: '按编号或名称选择风险点',
        onChange: handleRiskPointChange
      }
    },
    {
      key: 'hazardFactor',
      label: '危险源 / 危害因素',
      type: 'input',
      props: { maxlength: 500, placeholder: '描述具体危险源或危害因素' }
    },
    {
      key: 'factorCategoryId',
      label: '危害因素类别',
      type: 'select',
      options: options.value.hazardCategories.map((item) => ({
        label: item.categoryName,
        value: item.id
      })),
      props: { clearable: true, filterable: true }
    },
    {
      key: 'consequenceSection',
      label: '事故后果',
      type: 'divider',
      span: 24,
      description: '描述可能事故类型、风险后果和关联作业活动'
    },
    {
      key: 'accidentTypes',
      label: '事故类型',
      type: 'select',
      span: 24,
      options: accidentTypeOptions.value,
      props: {
        multiple: true,
        collapseTags: true,
        collapseTagsTooltip: true,
        clearable: true,
        placeholder: '可选择多个事故类型'
      }
    },
    {
      key: 'consequence',
      label: '风险描述 / 可能后果',
      type: 'textarea',
      props: { maxlength: 2000, placeholder: '说明风险触发条件、可能后果及影响范围' }
    },
    {
      key: 'activityIds',
      label: '关联作业活动',
      type: 'select',
      span: 24,
      options: activities.value.map((item) => ({
        label: item.activityName + ' · ' + item.workStep,
        value: item.id
      })),
      props: {
        multiple: true,
        collapseTags: true,
        collapseTagsTooltip: true,
        clearable: true,
        loading: activityLoading.value,
        disabled: !form.value.riskPointId,
        placeholder: '选择该风险点下的作业活动'
      }
    },
    { key: 'sort', label: '排序', type: 'number', props: { min: 0, max: 9999 } }
  ])

  const handleSubmit = async (): Promise<void> => {
    if (submitting.value) return
    try {
      await formRef.value?.validate()
      submitting.value = true
      await saveSafetyRisk({
        ...form.value,
        id: row.value?.id,
        hazardFactor: form.value.hazardFactor.trim(),
        consequence: normalizeNullableText(form.value.consequence),
        accidentTypes: [...form.value.accidentTypes],
        activityIds: [...form.value.activityIds]
      })
      emit('success', row.value ? 'edit' : 'add')
      dialogRef.value?.handleClose(true)
    } catch {
      /* 表单和请求层统一提示 */
    } finally {
      submitting.value = false
    }
  }

  const handleOpen = async (data: SafetyRiskDialogOpenData): Promise<void> => {
    row.value = data.row
    options.value = data.options
    Object.assign(form.value, initial())
    if (data.row) {
      Object.assign(form.value, {
        id: data.row.id,
        riskPointId: data.row.riskPointId,
        hazardFactor: data.row.hazardSource,
        factorCategoryId:
          data.options.hazardCategories.find(
            (item) => item.categoryName === data.row?.factorCategoryName
          )?.id || null,
        accidentTypes: [...data.row.accidentTypes],
        consequence: data.row.riskDescription || '',
        activityIds: [...data.row.activityIds]
      })
    }
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑安全风险' : '新增安全风险',
      subtitle: data.row
        ? `${data.row.hazardNo} · ${data.row.riskName}`
        : '建立风险点下的危险源清单',
      contentMaxHeight: 'calc(100vh - 150px)',
      loading: true,
      loadingText: '正在加载事故类别与作业活动…',
      onOpen: async (_openData, api) => {
        formRef.value?.clearValidate()
        try {
          await Promise.all([
            userStore.ensureDictLoaded('smisAccidentCategory'),
            form.value.riskPointId ? loadActivities(form.value.riskPointId) : Promise.resolve(),
            ...(!data.options.riskPoints.length && data.loadOptions
              ? [data.loadOptions().then((loaded) => (options.value = loaded))]
              : [])
          ])
          if (data.row) {
            form.value.factorCategoryId =
              options.value.hazardCategories.find(
                (item) => item.categoryName === data.row?.factorCategoryName
              )?.id || null
          }
        } finally {
          api.setLoading(false)
        }
      }
    })
  }

  onDeactivated(() => dialogRef.value?.handleClose())
  defineExpose({ handleOpen })
</script>
