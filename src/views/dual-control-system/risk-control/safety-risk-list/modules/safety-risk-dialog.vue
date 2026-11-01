<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="safety-risk-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:shield-check-line" /></template>
        <strong>风险点与危害因素一体维护</strong>
        <p>危险编号由系统生成；完成定量评价后，该记录进入分级管控与巡查任务链路。</p>
      </ArtEntitySummary>

      <ArtForm custom-layout ref="formRef" v-model="form" :rules="rules" label-position="top">
        <ArtSectionTitle title="风险身份" subtitle="选择已有风险点并明确危险源类别" />
        <div class="safety-risk-dialog__grid">
          <ElFormItem label="危险编号">
            <ElInput :model-value="row?.hazardNo || ''" disabled placeholder="保存后自动生成" />
          </ElFormItem>
          <ElFormItem label="关联风险点" prop="riskPointId">
            <ElSelect
              v-model="form.riskPointId"
              class="w-full"
              filterable
              placeholder="按编号或名称选择风险点"
              @change="handleRiskPointChange"
            >
              <ElOption
                v-for="item in options.riskPoints"
                :key="item.id"
                :label="`${item.pointName} · ${item.pointNo}`"
                :value="item.id"
              >
                <div class="safety-risk-dialog__option">
                  <strong>{{ item.pointName }}</strong
                  ><small>{{ item.pointNo }} · {{ item.siteName }}</small>
                </div>
              </ElOption>
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="危险源 / 危害因素" prop="hazardFactor">
            <ElInput
              v-model="form.hazardFactor"
              maxlength="500"
              placeholder="描述具体危险源或危害因素"
            />
          </ElFormItem>
          <ElFormItem label="危害因素类别">
            <ElSelect v-model="form.factorCategoryId" class="w-full" clearable filterable>
              <ElOption
                v-for="item in options.hazardCategories"
                :key="item.id"
                :label="item.categoryName"
                :value="item.id"
              />
            </ElSelect>
          </ElFormItem>
        </div>

        <ArtSectionTitle title="事故后果" subtitle="描述可能事故类型、风险后果和关联作业活动" />
        <div class="safety-risk-dialog__grid">
          <ElFormItem class="safety-risk-dialog__wide" label="事故类型">
            <ElSelect
              v-model="form.accidentTypes"
              class="w-full"
              multiple
              collapse-tags
              collapse-tags-tooltip
              clearable
              placeholder="可选择多个事故类型"
            >
              <ElOption v-for="item in accidentTypeOptions" :key="item.value" v-bind="item" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem class="safety-risk-dialog__wide" label="风险描述 / 可能后果">
            <ElInput
              v-model="form.consequence"
              type="textarea"
              :rows="4"
              maxlength="2000"
              show-word-limit
              placeholder="说明风险触发条件、可能后果及影响范围"
            />
          </ElFormItem>
          <ElFormItem class="safety-risk-dialog__wide" label="关联作业活动">
            <ElSelect
              v-model="form.activityIds"
              class="w-full"
              multiple
              collapse-tags
              collapse-tags-tooltip
              clearable
              :loading="activityLoading"
              :disabled="!form.riskPointId"
              placeholder="选择该风险点下的作业活动"
            >
              <ElOption
                v-for="item in activities"
                :key="item.id"
                :label="`${item.activityName} · ${item.workStep}`"
                :value="item.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="排序">
            <ElInputNumber v-model="form.sort" :min="0" :max="9999" class="w-full" />
          </ElFormItem>
        </div>
      </ArtForm>
    </div>

    <template #footer="{ api }">
      <ElButton @click="api.handleClose()">取消</ElButton>
      <ElButton
        v-auth="row ? 'SmisDualControlSafetyRiskList:Edit' : 'SmisDualControlSafetyRiskList:Add'"
        type="primary"
        :loading="submitting"
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
  import ArtForm from '@/components/core/forms/art-form/index.vue'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
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

<style scoped lang="scss">
  .safety-risk-dialog {
    &__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0 24px;
      margin: 12px 0 20px;
    }

    &__wide {
      grid-column: 1 / -1;
    }

    &__option {
      display: flex;
      gap: 16px;
      justify-content: space-between;
      width: 100%;
    }

    &__option small {
      color: var(--el-text-color-secondary);
    }
  }

  @media (width <= 760px) {
    .safety-risk-dialog__grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .safety-risk-dialog__wide {
      grid-column: auto;
    }
  }
</style>
