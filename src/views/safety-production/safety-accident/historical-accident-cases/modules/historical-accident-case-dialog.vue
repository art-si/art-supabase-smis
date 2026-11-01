<template>
  <ArtDialog
    @open="
      () => {
        activeFormTab = 'identity'
      }
    "
    ref="dialogRef"
    size="xl"
  >
    <div class="historical-case-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:book-open-line" /></template>
        <strong>把事故经过沉淀为可检索、可复用的安全知识</strong>
        <p>事故单位与适用公司均来自系统组织管理，类别支持多选，便于后续统计与精准检索。</p>
      </ArtEntitySummary>

      <ArtForm
        v-model:active-tab="activeFormTab"
        ref="formRef"
        v-model="form"
        :items="items"
        :rules="rules"
        :span="12"
        :gutter="24"
        label-position="top"
      >
        <template #accidentOrganizationId>
          <AccidentOrganizationSelect
            v-model="form.accidentOrganizationId"
            :organizations="organizations"
            title="选择事故单位"
            subtitle="数据来自系统组织管理；可按组织名称或编码检索"
            placeholder="点击选择事故单位"
          />
        </template>
        <template #applicableCompanyId>
          <AccidentOrganizationSelect
            v-model="form.applicableCompanyId"
            :organizations="organizations"
            title="选择适用公司"
            subtitle="选择该案例主要适用的公司或组织范围"
            placeholder="点击选择适用公司"
          />
        </template>
        <template #imageUrls>
          <ArtUploadImage
            v-model="form.imageUrls"
            title="上传事故现场或示意图片"
            multiple
            :limit="9"
            :size="112"
          />
        </template>
        <template #attachmentUrls>
          <ArtUploadFile
            v-model="form.attachmentUrls"
            multiple
            :limit="8"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,image/*"
            tip="支持文档、压缩包和图片，单个文件不超过 20 MB"
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
  import dayjs from 'dayjs'
  import { cloneDeep } from 'lodash-es'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    saveHistoricalAccidentCase,
    type SmisAccidentCaseStatus,
    type SmisAccidentCategory,
    type SmisAccidentLevel,
    type SmisHistoricalAccidentCase,
    type SmisTreeOrganization
  } from '@smis/api'
  import AccidentOrganizationSelect from '../../shared/accident-organization-select.vue'

  export interface HistoricalAccidentCaseDialogOpenData {
    row?: SmisHistoricalAccidentCase
    organizations: SmisTreeOrganization[]
  }
  interface HistoricalAccidentCaseForm {
    id?: string
    accidentName: string
    accidentCategories: SmisAccidentCategory[]
    accidentLevel: SmisAccidentLevel | ''
    accidentOrganizationId?: string
    occurrenceDate: string
    caseStatus: SmisAccidentCaseStatus | ''
    applicableCompanyId?: string
    summary: string
    content: string
    imageUrls: string[]
    attachmentUrls: string[]
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const activeFormTab = ref('identity')
  const dialogRef = ref<ArtDialogExpose<HistoricalAccidentCaseDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const organizations = shallowRef<SmisTreeOrganization[]>([])
  const initialForm = (): HistoricalAccidentCaseForm => ({
    id: undefined,
    accidentName: '',
    accidentCategories: [],
    accidentLevel: '',
    accidentOrganizationId: undefined,
    occurrenceDate: dayjs().format('YYYY-MM-DD'),
    caseStatus: 'in_use',
    applicableCompanyId: undefined,
    summary: '',
    content: '',
    imageUrls: [],
    attachmentUrls: []
  })
  const form = ref<HistoricalAccidentCaseForm>(initialForm())
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const items = computed<FormItem[]>(() => [
    { label: '案例信息', key: 'identity', type: 'tab', span: 24 },
    {
      label: '事故名称',
      key: 'accidentName',
      type: 'input',
      span: 24,
      props: { maxlength: 160, placeholder: '请输入便于识别和检索的事故名称' }
    },
    {
      label: '事故类别',
      key: 'accidentCategories',
      type: 'select',
      span: 24,
      options: dictOptions('smisAccidentCategory'),
      props: {
        multiple: true,
        collapseTags: true,
        collapseTagsTooltip: true,
        clearable: true,
        placeholder: '可多选事故类别'
      }
    },
    {
      label: '事故级别',
      key: 'accidentLevel',
      type: 'select',
      options: dictOptions('smisAccidentLevel'),
      props: { clearable: false, placeholder: '请选择事故级别' }
    },
    {
      label: '发生日期',
      key: 'occurrenceDate',
      type: 'date',
      valueFormat: 'YYYY-MM-DD',
      props: { clearable: false, placeholder: '选择事故发生日期' }
    },
    { label: '事故单位', key: 'accidentOrganizationId', type: 'text' },
    { label: '适用公司', key: 'applicableCompanyId', type: 'text' },
    {
      label: '案例状态',
      key: 'caseStatus',
      type: 'select',
      options: dictOptions('smisAccidentCaseStatus'),
      props: { clearable: true, placeholder: '请选择案例状态' }
    },
    { label: '案例内容', key: 'contentSection', type: 'tab', span: 24 },
    {
      label: '案例概述',
      key: 'summary',
      type: 'textarea',
      span: 24,
      props: {
        rows: 3,
        maxlength: 1000,
        showWordLimit: true,
        resize: 'none',
        placeholder: '概括事故经过、主要原因与关键教训'
      }
    },
    {
      label: '案例正文',
      key: 'content',
      type: 'textarea',
      span: 24,
      props: {
        rows: 8,
        maxlength: 12000,
        showWordLimit: true,
        resize: 'vertical',
        placeholder: '完整记录事故经过、原因分析、处置过程及防范建议'
      }
    },
    { label: '图片资料', key: 'imageUrls', type: 'text', span: 24 },
    { label: '案例附件', key: 'attachmentUrls', type: 'text', span: 24 }
  ])
  const rules: FormRules<HistoricalAccidentCaseForm> = {
    accidentName: [{ required: true, message: '请输入事故名称', trigger: 'blur' }],
    accidentCategories: [{ required: true, message: '请选择至少一个事故类别', trigger: 'change' }],
    accidentLevel: [{ required: true, message: '请选择事故级别', trigger: 'change' }],
    occurrenceDate: [{ required: true, message: '请选择发生日期', trigger: 'change' }],
    content: [{ required: true, message: '请输入案例正文', trigger: 'blur' }]
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await saveHistoricalAccidentCase({
        id: form.value.id,
        accidentName: form.value.accidentName.trim(),
        accidentCategories: [...form.value.accidentCategories],
        accidentLevel: form.value.accidentLevel as SmisAccidentLevel,
        accidentOrganizationId: form.value.accidentOrganizationId || null,
        occurrenceDate: form.value.occurrenceDate,
        caseStatus: (form.value.caseStatus as SmisAccidentCaseStatus) || null,
        applicableCompanyId: form.value.applicableCompanyId || null,
        summary: normalizeNullableText(form.value.summary),
        content: form.value.content.trim(),
        imageUrls: [...form.value.imageUrls],
        attachmentUrls: [...form.value.attachmentUrls]
      })
      emit('success', form.value.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '历史事故案例保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: HistoricalAccidentCaseDialogOpenData): Promise<void> => {
    Object.assign(form.value, initialForm())
    organizations.value = data.organizations
    if (data.row) {
      const row = cloneDeep(data.row)
      Object.assign(form.value, {
        id: row.id,
        accidentName: row.accidentName,
        accidentCategories: [...row.accidentCategories],
        accidentLevel: row.accidentLevel,
        accidentOrganizationId: row.accidentOrganizationId || undefined,
        occurrenceDate: row.occurrenceDate,
        caseStatus: row.caseStatus || '',
        applicableCompanyId: row.applicableCompanyId || undefined,
        summary: row.summary || '',
        content: row.content,
        imageUrls: [...row.imageUrls],
        attachmentUrls: [...row.attachmentUrls]
      })
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑事故案例' : '新增事故案例',
      subtitle: '维护案例分类、组织适用范围与可复用的事故经验',
      contentMaxHeight: 'calc(100vh - 132px)',
      confirmText: data.row ? '保存更改' : '创建事故案例',
      loading: true,
      onOpen: async (_openData, api) => {
        try {
          await Promise.all(
            ['smisAccidentCategory', 'smisAccidentLevel', 'smisAccidentCaseStatus'].map((code) =>
              userStore.ensureDictLoaded(code)
            )
          )
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit,
      onReset: () => Object.assign(form.value, initialForm())
    })
  }

  onDeactivated(() => dialogRef.value?.handleClose())
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .historical-case-dialog {
    min-width: 0;
  }
</style>
