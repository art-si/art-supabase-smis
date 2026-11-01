<template>
  <ArtDialog
    @open="
      () => {
        activeFormTab = 'reporter'
      }
    "
    ref="dialogRef"
    size="xl"
  >
    <div class="public-report-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:megaphone-line" /></template>
        <strong>登记公众反馈并纳入隐患闭环</strong>
        <p>举报人信息用于核实线索；登记操作人由系统自动留痕，保存后状态为待核准。</p>
      </ArtEntitySummary>
      <ArtForm
        v-model:active-tab="activeFormTab"
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
            :organizations="options.organizations"
            title="选择隐患所属部门"
          />
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'

  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import TreeUtils from '@/utils/tree'
  import { useUserStore } from '@/store/modules/user'
  import {
    submitHazardSourceReport,
    type SmisHazardReportingOrganization,
    type SmisHazardReportingSite,
    type SmisHazardSourceReportPayload
  } from '@smis/api'
  import OrganizationTreeSelect from '@smis/views/dual-control-system/shared/organization-tree-select.vue'

  export interface PublicReportDialogOpenData {
    organizations: SmisHazardReportingOrganization[]
    sites: SmisHazardReportingSite[]
  }
  interface PublicReportModel extends SmisHazardSourceReportPayload {
    reportedAt: string
    handlerName: string
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap, getUserInfo } = storeToRefs(userStore)
  const activeFormTab = ref('reporter')
  const dialogRef = ref<ArtDialogExpose<PublicReportDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const options = reactive<{
    organizations: SmisHazardReportingOrganization[]
    sites: SmisHazardReportingSite[]
  }>({
    organizations: [],
    sites: []
  })
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const siteTree = computed(() => treeUtils.listToTree(options.sites) as SmisHazardReportingSite[])
  const initialModel = (): PublicReportModel => ({
    publicReporterName: '',
    publicReporterPhone: '',
    publicReporterIdCard: '',
    publicReporterUnit: '',
    reportedAt: '',
    handlerName: getUserInfo.value.userName || '',
    hazardOrganizationId: '',
    siteId: '',
    location: '',
    hazardLevel: '',
    description: '',
    imageUrls: [],
    rectificationSuggestion: ''
  })
  const form = reactive<{ model: PublicReportModel; rules: FormRules<PublicReportModel> }>({
    model: initialModel(),
    rules: {
      publicReporterName: [{ required: true, message: '请输入举报人姓名', trigger: 'blur' }],
      publicReporterPhone: [
        { pattern: /^1\d{10}$/, message: '请输入正确的手机号码', trigger: 'blur' }
      ],
      hazardOrganizationId: [{ required: true, message: '请选择隐患所属部门', trigger: 'change' }],
      siteId: [{ required: true, message: '请选择场所', trigger: 'change' }],
      location: [{ required: true, message: '请输入隐患位置', trigger: 'blur' }],
      hazardLevel: [{ required: true, message: '请选择隐患级别', trigger: 'change' }],
      description: [{ required: true, message: '请输入隐患描述', trigger: 'blur' }]
    }
  })
  const hazardLevelOptions = computed(() =>
    (getDictMap.value.smisHazardLevel ?? []).map(toDictionaryOption)
  )
  const formItems = computed<FormItem[]>(() => [
    { label: '举报人信息', key: 'reporter', type: 'tab', span: 24 },
    {
      label: '姓名',
      key: 'publicReporterName',
      type: 'input',
      span: 8,
      props: { maxlength: 50, placeholder: '请输入举报人姓名' }
    },
    {
      label: '联系电话',
      key: 'publicReporterPhone',
      type: 'input',
      span: 8,
      props: { maxlength: 20, placeholder: '便于反馈处理进展' }
    },
    {
      label: '身份证号',
      key: 'publicReporterIdCard',
      type: 'input',
      span: 8,
      props: { maxlength: 30, placeholder: '可选填' }
    },
    {
      label: '单位名称',
      key: 'publicReporterUnit',
      type: 'input',
      span: 12,
      props: { maxlength: 100, placeholder: '可选填举报人所在单位' }
    },
    { label: '登记操作人', key: 'handlerName', type: 'input', span: 12, props: { readonly: true } },
    { label: '隐患与证据', key: 'hazard', type: 'tab', span: 24 },
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
          placeholder: '请选择隐患场所'
        }
      }
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
      label: '隐患位置',
      key: 'location',
      type: 'input',
      span: 24,
      props: { maxlength: 200, placeholder: '填写具体区域或点位' }
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
        placeholder: '完整记录公众反映的问题'
      }
    },
    {
      label: '隐患照片',
      key: 'imageUrls',
      span: 24,
      type: 'uploadImage',
      get props(): FormItem['props'] {
        return { title: '上传隐患照片', multiple: true, limit: 9, size: 120 }
      }
    },
    {
      label: '处理建议',
      key: 'rectificationSuggestion',
      type: 'textarea',
      span: 24,
      props: {
        rows: 3,
        maxlength: 1000,
        showWordLimit: true,
        resize: 'none',
        placeholder: '可补充核实情况或先期处置建议'
      }
    }
  ])

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await submitHazardSourceReport('public_report', {
        ...toRaw(form.model),
        description: form.model.description.trim(),
        location: form.model.location.trim(),
        publicReporterName: form.model.publicReporterName?.trim(),
        publicReporterPhone: normalizeNullableText(form.model.publicReporterPhone),
        publicReporterIdCard: normalizeNullableText(form.model.publicReporterIdCard),
        publicReporterUnit: normalizeNullableText(form.model.publicReporterUnit),
        rectificationSuggestion: normalizeNullableText(form.model.rectificationSuggestion),
        imageUrls: [...form.model.imageUrls]
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '公众隐患报告保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: PublicReportDialogOpenData): Promise<void> => {
    Object.assign(form.model, initialModel())
    options.organizations = data.organizations
    options.sites = data.sites
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: '登记公众举报隐患',
      subtitle: '记录举报人、隐患现场与处理建议',
      confirmText: '登记举报隐患',
      contentMaxHeight: 'calc(100vh - 150px)',
      onConfirm: handleSubmit
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .public-report-dialog {
    min-width: 0;

    &__control {
      width: 100%;
    }
  }
</style>
