<template>
  <ArtDialog
    @open="
      () => {
        activeFormTab = 'baseSection'
      }
    "
    ref="dialogRef"
    size="full"
  >
    <div class="announcement-editor-dialog">
      <ArtForm
        v-model:active-tab="activeFormTab"
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="24"
        label-position="top"
      >
        <template #contentHtml>
          <ArtTiptapEditor
            v-model="form.model.contentHtml"
            height="340px"
            placeholder="请输入公告正文，可使用标题、列表、表格与链接组织内容…"
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
  import DOMPurify from 'dompurify'
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtTiptapEditor from '@/components/core/forms/art-tiptap-editor/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    saveAnnouncement,
    type SmisAnnouncement,
    type SmisAnnouncementCategoryOption,
    type SmisAnnouncementOrganization,
    type SmisAnnouncementSavePayload
  } from '@smis/api'

  export interface AnnouncementEditorDialogOpenData {
    row?: SmisAnnouncement
    categories: SmisAnnouncementCategoryOption[]
    organizations: SmisAnnouncementOrganization[]
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const activeFormTab = ref('baseSection')
  const dialogRef = ref<ArtDialogExpose<AnnouncementEditorDialogOpenData>>()
  const recordTenantId = ref<string>()
  const formRef = ref<FormExpose>()
  const categories = shallowRef<SmisAnnouncementCategoryOption[]>([])
  const organizations = shallowRef<SmisAnnouncementOrganization[]>([])
  const employeeSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const organizationTreeProps = { children: 'children', label: 'organizationName', value: 'id' }

  const createInitialForm = (): SmisAnnouncementSavePayload => ({
    id: undefined,
    operation: 'add',
    categoryId: '',
    title: '',
    contentHtml: '',
    contentText: '',
    audienceType: 'all',
    audienceEmployeeIds: [],
    audienceOrganizationIds: [],
    effectiveStartDate: dayjs().format('YYYY-MM-DD'),
    effectiveEndDate: null,
    isPinned: false,
    attachmentUrls: []
  })
  const categoryOptions = computed<FormItemOption[]>(() =>
    categories.value.map((item) => ({ label: item.categoryName, value: item.id }))
  )
  const audienceOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.smisAnnouncementAudienceType ?? []).map(toDictionaryOption)
  )
  const announcementModel = reactive<SmisAnnouncementSavePayload>(createInitialForm())
  const form = reactive<{
    model: SmisAnnouncementSavePayload
    items: ComputedRef<FormItem[]>
    rules: FormRules<SmisAnnouncementSavePayload>
  }>({
    model: announcementModel,
    items: computed(() => [
      { label: '公告信息', key: 'baseSection', type: 'tab', span: 24 },
      {
        label: '公告标题',
        key: 'title',
        type: 'input',
        span: 16,
        props: {
          maxlength: 200,
          showWordLimit: true,
          placeholder: '请输入准确、便于检索的公告标题'
        }
      },
      {
        label: '公告分类',
        key: 'categoryId',
        type: 'select',
        span: 8,
        options: categoryOptions.value,
        props: { filterable: true, clearable: true, placeholder: '请选择公告分类' }
      },
      {
        label: '生效日期',
        key: 'effectiveStartDate',
        type: 'date',
        span: 8,
        props: { type: 'date', valueFormat: 'YYYY-MM-DD', class: '!w-full' }
      },
      {
        label: '结束日期',
        key: 'effectiveEndDate',
        type: 'date',
        span: 8,
        props: {
          type: 'date',
          valueFormat: 'YYYY-MM-DD',
          clearable: true,
          class: '!w-full',
          placeholder: '长期有效可不填'
        }
      },
      {
        label: '置顶显示',
        key: 'isPinned',
        type: 'switch',
        span: 8,
        props: { inlinePrompt: true, activeText: '是', inactiveText: '否' }
      },
      { label: '公告正文', key: 'contentSection', type: 'tab', span: 24 },
      { label: '内容', key: 'contentHtml', type: 'text', span: 24 },
      { label: '范围与附件', key: 'scopeSection', type: 'tab', span: 24 },
      {
        label: '发布范围',
        key: 'audienceType',
        type: 'radioGroup',
        span: 24,
        options: audienceOptions.value,
        props: { optionType: 'button' }
      },
      {
        label: '指定人员',
        key: 'audienceEmployeeIds',
        span: 24,
        hidden: announcementModel.audienceType !== 'employees',
        type: 'employeeSelect',
        get props(): FormItem['props'] {
          return {
            multiple: true,
            modelValues: form.model.audienceEmployeeIds,
            'onUpdate:modelValues': ($event: typeof form.model.audienceEmployeeIds) => {
              form.model.audienceEmployeeIds = $event
            },
            selectedData: employeeSelection.value,
            'onUpdate:selectedData': ($event: typeof employeeSelection.value) => {
              employeeSelection.value = $event
            },
            tenantId: recordTenantId.value,
            title: '选择公告接收人员',
            placeholder: '从员工花名册批量选择',
            displayFields: ['organization', 'jobTitle']
          }
        }
      },
      {
        label: '指定组织',
        key: 'audienceOrganizationIds',
        span: 24,
        hidden: announcementModel.audienceType !== 'organizations',
        type: 'treeSelect',
        get props(): FormItem['props'] {
          return {
            data: organizations.value,
            props: organizationTreeProps,
            nodeKey: 'id',
            valueKey: 'id',
            multiple: true,
            showCheckbox: true,
            checkStrictly: true,
            collapseTags: true,
            collapseTagsTooltip: true,
            maxCollapseTags: 3,
            filterable: true,
            clearable: true,
            defaultExpandAll: true,
            placeholder: '选择一个或多个发布组织'
          }
        }
      },
      {
        label: '相关附件',
        key: 'attachmentUrls',
        span: 24,
        type: 'uploadFile',
        get props(): FormItem['props'] {
          return {
            multiple: true,
            limit: 20,
            accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,image/*',
            tip: '支持文档、表格、演示稿、压缩包和图片，最多 20 个附件'
          }
        }
      }
    ]),
    rules: {
      title: [
        { required: true, message: '请输入公告标题', trigger: 'blur' },
        { max: 200, message: '公告标题不能超过 200 个字符', trigger: 'blur' }
      ],
      categoryId: [{ required: true, message: '请选择公告分类', trigger: 'change' }],
      effectiveStartDate: [{ required: true, message: '请选择生效日期', trigger: 'change' }],
      contentHtml: [{ required: true, message: '请输入公告正文', trigger: 'change' }],
      audienceType: [{ required: true, message: '请选择发布范围', trigger: 'change' }],
      audienceEmployeeIds: [
        {
          validator: (_rule, value, callback) => {
            if (
              announcementModel.audienceType === 'employees' &&
              (!Array.isArray(value) || value.length === 0)
            )
              callback(new Error('请至少选择一名接收人员'))
            else callback()
          },
          trigger: 'change'
        }
      ],
      audienceOrganizationIds: [
        {
          validator: (_rule, value, callback) => {
            if (
              announcementModel.audienceType === 'organizations' &&
              (!Array.isArray(value) || value.length === 0)
            )
              callback(new Error('请至少选择一个接收组织'))
            else callback()
          },
          trigger: 'change'
        }
      ]
    }
  })

  const toEmployeeSelection = (row: SmisAnnouncement): EmployeeIntegrationItem[] =>
    row.audienceEmployees.map((person) => ({
      id: person.id,
      tenantId: row.tenantId,
      employeeNo: person.employeeNo,
      employeeName: person.employeeName,
      employmentStatus: 'active',
      organization: person.organizationName
        ? { id: '', organizationCode: '', organizationName: person.organizationName }
        : null
    }))
  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, createInitialForm())
    employeeSelection.value = []
    await nextTick()
    formRef.value?.clearValidate()
  }
  const extractText = (html: string): string => {
    const container = document.createElement('div')
    container.innerHTML = DOMPurify.sanitize(html)
    return (container.textContent || '').replace(/\s+/g, ' ').trim()
  }
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const cleanHtml = DOMPurify.sanitize(form.model.contentHtml)
      const contentText = extractText(cleanHtml)
      if (!contentText) {
        ElMessage.warning('请输入有效公告正文')
        return false
      }
      await saveAnnouncement({
        ...toRaw(form.model),
        contentHtml: cleanHtml,
        contentText,
        title: form.model.title.trim(),
        effectiveEndDate: form.model.effectiveEndDate || null,
        audienceEmployeeIds:
          form.model.audienceType === 'employees' ? [...form.model.audienceEmployeeIds] : [],
        audienceOrganizationIds:
          form.model.audienceType === 'organizations'
            ? [...form.model.audienceOrganizationIds]
            : [],
        attachmentUrls: [...form.model.attachmentUrls]
      })
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '公告保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: AnnouncementEditorDialogOpenData): Promise<void> => {
    recordTenantId.value = data.row?.tenantId
    categories.value = data.categories
    organizations.value = data.organizations
    await resetForm()
    if (data.row) {
      Object.assign(form.model, {
        id: data.row.id,
        operation: 'edit',
        categoryId: data.row.categoryId,
        title: data.row.title,
        contentHtml: data.row.contentHtml,
        contentText: data.row.contentText,
        audienceType: data.row.audienceType,
        audienceEmployeeIds: data.row.audienceEmployees.map((item) => item.id),
        audienceOrganizationIds: data.row.audienceOrganizations.map((item) => item.id),
        effectiveStartDate: data.row.effectiveStartDate,
        effectiveEndDate: data.row.effectiveEndDate || null,
        isPinned: data.row.isPinned,
        attachmentUrls: [...data.row.attachmentUrls]
      })
      employeeSelection.value = toEmployeeSelection(data.row)
    }
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑公告草稿' : '新建公告',
      subtitle: '公告先保存为草稿，确认内容与发布范围后再从列表执行发布。',
      confirmText: '保存为草稿',
      contentMaxHeight: 'calc(100vh - 150px)',
      onOpen: async (_openData, api) => {
        api.setLoading(true)
        try {
          await userStore.ensureDictLoaded('smisAnnouncementAudienceType')
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .announcement-editor-dialog {
    min-width: 0;

    &__full-control {
      width: 100%;
    }

    :deep(.editor-wrapper) {
      border-radius: var(--el-border-radius-base);
    }
  }
</style>
