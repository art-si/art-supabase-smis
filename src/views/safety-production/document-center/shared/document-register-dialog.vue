<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="document-register-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon :icon="contextIcon" /></template>
        <strong>{{ contextTitle }}</strong>
        <p>{{ contextDescription }}</p>
      </ArtEntitySummary>

      <ArtForm
        ref="formRef"
        :model-value="form"
        @update:model-value="replaceReactiveModel(form, $event)"
        :items="items"
        :rules="rules"
        :span="12"
        :gutter="24"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      >
        <template #categoryId>
          <ElTreeSelect
            v-model="form.categoryId"
            :data="categories"
            :props="categoryProps"
            node-key="id"
            value-key="id"
            check-strictly
            default-expand-all
            filterable
            clearable
            class="w-full"
            placeholder="请选择文档分类"
          />
        </template>

        <template #attachmentUrl>
          <div class="document-register-dialog__upload">
            <ArtUploadFile
              v-model="form.attachmentUrl"
              :show-file-list="true"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,image/*"
              title="选择文档附件"
              tip="支持常见文档、表格、演示稿、压缩包与图片，单个文件不超过 20 MB"
              @resource-change="handleUploadSuccess"
            />
            <p v-if="mode === 'edit' && existingAttachmentName">
              <ArtSvgIcon icon="ri:attachment-2" /> 当前附件：{{
                existingAttachmentName
              }}。不重新上传则保留现有版本。
            </p>
          </div>
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { replaceReactiveModel } from '@/utils/form/model'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import { getAttachmentNameFromUrl } from '@/utils/file/attachment'
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import { fetchEnabledOrganizationTree } from '@/api/system-manage'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    saveDocumentRegister,
    type SmisDocumentCategory,
    type SmisDocumentRegister,
    type SmisDocumentRegisterKind,
    type SmisDocumentRegisterSavePayload
  } from '@smis/api'

  export type DocumentRegisterDialogMode = 'add' | 'copy' | 'edit'

  export interface DocumentRegisterDialogOpenData {
    mode: DocumentRegisterDialogMode
    kind: SmisDocumentRegisterKind
    categories: SmisDocumentCategory[]
    row?: SmisDocumentRegister
  }

  interface FormModel {
    id?: string
    categoryId: string
    fileName: string
    documentCode: string
    effectiveDate: string
    promulgationDate: string
    obtainedDate: string
    obtainedOrganizationId: string
    isSpecialEquipment: boolean
    attachmentName: string
    attachmentUrl: string
    attachmentType: string
    attachmentSize?: number
    remark: string
    copySourceId?: string
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
    reloadOptions: (key: string) => Promise<void>
  }

  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap, getUserInfo } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<DocumentRegisterDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const categories = shallowRef<SmisDocumentCategory[]>([])
  const mode = ref<DocumentRegisterDialogMode>('add')
  const kind = ref<SmisDocumentRegisterKind>('required_knowledge')
  const existingAttachmentName = ref('')
  const categoryProps = { label: 'categoryName', children: 'children' }

  const initial = (): FormModel => ({
    id: undefined,
    categoryId: '',
    fileName: '',
    documentCode: '',
    effectiveDate: dayjs().format('YYYY-MM-DD'),
    promulgationDate: dayjs().format('YYYY-MM-DD'),
    obtainedDate: dayjs().format('YYYY-MM-DD'),
    obtainedOrganizationId: '',
    isSpecialEquipment: false,
    attachmentName: '',
    attachmentUrl: '',
    attachmentType: '',
    attachmentSize: undefined,
    remark: '',
    copySourceId: undefined
  })
  const form = reactive<FormModel>(initial())
  const isLegal = computed(() => kind.value === 'legal_regulation')
  const contextIcon = computed(() =>
    mode.value === 'copy'
      ? 'ri:file-copy-2-line'
      : mode.value === 'edit'
        ? 'ri:file-edit-line'
        : 'ri:file-add-line'
  )
  const contextTitle = computed(() =>
    mode.value === 'copy'
      ? '复制现有信息并创建新文档'
      : mode.value === 'edit'
        ? '维护文档台账信息'
        : '登记新的受控文档'
  )
  const contextDescription = computed(() =>
    isLegal.value
      ? '文件编号在法律法规台账内不可重复，获取部门来自系统组织，附件保留版本记录。'
      : '分类来自统一文档分类树，附件、生效日期和备注进入租户级文档台账。'
  )
  const booleanOptions = computed(() =>
    (getDictMap.value.commonBoolean ?? []).map((item) => ({
      label: item.label || item.name,
      value: item.value === 'true'
    }))
  )

  const items = computed<FormItem[]>(() => [
    { label: '基础信息', key: 'base', type: 'divider', span: 24 },
    {
      label: '文件名称',
      key: 'fileName',
      type: 'input',
      span: 12,
      props: { maxlength: 200, showWordLimit: true, placeholder: '请输入文件名称' }
    },
    {
      label: '文件编号',
      key: 'documentCode',
      type: 'input',
      span: 12,
      props: { maxlength: 100, showWordLimit: true, placeholder: '请输入文件编号' }
    },
    { label: '文档分类', key: 'categoryId', type: 'text', span: 12 },
    {
      label: '生效日期',
      key: 'effectiveDate',
      type: 'date',
      span: 12,
      props: { valueFormat: 'YYYY-MM-DD', clearable: false, class: '!w-full' }
    },
    {
      label: '颁布日期',
      key: 'promulgationDate',
      type: 'date',
      span: 12,
      props: { valueFormat: 'YYYY-MM-DD', clearable: true, class: '!w-full' }
    },
    ...(isLegal.value
      ? [
          {
            label: '获取日期',
            key: 'obtainedDate',
            type: 'date' as const,
            span: 12,
            props: { valueFormat: 'YYYY-MM-DD', clearable: true, class: '!w-full' }
          },
          {
            label: '获取部门',
            key: 'obtainedOrganizationId',
            type: 'treeSelect' as const,
            span: 12,
            api: fetchEnabledOrganizationTree,
            immediate: false,
            beforeFetch: () => ({ tenantId: getUserInfo.value.tenantId }),
            resultField: 'data',
            labelField: 'organizationName',
            valueField: 'id',
            labelFn: (item: FormItemOption) =>
              `${item.organizationName}（${item.organizationCode}）`,
            childrenField: 'children',
            props: {
              clearable: true,
              checkStrictly: true,
              defaultExpandAll: true,
              renderAfterExpand: false,
              placeholder: '请选择系统组织部门'
            }
          },
          {
            label: '是否特种设备',
            key: 'isSpecialEquipment',
            type: 'segment' as const,
            span: 12,
            options: booleanOptions.value
          }
        ]
      : []),
    { label: '附件与备注', key: 'attachment', type: 'divider', span: 24 },
    {
      label: mode.value === 'edit' ? '更新附件' : '文档附件',
      key: 'attachmentUrl',
      type: 'text',
      span: 24
    },
    {
      label: '备注',
      key: 'remark',
      type: 'textarea',
      span: 24,
      props: {
        rows: 3,
        maxlength: 2000,
        showWordLimit: true,
        resize: 'none',
        placeholder: '补充文件适用范围、来源或其他说明'
      }
    }
  ])

  const rules: FormRules<FormModel> = {
    fileName: [{ required: true, message: '请输入文件名称', trigger: 'blur' }],
    documentCode: [{ required: true, message: '请输入文件编号', trigger: 'blur' }],
    categoryId: [{ required: true, message: '请选择文档分类', trigger: 'change' }],
    effectiveDate: [{ required: true, message: '请选择生效日期', trigger: 'change' }],
    obtainedOrganizationId: [
      {
        validator: (_rule, value, callback) => {
          if (isLegal.value && !value) callback(new Error('请选择获取部门'))
          else callback()
        },
        trigger: 'change'
      }
    ],
    attachmentUrl: [
      {
        validator: (_rule, value, callback) => {
          if (mode.value !== 'edit' && !value) callback(new Error('请上传文档附件'))
          else callback()
        },
        trigger: 'change'
      }
    ]
  }

  const handleUploadSuccess = (resources: Api.DataCenter.Resources.ResourceListItem[]): void => {
    const resource = resources[0]
    if (!resource) return
    form.attachmentUrl = resource.url ?? ''
    form.attachmentName = resource.originName || getAttachmentNameFromUrl(resource.url ?? '', '')
    form.attachmentType = resource.suffix || resource.mimeType || ''
    form.attachmentSize = resource.sizeByte
    if (!form.fileName) form.fileName = form.attachmentName.replace(/\.[^.]+$/, '')
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const payload: SmisDocumentRegisterSavePayload = {
        id: form.id,
        kind: kind.value,
        categoryId: form.categoryId,
        fileName: form.fileName.trim(),
        documentCode: form.documentCode.trim(),
        effectiveDate: form.effectiveDate,
        promulgationDate: form.promulgationDate || null,
        obtainedDate: isLegal.value ? form.obtainedDate || null : null,
        obtainedOrganizationId: isLegal.value ? form.obtainedOrganizationId || null : null,
        isSpecialEquipment: isLegal.value && form.isSpecialEquipment,
        attachmentName: form.attachmentName || null,
        attachmentUrl: form.attachmentUrl || null,
        attachmentType: form.attachmentType || null,
        attachmentSize: form.attachmentSize ?? null,
        remark: normalizeNullableText(form.remark),
        copySourceId: form.copySourceId || null
      }
      await saveDocumentRegister(payload)
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '文档登记保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: DocumentRegisterDialogOpenData): Promise<void> => {
    Object.assign(form, initial())
    mode.value = data.mode
    kind.value = data.kind
    categories.value = data.categories
    existingAttachmentName.value = ''
    if (data.row) {
      Object.assign(form, {
        id: data.mode === 'edit' ? data.row.id : undefined,
        categoryId: data.row.categoryId,
        fileName: data.mode === 'copy' ? `${data.row.fileName}（副本）` : data.row.fileName,
        documentCode: data.mode === 'copy' ? '' : data.row.documentCode,
        effectiveDate: data.row.effectiveDate || dayjs().format('YYYY-MM-DD'),
        promulgationDate: data.row.promulgationDate || '',
        obtainedDate: data.row.obtainedDate || '',
        obtainedOrganizationId: data.row.obtainedOrganizationId || '',
        isSpecialEquipment: data.row.isSpecialEquipment,
        attachmentName: data.mode === 'copy' ? data.row.attachmentName || '' : '',
        attachmentUrl: data.mode === 'copy' ? data.row.attachmentUrl || '' : '',
        attachmentType: data.mode === 'copy' ? data.row.attachmentType || '' : '',
        attachmentSize: data.mode === 'copy' ? data.row.attachmentSize || undefined : undefined,
        remark: data.row.remark || '',
        copySourceId: data.mode === 'copy' ? data.row.id : undefined
      })
      if (data.mode === 'edit') existingAttachmentName.value = data.row.attachmentName || ''
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title:
        data.mode === 'copy' ? '复制并新增文档' : data.mode === 'edit' ? '编辑文档' : '新增文档',
      subtitle: '文档分类、附件版本和业务字段均按当前租户隔离',
      confirmText:
        data.mode === 'copy' ? '复制并新增' : data.mode === 'edit' ? '保存更改' : '新增文档',
      contentMaxHeight: 'calc(100vh - 150px)',
      onOpen: async (_openData, api) => {
        api.setLoading(true)
        try {
          await userStore.ensureDictLoaded('commonBoolean')
          if (isLegal.value) await formRef.value?.reloadOptions('obtainedOrganizationId')
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
  .document-register-dialog {
    &__upload {
      display: grid;
      gap: 8px;

      p {
        display: flex;
        gap: 6px;
        align-items: center;
        margin: 0;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
  }
</style>
