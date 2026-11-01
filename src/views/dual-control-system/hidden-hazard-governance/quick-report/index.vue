<template>
  <ArtPermissionGuard permission="SmisDualControlQuickReport:View" resource-name="随手拍">
    <div class="quick-report-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="QUICK HAZARD REPORT"
        title="随手拍"
        description="登录人信息自动取自员工花名册，补充隐患部门、场所、位置和现场照片即可上报。"
        icon="ri:camera-lens-line"
        density="compact"
        :tags="[
          { label: '实名自动带入', type: 'primary', effect: 'plain' },
          { label: '现场图片取证', type: 'success', effect: 'light' },
          { label: '提交即进入待核准', type: 'warning', effect: 'plain' }
        ]"
      />

      <ElScrollbar class="quick-report-page__scrollbar" always>
        <div class="quick-report-page__content">
          <div class="quick-report-page__layout">
            <ArtSectionCard
              class="quick-report-page__reporter-card"
              title="上报人信息"
              :subtitle="
                state.profile?.isEmployeeLinked
                  ? '员工花名册实名信息自动带入，不支持手工篡改'
                  : '当前账号未关联员工，提交时将使用系统账号完成审计留痕'
              "
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.profile"
              empty-title="上报人信息不可用"
              empty-description="请刷新页面重试；若仍无法加载，请检查当前系统账号状态。"
              @retry="loadOptions"
            >
              <div v-if="state.profile" class="quick-report-page__identity">
                <div class="quick-report-page__identity-head">
                  <div class="quick-report-page__avatar" aria-hidden="true">
                    {{ state.profile.employeeName.slice(0, 1) }}
                  </div>
                  <div class="quick-report-page__person">
                    <strong>{{ state.profile.employeeName }}</strong>
                    <span>{{ state.profile.employeeNo }}</span>
                  </div>
                  <ElTag
                    size="small"
                    :type="state.profile.isEmployeeLinked ? 'success' : 'warning'"
                    effect="light"
                  >
                    {{ state.profile.isEmployeeLinked ? '花名册已关联' : '系统账号' }}
                  </ElTag>
                </div>
                <dl>
                  <div
                    ><dt>身份证号</dt><dd>{{ state.profile.idCardNo || '员工未关联' }}</dd></div
                  >
                  <div
                    ><dt>联系电话</dt><dd>{{ state.profile.phone || '员工未关联' }}</dd></div
                  >
                  <div
                    ><dt>所属部门</dt
                    ><dd>{{ state.profile.organizationName || '未分配部门' }}</dd></div
                  >
                </dl>
                <p v-if="!state.profile.isEmployeeLinked" class="quick-report-page__identity-tip">
                  <ArtSvgIcon icon="ri:information-line" />
                  关联员工后，可自动带入身份证号、电话和所属部门。
                </p>
              </div>
            </ArtSectionCard>

            <ArtSectionCard
              class="quick-report-page__form-card"
              title="隐患现场"
              subtitle="带 * 的信息为提交必填项；隐患编号保存后自动生成"
              :loading="state.loading"
              :error="state.error"
              @retry="loadOptions"
            >
              <ArtForm
                ref="formRef"
                v-model="form.model"
                :items="formItems"
                :rules="form.rules"
                :span="12"
                :gutter="24"
                label-position="top"
              >
                <template #hazardOrganizationId>
                  <OrganizationTreeSelect
                    v-model="form.model.hazardOrganizationId"
                    :organizations="state.organizations"
                    title="选择隐患所属部门"
                  />
                </template>
              </ArtForm>
              <HazardAiAnalysisPanel
                ref="aiPanelRef"
                :image-urls="form.model.imageUrls"
                :organization-name="selectedOrganizationName"
                :site-name="selectedSiteName"
                :location="form.model.location"
                :existing-description="form.model.description"
                :hazard-level-options="hazardLevelOptions"
                @apply="applyAiSuggestion"
              />
              <div class="quick-report-page__actions">
                <p
                  ><ArtSvgIcon
                    icon="ri:information-line"
                  />照片和描述将作为后续核准、整改、验收的原始证据。</p
                >
                <div>
                  <ElButton @click="resetForm">清空内容</ElButton>
                  <ElButton
                    v-auth="'SmisDualControlQuickReport:Submit'"
                    type="primary"
                    :loading="state.submitting"
                    :disabled="state.loading || !state.profile"
                    @click="submit"
                  >
                    提交随手拍
                  </ElButton>
                </div>
              </div>
            </ArtSectionCard>
          </div>
        </div>
      </ElScrollbar>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'

  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import { ElMessage, type FormRules } from 'element-plus'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import TreeUtils from '@/utils/tree'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchHazardReportingOptions,
    reviewHazardImageAnalysis,
    submitHazardSourceReport,
    type SmisHazardImageAnalysisResponse,
    type SmisHazardReporterProfile,
    type SmisHazardReportingOrganization,
    type SmisHazardReportingSite,
    type SmisHazardSourceReportPayload
  } from '@smis/api'
  import OrganizationTreeSelect from '@smis/views/dual-control-system/shared/organization-tree-select.vue'
  import HazardAiAnalysisPanel from './modules/hazard-ai-analysis-panel.vue'

  defineOptions({ name: 'SmisDualControlQuickReport' })

  interface QuickReportModel extends SmisHazardSourceReportPayload {
    hazardNo: string
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }
  interface AiPanelExpose {
    reset: () => void
  }

  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const formRef = ref<FormExpose>()
  const aiPanelRef = ref<AiPanelExpose>()
  const initialModel = (): QuickReportModel => ({
    hazardNo: '',
    hazardOrganizationId: '',
    siteId: '',
    location: '',
    hazardLevel: '',
    description: '',
    imageUrls: [],
    rectificationSuggestion: ''
  })
  const form = reactive<{ model: QuickReportModel; rules: FormRules<QuickReportModel> }>({
    model: initialModel(),
    rules: {
      hazardOrganizationId: [{ required: true, message: '请选择隐患所属部门', trigger: 'change' }],
      siteId: [{ required: true, message: '请选择场所', trigger: 'change' }],
      location: [{ required: true, message: '请输入隐患位置', trigger: 'blur' }],
      hazardLevel: [{ required: true, message: '请选择隐患级别', trigger: 'change' }],
      description: [{ required: true, message: '请输入隐患描述', trigger: 'blur' }],
      imageUrls: [{ type: 'array', required: true, min: 1, message: '请至少上传一张隐患照片' }]
    }
  })
  const state = reactive<{
    profile: SmisHazardReporterProfile | null
    organizations: SmisHazardReportingOrganization[]
    sites: SmisHazardReportingSite[]
    loading: boolean
    submitting: boolean
    aiArtifactId: string
    error: string
  }>({
    profile: null,
    organizations: [],
    sites: [],
    loading: false,
    submitting: false,
    aiArtifactId: '',
    error: ''
  })
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const siteTree = computed(() => treeUtils.listToTree(state.sites) as SmisHazardReportingSite[])
  const hazardLevelOptions = computed(() =>
    (getDictMap.value.smisHazardLevel ?? []).map(toDictionaryOption)
  )
  const selectedOrganizationName = computed(
    () =>
      state.organizations.find((item) => item.id === form.model.hazardOrganizationId)
        ?.organizationName ?? ''
  )
  const selectedSiteName = computed(
    () => state.sites.find((item) => item.id === form.model.siteId)?.siteName ?? ''
  )
  const formItems = computed<FormItem[]>(() => [
    {
      label: '隐患编号',
      key: 'hazardNo',
      type: 'input',
      span: 8,
      description: '保存后按 YH + 年月 + 四位流水生成',
      props: { readonly: true, placeholder: '保存后自动生成' }
    },
    { label: '隐患所属部门', key: 'hazardOrganizationId', type: 'text', span: 8 },
    {
      label: '场所',
      key: 'siteId',
      span: 8,
      type: 'treeSelect',
      get props(): FormItem['props'] {
        return {
          data: siteTree.value,
          props: { label: 'siteName', children: 'children' },
          nodeKey: 'id',
          valueKey: 'id',
          checkStrictly: true,
          filterable: true,
          defaultExpandAll: true,
          placeholder: '请选择场所'
        }
      }
    },
    {
      label: '隐患位置',
      key: 'location',
      type: 'input',
      span: 16,
      props: { maxlength: 200, placeholder: '填写楼层、区域、设备点位等具体位置' }
    },
    {
      label: '隐患级别',
      key: 'hazardLevel',
      type: 'select',
      span: 8,
      options: hazardLevelOptions.value,
      props: { placeholder: '请选择隐患级别' }
    },
    {
      label: '隐患描述',
      key: 'description',
      type: 'textarea',
      span: 24,
      props: {
        rows: 4,
        maxlength: 1000,
        showWordLimit: true,
        resize: 'none',
        placeholder: '描述现场现象、风险和可能后果'
      }
    },
    {
      label: '隐患照片',
      key: 'imageUrls',
      span: 24,
      type: 'uploadImage',
      get props(): FormItem['props'] {
        return { title: '上传隐患照片', multiple: true, limit: 9, size: 132 }
      }
    },
    {
      label: '整改建议',
      key: 'rectificationSuggestion',
      type: 'textarea',
      span: 24,
      props: {
        rows: 3,
        maxlength: 1000,
        showWordLimit: true,
        resize: 'none',
        placeholder: '可填写建议采取的临时控制或整改措施'
      }
    }
  ])

  const resetForm = (): void => {
    Object.assign(form.model, initialModel())
    state.aiArtifactId = ''
    aiPanelRef.value?.reset()
    nextTick(() => formRef.value?.clearValidate())
  }
  const applyAiSuggestion = (result: SmisHazardImageAnalysisResponse): void => {
    const appliedFields: string[] = []
    if (!form.model.description.trim() && result.hazard.description) {
      form.model.description = result.hazard.description
      appliedFields.push('隐患描述')
    }
    if (
      !form.model.hazardLevel &&
      result.hazard.hazardLevel &&
      hazardLevelOptions.value.some((item) => item.value === result.hazard.hazardLevel)
    ) {
      form.model.hazardLevel = result.hazard.hazardLevel
      appliedFields.push('隐患级别')
    }
    if (!form.model.rectificationSuggestion?.trim() && result.hazard.rectificationSuggestion) {
      form.model.rectificationSuggestion = result.hazard.rectificationSuggestion
      appliedFields.push('整改建议')
    }
    state.aiArtifactId = result.artifactId
    ElMessage.success(
      appliedFields.length
        ? `已补充${appliedFields.join('、')}，请人工复核`
        : '当前字段已有内容，AI 建议未覆盖人工填写'
    )
  }
  const loadOptions = async (): Promise<void> => {
    state.loading = true
    state.error = ''
    try {
      await userStore.ensureDictLoaded('smisHazardLevel')
      const options = await fetchHazardReportingOptions()
      state.profile = options.profile
      state.organizations = options.organizations
      state.sites = options.sites
    } catch (error) {
      state.error = getFriendlySupabaseErrorMessage(error, '上报基础数据加载失败')
    } finally {
      state.loading = false
    }
  }
  const submit = async (): Promise<void> => {
    if (state.submitting) return
    try {
      await formRef.value?.validate()
      state.submitting = true
      const response = await submitHazardSourceReport('quick_report', {
        ...toRaw(form.model),
        description: form.model.description.trim(),
        location: form.model.location.trim(),
        rectificationSuggestion: normalizeNullableText(form.model.rectificationSuggestion),
        imageUrls: [...form.model.imageUrls]
      })
      if (state.aiArtifactId && response.data?.id) {
        const review = await reviewHazardImageAnalysis({
          artifactId: state.aiArtifactId,
          entityId: response.data.id,
          finalPayload: {
            description: form.model.description.trim(),
            hazardLevel: form.model.hazardLevel,
            rectificationSuggestion: normalizeNullableText(form.model.rectificationSuggestion)
          }
        })
        if (review.error) console.warn('隐患 AI 分析反馈记录失败', review.error)
      }
      resetForm()
    } finally {
      state.submitting = false
    }
  }

  onMounted(loadOptions)
