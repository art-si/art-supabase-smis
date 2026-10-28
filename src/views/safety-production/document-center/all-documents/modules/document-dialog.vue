<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="document-dialog">
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
            class="w-full"
            placeholder="选择文档分类"
            @change="handleCategoryChange"
          />
        </template>

        <template #fileUrl>
          <div class="document-dialog__upload">
            <ArtUploadFile
              v-model="form.fileUrl"
              :disabled="!form.categoryId"
              :show-file-list="true"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,image/*"
              title="选择要上传的文件"
              tip="请先选择分类；支持常见文档、表格、演示稿、压缩包与图片，单个文件不超过 20 MB"
              @resource-change="handleUploadSuccess"
            />
            <p v-if="!form.categoryId" class="document-dialog__upload-hint">
              <ArtSvgIcon icon="ri:information-line" /> 选择文档分类后即可上传并执行同名查重
            </p>
          </div>
        </template>

        <template v-if="duplicate" #duplicateResolution>
          <section class="document-dialog__duplicate" aria-label="同名文件处理">
            <div class="document-dialog__duplicate-heading">
              <span aria-hidden="true"><ArtSvgIcon icon="ri:file-warning-line" /></span>
              <div>
                <strong>发现同分类同名文件</strong>
                <p>
                  “{{ duplicate.fileName }}”当前为第 {{ duplicate.versionNo }} 版，实施日期
                  {{ formatDate(duplicate.effectiveDate) }}。请选择本次更新方式。
                </p>
              </div>
            </div>
            <ElRadioGroup v-model="form.duplicateAction" class="document-dialog__duplicate-options">
              <ElRadio value="replace" border>
                <span>作为新版本替换</span>
                <small>保留旧版审计记录，并在本次实施日期自动切换</small>
              </ElRadio>
              <ElRadio value="keep_both" border>
                <span>保留为独立文档</span>
                <small>同名文件并存，创建一条新的文档记录</small>
              </ElRadio>
            </ElRadioGroup>
          </section>
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'

  import { replaceReactiveModel } from '@/utils/form/model'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import { getAttachmentNameFromUrl } from '@/utils/file/attachment'
  import dayjs from 'dayjs'
  import { ElMessage, type FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    findDocumentDuplicate,
    saveDocument,
    type SmisDocument,
    type SmisDocumentCategory,
    type SmisDocumentDuplicate,
    type SmisDocumentDuplicateAction,
    type SmisDocumentStatus
  } from '@smis/api'

  export type DocumentDialogMode = 'add' | 'edit' | 'upload'

  export interface DocumentDialogOpenData {
    mode: DocumentDialogMode
    categories: SmisDocumentCategory[]
    row?: SmisDocument
    presetCategoryId?: string
  }

  interface FormModel {
    id?: string
    categoryId: string
    title: string
    status: SmisDocumentStatus
    summary: string
    fileUrl: string
    fileName: string
    fileType: string
    fileSize?: number
    effectiveDate: string
    replacementNote: string
    duplicateAction?: Exclude<SmisDocumentDuplicateAction, 'none'>
    duplicateDocumentId?: string
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<DocumentDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const mode = ref<DocumentDialogMode>('add')
  const categories = shallowRef<SmisDocumentCategory[]>([])
  const duplicate = shallowRef<SmisDocumentDuplicate | null>(null)
  const categoryProps = { label: 'categoryName', children: 'children', disabled: 'disabled' }

  const initial = (): FormModel => ({
    id: undefined,
    categoryId: '',
    title: '',
    status: 'draft',
    summary: '',
    fileUrl: '',
    fileName: '',
    fileType: '',
    fileSize: undefined,
    effectiveDate: dayjs().format('YYYY-MM-DD'),
    replacementNote: '',
    duplicateAction: undefined,
    duplicateDocumentId: undefined
  })
  const form = reactive<FormModel>(initial())

  const isUploadMode = computed(() => mode.value === 'upload')
  const contextIcon = computed(() =>
    mode.value === 'upload'
      ? 'ri:upload-cloud-2-line'
      : mode.value === 'edit'
        ? 'ri:file-edit-line'
        : 'ri:file-add-line'
  )
  const contextTitle = computed(() =>
    mode.value === 'upload'
      ? form.id
        ? '上传文档新版本'
        : '上传并登记文档'
      : mode.value === 'edit'
        ? '维护文档业务属性'
        : '先建立文档草稿'
  )
  const contextDescription = computed(() =>
    mode.value === 'upload'
      ? '文件版本按实施日期生效；同分类同名文件必须明确选择替换或保留。'
      : mode.value === 'edit'
        ? '标题、分类、状态与摘要可调整；已上传的版本记录保持不可覆盖。'
        : '建立文档元数据后，可在列表中继续上传受控版本。'
  )

  const statusOptions = computed(() =>
    (getDictMap.value.smisDocumentStatus ?? []).map(toDictionaryOption)
  )

  const items = computed<FormItem[]>(() => [
    { label: '文档信息', key: 'document', type: 'divider', span: 24 },
    {
      label: '文档标题',
      key: 'title',
      type: 'input',
      span: 12,
      props: { maxlength: 200, showWordLimit: true, placeholder: '请输入便于检索的文档标题' }
    },
    { label: '文档分类', key: 'categoryId', type: 'text', span: 12 },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      span: 12,
      options: statusOptions.value,
      props: { clearable: false }
    },
    {
      label: '内容摘要',
      key: 'summary',
      type: 'textarea',
      span: 24,
      props: {
        rows: 3,
        maxlength: 2000,
        showWordLimit: true,
        resize: 'none',
        placeholder: '简要说明适用范围、主要内容或使用注意事项'
      }
    },
    ...(isUploadMode.value
      ? [
          { label: '版本与实施', key: 'version', type: 'divider' as const, span: 24 },
          { label: '文档文件', key: 'fileUrl', type: 'text' as const, span: 24 },
          {
            label: '实施日期',
            key: 'effectiveDate',
            type: 'date' as const,
            span: 12,
            description: '未来日期会生成实施提醒，并在到期后自动切换当前生效版本。',
            props: { valueFormat: 'YYYY-MM-DD', clearable: false, class: '!w-full' }
          },
          {
            label: '版本更新说明',
            key: 'replacementNote',
            type: 'textarea' as const,
            span: 24,
            props: {
              rows: 3,
              maxlength: 1000,
              showWordLimit: true,
              resize: 'none',
              placeholder: '说明本次版本更新内容、影响范围或替换原因'
            }
          },
          ...(duplicate.value
            ? [
                {
                  label: '同名处理',
                  key: 'duplicateResolution',
                  type: 'text' as const,
                  span: 24
                }
              ]
            : [])
        ]
      : [])
  ])

  const rules: FormRules<FormModel> = {
    title: [{ required: true, message: '请输入文档标题', trigger: 'blur' }],
    categoryId: [{ required: true, message: '请选择文档分类', trigger: 'change' }],
    status: [{ required: true, message: '请选择文档状态', trigger: 'change' }],
    fileUrl: [
      {
        validator: (_rule, value, callback) => {
          if (isUploadMode.value && !value) callback(new Error('请上传文档文件'))
          else callback()
        },
        trigger: 'change'
      }
    ],
    effectiveDate: [
      {
        validator: (_rule, value, callback) => {
          if (isUploadMode.value && !value) callback(new Error('请选择实施日期'))
          else callback()
        },
        trigger: 'change'
      }
    ]
  }

  const formatDate = (value: string): string => dayjs(value).format('YYYY年M月D日')

  const checkDuplicate = async (): Promise<void> => {
    duplicate.value = null
    form.duplicateAction = undefined
    form.duplicateDocumentId = undefined
    if (!form.categoryId || !form.fileName || form.id) return
    const result = await findDocumentDuplicate({
      categoryId: form.categoryId,
      fileName: form.fileName
    })
    duplicate.value = result
    form.duplicateDocumentId = result?.id
  }

  const handleCategoryChange = (): void => {
    if (form.fileName) void checkDuplicate()
  }

  const handleUploadSuccess = (resources: Api.DataCenter.Resources.ResourceListItem[]): void => {
    const resource = resources[0]
    if (!resource) return
    form.fileUrl = resource.url ?? ''
    form.fileName = resource.originName || getAttachmentNameFromUrl(resource.url ?? '', '')
    form.fileType = resource.suffix || resource.mimeType || ''
    form.fileSize = resource.sizeByte
    if (!form.title) form.title = form.fileName.replace(/\.[^.]+$/, '')
    void checkDuplicate()
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (duplicate.value && !form.duplicateAction) {
        ElMessage.warning('请选择同名文件的处理方式')
        return false
      }
      await saveDocument({
        id: form.id,
        categoryId: form.categoryId,
        title: form.title.trim(),
        status: form.status,
        summary: normalizeNullableText(form.summary),
        fileName: isUploadMode.value ? form.fileName : null,
        fileUrl: isUploadMode.value ? form.fileUrl : null,
        fileType: isUploadMode.value ? form.fileType || null : null,
        fileSize: isUploadMode.value ? (form.fileSize ?? null) : null,
        effectiveDate: isUploadMode.value ? form.effectiveDate : null,
        replacementNote: isUploadMode.value ? normalizeNullableText(form.replacementNote) : null,
        duplicateAction: form.duplicateAction ?? 'none',
        duplicateDocumentId: form.duplicateDocumentId ?? null
      })
      emit('success', form.id || form.duplicateAction === 'replace' ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '文档保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: DocumentDialogOpenData): Promise<void> => {
    Object.assign(form, initial())
    mode.value = data.mode
    categories.value = data.categories
    duplicate.value = null
    if (data.row) {
      Object.assign(form, {
        id: data.row.id,
        categoryId: data.row.categoryId,
        title: data.row.title,
        status: data.row.status,
        summary: data.row.summary || '',
        effectiveDate: data.row.scheduledEffectiveDate || dayjs().format('YYYY-MM-DD')
      })
    } else if (data.presetCategoryId) {
      form.categoryId = data.presetCategoryId
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title:
        data.mode === 'upload'
          ? data.row
            ? '上传新版本'
            : '上传文档'
          : data.mode === 'edit'
            ? '编辑文档'
            : '新增文档',
      subtitle: '分类、状态、版本与实施时间均进入租户级文档台账',
      confirmText: data.mode === 'upload' ? '保存文档版本' : '保存文档',
      contentMaxHeight: 'calc(100vh - 150px)',
      onOpen: async () => userStore.ensureDictLoaded('smisDocumentStatus'),
      onConfirm: handleSubmit
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .document-dialog {
    &__upload-hint {
      display: flex;
      gap: 6px;
      align-items: center;
      margin: 8px 0 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__duplicate {
      padding: 14px;
      background: var(--el-color-warning-light-9);
      border: 1px solid var(--el-color-warning-light-7);
      border-radius: var(--el-border-radius-base);
    }

    &__duplicate-heading {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 10px;
      align-items: center;

      > span {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        color: var(--el-color-warning-dark-2);
        background: var(--default-box-color);
        border-radius: var(--el-border-radius-base);
      }

      p {
        margin: 3px 0 0;
        font-size: 12px;
        color: var(--el-text-color-regular);
      }
    }

    &__duplicate-options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 12px;

      :deep(.el-radio) {
        display: flex;
        align-items: flex-start;
        width: 100%;
        height: auto;
        min-height: 70px;
        padding: 12px;
        margin: 0;
        white-space: normal;
      }

      :deep(.el-radio__label) {
        display: grid;
        line-height: 1.45;

        small {
          margin-top: 3px;
          color: var(--el-text-color-secondary);
        }
      }
    }

    @media (width <= 640px) {
      &__duplicate-options {
        grid-template-columns: 1fr;
      }
    }
  }
</style>
