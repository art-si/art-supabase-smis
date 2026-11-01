<template>
  <ArtDialog ref="dialogRef" size="xl" :loading="loading" @close="closeEditors">
    <div class="hazard-workspace">
      <div class="hazard-workspace__summary">
        <span class="hazard-workspace__summary-icon" aria-hidden="true">
          <ArtSvgIcon icon="ri:git-merge-line" />
        </span>
        <div class="hazard-workspace__summary-copy">
          <strong>{{ riskPoint?.pointName }}</strong>
          <p>{{ riskPoint?.pointNo }} · 建立作业活动与危害因素的多对多关系</p>
        </div>
        <div class="hazard-workspace__counts" aria-label="维护数量概览">
          <span>
            <strong>{{ activities.length }}</strong>
            <small>作业活动</small>
          </span>
          <span>
            <strong>{{ hazards.length }}</strong>
            <small>危害因素</small>
          </span>
        </div>
      </div>

      <div class="hazard-workspace__grid">
        <ArtSectionCard
          class="hazard-workspace__panel"
          title="作业 / 活动信息"
          subtitle="维护作业活动与必经作业步骤"
          :error="error"
          :empty="!loading && !error && !activities.length"
          empty-title="暂无作业活动"
          empty-description="先新增作业活动，再与一个或多个危害因素建立关联。"
          :min-height="430"
          @retry="loadWorkspace"
        >
          <template #actions>
            <ElButton
              v-auth="'SmisDualControlRiskIdentification:MaintainHazards'"
              type="primary"
              plain
              :icon="Plus"
              @click="openActivityEditor()"
            >
              新增作业活动
            </ElButton>
          </template>

          <ol class="hazard-workspace__list" aria-label="作业活动列表">
            <li v-for="(activity, index) in activities" :key="activity.id">
              <article class="hazard-workspace__item">
                <span class="hazard-workspace__sequence" aria-hidden="true">
                  {{ String(index + 1).padStart(2, '0') }}
                </span>
                <div class="hazard-workspace__item-copy">
                  <div class="hazard-workspace__item-title">
                    <strong>{{ activity.activityName }}</strong>
                    <ElTag size="small" effect="plain"
                      >关联 {{ activity.hazardCount }} 条危害</ElTag
                    >
                  </div>
                  <p>{{ activity.workStep }}</p>
                </div>
                <div class="hazard-workspace__row-actions">
                  <ArtButtonTable
                    type="edit"
                    permission="SmisDualControlRiskIdentification:MaintainHazards"
                    label="编辑作业活动"
                    @click="openActivityEditor(activity)"
                  />
                  <ArtButtonTable
                    type="delete"
                    permission="SmisDualControlRiskIdentification:MaintainHazards"
                    label="删除作业活动"
                    @click="removeActivity(activity)"
                  />
                </div>
              </article>
            </li>
          </ol>
        </ArtSectionCard>

        <ArtSectionCard
          class="hazard-workspace__panel"
          title="危害因素"
          subtitle="维护因素类别、事故类型、后果及关联活动"
          :error="error"
          :empty="!loading && !error && !hazards.length"
          empty-title="暂无危害因素"
          empty-description="新增后系统会按风险点编号生成 -WHYS- 三位流水码。"
          :min-height="430"
          @retry="loadWorkspace"
        >
          <template #actions>
            <ElButton
              v-auth="'SmisDualControlRiskIdentification:MaintainHazards'"
              type="primary"
              plain
              :icon="Plus"
              @click="openHazardEditor()"
            >
              新增危害因素
            </ElButton>
          </template>

          <ul class="hazard-workspace__list" aria-label="危害因素列表">
            <li v-for="hazard in hazards" :key="hazard.id">
              <article class="hazard-workspace__item hazard-workspace__item--hazard">
                <span class="hazard-workspace__hazard-icon" aria-hidden="true">
                  <ArtSvgIcon icon="ri:alert-line" />
                </span>
                <div class="hazard-workspace__item-copy">
                  <div class="hazard-workspace__item-title">
                    <strong>{{ hazard.hazardFactor }}</strong>
                    <ElTag size="small" type="warning" effect="plain">
                      {{ hazard.factorCategoryName || '类别未维护' }}
                    </ElTag>
                  </div>
                  <p class="hazard-workspace__code">{{ hazard.hazardNo }}</p>
                  <div class="hazard-workspace__meta">
                    <span class="art-icon-label">
                      <ArtSvgIcon icon="ri:links-line" />
                      关联 {{ hazard.activityIds.length }} 项活动
                    </span>
                    <div class="hazard-workspace__tags">
                      <ArtDictDisplay
                        v-for="value in hazard.accidentTypes.slice(0, 2)"
                        :key="value"
                        dict-code="smisAccidentCategory"
                        :value="value"
                        display="tag"
                      />
                      <ElTag v-if="hazard.accidentTypes.length > 2" size="small" type="info">
                        +{{ hazard.accidentTypes.length - 2 }}
                      </ElTag>
                      <small v-if="!hazard.accidentTypes.length">事故类型未维护</small>
                    </div>
                  </div>
                  <p v-if="hazard.consequence" class="hazard-workspace__consequence">
                    后果及影响：{{ hazard.consequence }}
                  </p>
                </div>
                <div class="hazard-workspace__row-actions">
                  <ArtButtonTable
                    type="edit"
                    permission="SmisDualControlRiskIdentification:MaintainHazards"
                    label="编辑危害因素"
                    @click="openHazardEditor(hazard)"
                  />
                  <ArtButtonTable
                    type="delete"
                    permission="SmisDualControlRiskIdentification:MaintainHazards"
                    label="删除危害因素"
                    @click="removeHazard(hazard)"
                  />
                </div>
              </article>
            </li>
          </ul>
        </ArtSectionCard>
      </div>
    </div>
  </ArtDialog>

  <ArtDialog ref="activityDialogRef" size="sm">
    <div class="hazard-editor">
      <div class="hazard-editor__context">
        <span aria-hidden="true"><ArtSvgIcon icon="ri:route-line" /></span>
        <p>用清晰的动作名称和关键步骤描述本项作业，便于后续准确关联危害因素。</p>
      </div>
      <ArtForm
        ref="activityFormRef"
        v-model="activityForm"
        :items="activityItems"
        :rules="activityRules"
        :span="24"
        root-class="p-0! md:p-0!"
      />
    </div>
  </ArtDialog>

  <ArtDialog ref="hazardDialogRef" size="md">
    <div class="hazard-editor">
      <div class="hazard-editor__context">
        <span aria-hidden="true"><ArtSvgIcon icon="ri:alert-line" /></span>
        <p>先明确危害来源，再补充可能导致的事故、影响后果及相关作业活动。</p>
      </div>
      <ArtForm
        ref="hazardFormRef"
        v-model="hazardForm"
        :items="hazardItems"
        :rules="hazardRules"
        :span="12"
        root-class="p-0! md:p-0!"
      />
    </div>
    <MasterDataDeleteGuard ref="deleteActivityGuardRef" />
    <MasterDataDeleteGuard ref="deleteHazardGuardRef" />
  </ArtDialog>