</script>

<style scoped lang="scss">
  .quick-report-page {
    min-width: 0;
    overflow: hidden;

    &__scrollbar {
      flex: 1 1 auto;
      min-height: 0;
    }

    &__content {
      min-width: 0;
      min-height: 100%;
      padding-right: 2px;
      padding-bottom: var(--art-space-3);
    }

    &__layout {
      display: grid;
      grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
      gap: var(--art-space-3);
      align-items: start;
      min-width: 0;
    }

    &__reporter-card {
      position: sticky;
      top: 0;
    }

    &__identity {
      display: grid;
      gap: var(--art-space-3);
    }

    &__identity-head {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr) auto;
      gap: var(--art-space-3);
      align-items: center;
    }

    &__avatar {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      font-size: 20px;
      font-weight: 700;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
      border-radius: var(--el-border-radius-base);
    }

    &__person {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    &__person strong {
      font-size: 17px;
      color: var(--el-text-color-primary);
    }

    &__person span {
      color: var(--el-text-color-secondary);
    }

    &__identity-tip {
      display: flex;
      gap: var(--art-space-2);
      align-items: flex-start;
      padding: var(--art-space-3);
      margin: 0;
      font-size: var(--art-font-size-caption);
      line-height: 1.6;
      color: var(--el-text-color-secondary);
      background: color-mix(in srgb, var(--el-color-warning) 7%, var(--default-box-color));
      border: 1px solid color-mix(in srgb, var(--el-color-warning) 18%, transparent);
      border-radius: var(--el-border-radius-base);
    }

    dl {
      display: grid;
      gap: var(--art-space-2);
      margin: 0;
    }

    dl > div {
      padding: var(--art-space-3);
      background: var(--art-gray-100);
      border-radius: var(--el-border-radius-base);
    }

    dt {
      margin-bottom: 4px;
      font-size: var(--art-font-size-caption);
      color: var(--el-text-color-secondary);
    }

    dd {
      margin: 0;
      color: var(--el-text-color-primary);
      overflow-wrap: anywhere;
    }

    &__control {
      width: 100%;
    }

    &__actions {
      position: sticky;
      bottom: 0;
      z-index: 2;
      display: flex;
      gap: var(--art-space-4);
      align-items: center;
      justify-content: space-between;
      padding: var(--art-space-4) 0 var(--art-space-2);
      margin-top: var(--art-space-2);
      background: var(--default-box-color);
      border-top: 1px solid var(--el-border-color-lighter);
      box-shadow: 0 -8px 18px color-mix(in srgb, var(--el-text-color-primary) 4%, transparent);
    }

    &__actions p {
      display: flex;
      gap: var(--art-space-2);
      align-items: center;
      margin: 0;
      color: var(--el-text-color-secondary);
    }

    @media (width <= 980px) {
      &__layout {
        grid-template-columns: 1fr;
      }

      &__reporter-card {
        position: static;
      }
    }

    @media (width <= 640px) {
      &__actions {
        flex-direction: column;
        align-items: stretch;
      }

      &__actions > div {
        display: flex;
        justify-content: flex-end;
      }
    }
  }
</style>