</template>

<script setup lang="ts">
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'

  import { toDictionaryOption } from '@/utils/form/option'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import { Plus } from '@element-plus/icons-vue'
  import type { FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { notifyFriendlyError, useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { useAuth } from '@/hooks/core/useAuth'
  import { useUserStore } from '@/store/modules/user'
  import {
    deleteRiskActivities,
    deleteRiskHazards,
    fetchRiskHazardWorkspace,
    saveRiskActivity,
    saveRiskHazard,
    voidRiskItems,
    type SmisRiskActivity,
    type SmisRiskHazard,
    type SmisRiskIdentificationOptions,
    type SmisRiskPoint
  } from '@smis/api'
  const { deleteGuardRef: deleteActivityGuardRef, deleteRecords: deleteActivityRecords } =
    useRecordDeleteGuard('smis_risk_activity', '作业活动')
  const { deleteGuardRef: deleteHazardGuardRef, deleteRecords: deleteHazardRecords } =
    useRecordDeleteGuard('smis_risk_item', '危害因素')

  export interface HazardWorkspaceDialogOpenData {
    riskPoint: SmisRiskPoint
    options: SmisRiskIdentificationOptions
    loadOptions?: () => Promise<SmisRiskIdentificationOptions>
  }
  interface ActivityForm {
    id?: string
    activityName: string
    workStep: string
    sort: number
  }
  interface HazardForm {
    id?: string
    hazardNo: string
    hazardFactor: string
    factorCategoryId: string
    accidentTypes: string[]
    consequence: string
    activityIds: string[]
    sort: number
  }

  const emit = defineEmits<{ changed: [] }>()
  const dialogRef = ref<ArtDialogExpose<HazardWorkspaceDialogOpenData>>()
  const activityDialogRef = ref<ArtDialogExpose<SmisRiskActivity | undefined>>()
  const hazardDialogRef = ref<ArtDialogExpose<SmisRiskHazard | undefined>>()
  const activityFormRef = ref<InstanceType<typeof ArtForm>>()
  const hazardFormRef = ref<InstanceType<typeof ArtForm>>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const { confirmAction } = useArtFeedback()
  const { hasAuth } = useAuth()
  const riskPoint = shallowRef<SmisRiskPoint>()
  const options = shallowRef<SmisRiskIdentificationOptions>({
    sites: [],
    organizations: [],
    equipment: [],
    hazardCategories: []
  })
  const activities = shallowRef<SmisRiskActivity[]>([])
  const hazards = shallowRef<SmisRiskHazard[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const activityForm = ref<ActivityForm>({ activityName: '', workStep: '', sort: 0 })
  const hazardForm = ref<HazardForm>({
    hazardNo: '',
    hazardFactor: '',
    factorCategoryId: '',
    accidentTypes: [],
    consequence: '',
    activityIds: [],
    sort: 0
  })
  const activityRules: FormRules<ActivityForm> = {
    activityName: [
      { required: true, whitespace: true, message: '请填写作业活动', trigger: 'blur' }
    ],
    workStep: [{ required: true, whitespace: true, message: '请填写关键作业步骤', trigger: 'blur' }]
  }
  const hazardRules: FormRules<HazardForm> = {
    factorCategoryId: [{ required: true, message: '请选择危害因素类别', trigger: 'change' }],
    hazardFactor: [{ required: true, whitespace: true, message: '请填写危害因素', trigger: 'blur' }]
  }
  const accidentTypeOptions = computed(() =>
    (getDictMap.value.smisAccidentCategory ?? []).map(toDictionaryOption)
  )

  const activityItems: FormItem[] = [
    {
      key: 'activityName',
      label: '作业活动',
      type: 'input',
      formItemProps: { required: true },
      props: { maxlength: 300, showWordLimit: true, placeholder: '例如：设备停机检修' }
    },
    {
      key: 'workStep',
      label: '关键作业步骤',
      type: 'textarea',
      formItemProps: { required: true },
      props: { rows: 5, maxlength: 1000, resize: 'none', placeholder: '按实际顺序描述关键操作步骤' }
    }
  ]
  const hazardItems = computed<FormItem[]>(() => [
    { key: 'hazardNo', label: '危害编号', type: 'text', props: { emptyText: '保存后自动生成' } },
    {
      key: 'factorCategoryId',
      label: '危害因素类别',
      type: 'select',
      formItemProps: { required: true },
      options: options.value.hazardCategories.map((item) => ({
        label: item.categoryName + ' · ' + item.categoryCode,
        value: item.id
      })),
      props: { filterable: true, placeholder: '选择危害因素类别' }
    },
    {
      key: 'hazardFactor',
      label: '危害因素',
      type: 'textarea',
      formItemProps: { required: true },
      props: {
        maxlength: 1500,
        resize: 'none',
        placeholder: '描述人的、物的、环境或管理方面的危害因素'
      }
    },
    {
      key: 'accidentTypes',
      label: '事故类型',
      type: 'select',
      options: accidentTypeOptions.value,
      props: {
        multiple: true,
        filterable: true,
        collapseTags: true,
        collapseTagsTooltip: true,
        placeholder: '选择可能导致的事故类型'
      }
    },
    {
      key: 'activityIds',
      label: '关联作业活动',
      type: 'select',
      options: activities.value.map((item) => ({ label: item.activityName, value: item.id })),
      props: {
        multiple: true,
        filterable: true,
        collapseTags: true,
        collapseTagsTooltip: true,
        placeholder: '选择相关作业活动'
      }
    },
    {
      key: 'consequence',
      label: '后果及影响',
      type: 'textarea',
      props: {
        maxlength: 2000,
        resize: 'none',
        placeholder: '说明可能造成的人员、设备、环境或经营影响'
      }
    }
  ])

  const loadWorkspace = async (): Promise<void> => {
    if (!riskPoint.value) return
    loading.value = true
    error.value = null
    try {
      const workspace = await fetchRiskHazardWorkspace(riskPoint.value.id)
      activities.value = workspace.activities
      hazards.value = workspace.hazards
    } catch {
      error.value = '危害因素数据加载失败，请检查网络后重试。'
    } finally {
      loading.value = false
    }
  }
  const submitActivity = async (): Promise<boolean> => {
    if (!riskPoint.value) {
      ElMessage.warning('风险点已失效，请重新打开后重试')
      return false
    }
    try {
      if (!(await validateArtFormForSubmit(activityFormRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '作业活动校验失败，请重试')
      return false
    }
    try {
      await saveRiskActivity({
        ...toRaw(activityForm.value),
        riskPointId: riskPoint.value.id,
        activityName: activityForm.value.activityName.trim(),
        workStep: activityForm.value.workStep.trim()
      })
    } catch (error) {
      notifyFriendlyError(error, '作业活动保存失败，请检查内容后重试')
      return false
    }
    await loadWorkspace()
    emit('changed')
    return true
  }
  const openActivityEditor = async (row?: SmisRiskActivity): Promise<void> => {
    Object.assign(activityForm.value, {
      id: row?.id,
      activityName: row?.activityName ?? '',
      workStep: row?.workStep ?? '',
      sort: row?.sort ?? activities.value.length * 10
    })
    void nextTick(() => activityFormRef.value?.clearValidate())
    await activityDialogRef.value?.handleOpen(row, {
      title: row ? '编辑作业活动' : '新增作业活动',
      subtitle: row ? row.activityName : '维护活动名称与关键作业步骤',
      confirmText: row ? '保存修改' : '新增活动',
      onConfirm: submitActivity
    })
  }
  const removeActivity = async (row: SmisRiskActivity): Promise<void> => {
    await deleteActivityRecords({
      resources: [{ id: row.id, label: row.activityName }],
      permission: 'SmisDualControlRiskIdentification:MaintainHazards',
      remove: () => deleteRiskActivities([row.id ?? '']),
      onDeleted: async () => {
        await loadWorkspace()
        emit('changed')
      }
    })
  }
  const submitHazard = async (): Promise<boolean> => {
    if (!riskPoint.value) {
      ElMessage.warning('风险点已失效，请重新打开后重试')
      return false
    }
    try {
      if (!(await validateArtFormForSubmit(hazardFormRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '危害因素校验失败，请重试')
      return false
    }
    try {
      await saveRiskHazard({
        id: hazardForm.value.id,
        riskPointId: riskPoint.value.id,
        hazardFactor: hazardForm.value.hazardFactor.trim(),
        factorCategoryId: hazardForm.value.factorCategoryId,
        accidentTypes: [...hazardForm.value.accidentTypes],
        consequence: normalizeNullableText(hazardForm.value.consequence),
        activityIds: [...hazardForm.value.activityIds],
        sort: hazardForm.value.sort
      })
    } catch (error) {
      notifyFriendlyError(error, '危害因素保存失败，请检查内容后重试')
      return false
    }
    await loadWorkspace()
    emit('changed')
    return true
  }
  const openHazardEditor = async (row?: SmisRiskHazard): Promise<void> => {
    Object.assign(hazardForm.value, {
      id: row?.id,
      hazardNo: row?.hazardNo ?? '',
      hazardFactor: row?.hazardFactor ?? '',
      factorCategoryId: row?.factorCategoryId ?? '',
      accidentTypes: [...(row?.accidentTypes ?? [])],
      consequence: row?.consequence ?? '',
      activityIds: [...(row?.activityIds ?? [])],
      sort: row?.sort ?? hazards.value.length * 10
    })
    void nextTick(() => hazardFormRef.value?.clearValidate())
    await hazardDialogRef.value?.handleOpen(row, {
      title: row ? '编辑危害因素' : '新增危害因素',
      subtitle: row?.hazardNo || '完善危害来源、事故类型与关联活动',
      confirmText: row ? '保存修改' : '新增危害因素',
      contentMaxHeight: 'calc(100vh - 170px)',
      onConfirm: submitHazard
    })
  }
  const removeHazard = async (row: SmisRiskHazard): Promise<void> => {
    await deleteHazardRecords({
      resources: [{ id: row.id, label: row.hazardNo }],
      permission: 'SmisDualControlRiskIdentification:MaintainHazards',
      remove: async () => {
        const deletedCount = await deleteRiskHazards([row.id ?? ''])
        if (!deletedCount) {
          if (!hasAuth('SmisDualControlRiskIdentification:Void'))
            throw new Error('该危害因素已进入评价流程，请联系有作废权限的人员处理')
          await confirmAction(
            `危害因素“${row.hazardNo}”已有评价记录，无法物理删除。是否改为作废并保留审计链？`,
            '作废危害因素'
          )
          await voidRiskItems([row.id ?? ''])
        }
      },
      onDeleted: async () => {
        await loadWorkspace()
        emit('changed')
      }
    })
  }
  const closeEditors = (): void => {
    activityDialogRef.value?.handleClose()
    hazardDialogRef.value?.handleClose()
  }
  const handleOpen = async (data: HazardWorkspaceDialogOpenData): Promise<void> => {
    riskPoint.value = data.riskPoint
    options.value = data.options
    await dialogRef.value?.handleOpen(data, {
      title: '维护危害因素',
      subtitle: `${data.riskPoint.pointNo} · ${data.riskPoint.pointName}`,
      confirmText: '完成维护',
      contentMaxHeight: 'calc(100vh - 150px)',
      onConfirm: () => true,
      onOpen: async (_data, api) => {
        api.setLoading(true)
        try {
          await Promise.all([
            loadWorkspace(),
            userStore.ensureDictLoaded('smisAccidentCategory'),
            ...(!data.options.hazardCategories.length && data.loadOptions
              ? [data.loadOptions().then((loaded) => (options.value = loaded))]
              : [])
          ])
        } finally {
          api.setLoading(false)
        }
      }
    })
  }
  onDeactivated(() => {
    closeEditors()
    dialogRef.value?.handleClose()
  })
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .hazard-workspace {
    min-width: 0;

    &__summary {
      display: grid;
      grid-template-columns: 48px minmax(0, 1fr) auto;
      gap: var(--art-space-3);
      align-items: center;
      padding: var(--art-space-3) var(--art-space-4);
      margin-bottom: var(--art-space-4);
      background: color-mix(in srgb, var(--theme-color) 6%, var(--el-fill-color-blank));
      border: 1px solid color-mix(in srgb, var(--theme-color) 16%, var(--el-border-color-light));
      border-radius: var(--el-border-radius-base);
    }

    &__summary-icon {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      font-size: 22px;
      color: var(--theme-color);
      background: var(--el-fill-color-blank);
      border-radius: var(--el-border-radius-base);
      box-shadow: var(--art-card-shadow);
    }

    &__summary-copy {
      min-width: 0;

      strong {
        font-size: var(--art-font-size-section-title);
      }

      p {
        margin: var(--art-space-1) 0 0;
        font-size: var(--art-font-size-caption);
        color: var(--el-text-color-secondary);
      }
    }

    &__counts {
      display: flex;
      gap: var(--art-space-2);

      span {
        display: grid;
        min-width: 84px;
        padding: var(--art-space-2) var(--art-space-3);
        text-align: center;
        background: var(--el-fill-color-blank);
        border: 1px solid var(--el-border-color-lighter);
        border-radius: var(--el-border-radius-base);
      }

      strong {
        color: var(--theme-color);
      }

      small {
        color: var(--el-text-color-secondary);
      }
    }

    &__grid {
      display: grid;
      grid-template-columns: minmax(360px, 0.9fr) minmax(520px, 1.25fr);
      gap: var(--art-space-4);
      min-width: 0;
    }

    &__panel :deep(.art-section-card__scrollbar) {
      flex: none;
      height: min(450px, calc(100vh - 360px));
    }

    &__list {
      display: grid;
      gap: var(--art-space-2);
      padding: 0;
      margin: 0;
      list-style: none;
    }

    &__item {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) auto;
      gap: var(--art-space-3);
      align-items: start;
      padding: var(--art-space-3);
      background: var(--el-fill-color-blank);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
      transition:
        border-color var(--art-motion-duration-fast) ease,
        box-shadow var(--art-motion-duration-fast) ease;

      &:hover {
        border-color: color-mix(in srgb, var(--theme-color) 28%, var(--el-border-color));
        box-shadow: var(--art-card-shadow);
      }
    }

    &__sequence,
    &__hazard-icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      font-weight: 600;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, var(--el-fill-color-blank));
      border-radius: var(--el-border-radius-base);
    }

    &__hazard-icon {
      color: var(--el-color-warning);
      background: color-mix(in srgb, var(--el-color-warning) 10%, var(--el-fill-color-blank));
    }

    &__item-copy {
      display: grid;
      gap: var(--art-space-1);
      min-width: 0;

      > p {
        display: -webkit-box;
        margin: 0;
        overflow: hidden;
        -webkit-line-clamp: 2;
        font-size: var(--art-font-size-caption);
        line-height: 20px;
        color: var(--el-text-color-secondary);
        -webkit-box-orient: vertical;
      }
    }

    &__item-title {
      display: flex;
      gap: var(--art-space-2);
      align-items: center;
      justify-content: space-between;
      min-width: 0;

      strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &__code {
      color: var(--theme-color) !important;
    }

    &__meta,
    &__tags,
    &__row-actions {
      display: flex;
      gap: var(--art-space-2);
      align-items: center;
      min-width: 0;
    }

    &__meta {
      flex-wrap: wrap;
      justify-content: space-between;
      margin-top: var(--art-space-1);

      > span {
        display: inline-flex;
        gap: var(--art-space-1);
        align-items: center;
        font-size: var(--art-font-size-caption);
        color: var(--el-text-color-secondary);
      }
    }

    &__tags {
      flex-wrap: wrap;

      small {
        color: var(--el-text-color-placeholder);
      }
    }

    &__consequence {
      padding-top: var(--art-space-2);
      margin-top: var(--art-space-1) !important;
      border-top: 1px dashed var(--el-border-color-lighter);
    }

    &__row-actions {
      gap: var(--art-space-1);

      :deep(.art-button-table) {
        margin-right: 0;
      }
    }
  }

  .hazard-editor {
    display: grid;
    gap: var(--art-space-4);

    &__context {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr);
      gap: var(--art-space-3);
      align-items: center;
      padding: var(--art-space-3);
      background: color-mix(in srgb, var(--theme-color) 6%, var(--el-fill-color-blank));
      border: 1px solid color-mix(in srgb, var(--theme-color) 15%, var(--el-border-color-light));
      border-radius: var(--el-border-radius-base);

      span {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        color: var(--theme-color);
        background: var(--el-fill-color-blank);
        border-radius: var(--el-border-radius-base);
      }

      p {
        margin: 0;
        font-size: var(--art-font-size-caption);
        line-height: 20px;
        color: var(--el-text-color-secondary);
      }
    }

    &__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--art-space-4);
    }
  }

  @media (width <= 1080px) {
    .hazard-workspace {
      &__grid {
        grid-template-columns: minmax(0, 1fr);
      }

      &__panel :deep(.art-section-card__scrollbar) {
        height: 340px;
      }
    }
  }

  @media (width <= 680px) {
    .hazard-workspace {
      &__summary {
        grid-template-columns: 40px minmax(0, 1fr);
      }

      &__counts {
        grid-column: 1 / -1;
      }

      &__item,
      &__item--hazard {
        grid-template-columns: 36px minmax(0, 1fr);
      }

      &__row-actions {
        grid-column: 2;
      }
    }

    .hazard-editor__grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 0;
    }
  }
</style>
