<template>
  <ArtDialog ref="dialogRef" size="lg">
    <ArtForm
      ref="formRef"
      v-model="form"
      :items="formItems"
      :rules="formRules"
      :span="12"
      :gutter="16"
      label-position="top"
    >
      <template #fileAttachment>
        <div class="work-instruction-dialog__attachment">
          <div class="work-instruction-dialog__attachment-icon" aria-hidden="true">
            <ArtSvgIcon :icon="form.fileUrl ? 'ri:file-text-line' : 'ri:file-add-line'" />
          </div>
          <div class="work-instruction-dialog__attachment-copy">
            <template v-if="form.fileUrl">
              <span class="work-instruction-dialog__attachment-caption">已关联文件</span>
              <ArtAttachmentLink
                :file="{
                  name: attachmentName,
                  url: form.fileUrl,
                  fileType: form.fileType
                }"
              />
              <span class="work-instruction-dialog__attachment-caption">
                {{ attachmentTypeLabel }} · 点击文件名预览
              </span>
            </template>
            <template v-else>
              <strong>尚未关联文件</strong>
              <span class="work-instruction-dialog__attachment-caption">
                从资源库选择作业指导文件，也可填写外部链接。
              </span>
            </template>
          </div>
          <div class="work-instruction-dialog__attachment-actions">
            <ElButton
              :type="form.fileUrl ? 'default' : 'primary'"
              @click="resourcePickerVisible = true"
            >
              <ArtSvgIcon icon="ri:attachment-2" />
              {{ form.fileUrl ? '更换文件' : '选择文件' }}
            </ElButton>
            <ElButton v-if="form.fileUrl" type="danger" plain @click="removeAttachment">
              移除
            </ElButton>
          </div>
        </div>
        <ElButton
          class="work-instruction-dialog__link-toggle"
          link
          type="primary"
          @click="showLinkInput = !showLinkInput"
        >
          <ArtSvgIcon icon="ri:link-m" />
          {{ showLinkInput ? '收起文件链接' : form.fileUrl ? '查看或修改链接' : '填写文件链接' }}
        </ElButton>
      </template>
    </ArtForm>
  </ArtDialog>

  <ArtResourcePicker
    v-model:visible="resourcePickerVisible"
    v-model="resourcePickerValue"
    title="选择作业指导书文件"
    default-file-type="document"
    :multiple="false"
    @confirm="handleResourceConfirm"
  />
</template>

<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import dayjs from 'dayjs'
  import { computed, h, nextTick, ref, toRaw } from 'vue'
  import { storeToRefs } from 'pinia'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtResourcePicker from '@/components/core/forms/art-resource-picker/index.vue'
  import type { Resource } from '@/components/core/forms/art-resource-picker/type'
  import ArtAttachmentLink from '@/components/core/media/art-file-viewer/attachment-link.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import SmisDataSourceEmptyActions from '@smis/views/components/smis-data-source-empty-actions.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    savePositionWorkInstruction,
    type PositionWorkInstruction,
    type PositionWorkInstructionSavePayload
  } from '@smis/api'
  import { flattenWorkInstructionTree, type WorkInstructionTreeNode } from './types'

  export interface WorkInstructionDialogOpenData {
    treeData: WorkInstructionTreeNode[]
    row?: PositionWorkInstruction
  }

  interface WorkInstructionForm {
    id?: string
    instructionName: string
    scopeKeys: Array<string | number>
    fileNumber: string
    fileType: string
    uploadDate: string
    versionNo: string
    fileUrl: string
    originalFileName: string
  }

  interface DialogFormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<WorkInstructionDialogOpenData>>()
  const formRef = ref<DialogFormExpose>()
  const treeData = ref<WorkInstructionTreeNode[]>([])
  const selectedScopeNodes = ref<WorkInstructionTreeNode[]>([])
  const resourcePickerVisible = ref(false)
  const resourcePickerValue = ref<string>()
  const showLinkInput = ref(false)

  const createInitialForm = (): WorkInstructionForm => ({
    id: undefined,
    instructionName: '',
    scopeKeys: [],
    fileNumber: '',
    fileType: '',
    uploadDate: dayjs().format('YYYY-MM-DD'),
    versionNo: 'V1.0',
    fileUrl: '',
    originalFileName: ''
  })
  const form = ref<WorkInstructionForm>(createInitialForm())
  const leafNodeMap = computed(
    () =>
      new Map(
        flattenWorkInstructionTree(treeData.value)
          .filter((node) => node.nodeType === 'position')
          .map((node) => [node.key, node])
      )
  )
  const fileTypeOptions = computed<FormItemOption[]>(() => {
    const options = (getDictMap.value.FILE_EXTENSION_LABEL_MAP ?? []).map(toDictionaryOption)
    if (form.value.fileType && !options.some((item) => item.value === form.value.fileType)) {
      return [{ label: form.value.fileType, value: form.value.fileType }, ...options]
    }
    return options
  })
  const attachmentName = computed(
    () => form.value.originalFileName.trim() || form.value.instructionName.trim() || '关联文件'
  )
  const attachmentTypeLabel = computed(
    () => fileTypeOptions.value.find((item) => item.value === form.value.fileType)?.label || '文件'
  )

  const formRules = computed<FormRules<WorkInstructionForm>>(() => ({
    instructionName: [
      { required: true, message: '请输入作业指导名称', trigger: 'blur' },
      { max: 200, message: '作业指导名称不能超过 200 个字符', trigger: 'blur' }
    ],
    scopeKeys: [
      {
        type: 'array',
        required: true,
        min: 1,
        message: '请至少选择一个适用组织岗位',
        trigger: 'change'
      }
    ]
  }))
  const formItems = computed<FormItem[]>(() => [
    { label: '适用信息', key: 'basicSection', type: 'divider', span: 24 },
    {
      label: '作业指导名称',
      key: 'instructionName',
      type: 'input',
      span: 16,
      props: { maxlength: 200, showWordLimit: true, placeholder: '例如：危化品车辆装卸作业指导书' }
    },
    {
      label: '版本号',
      key: 'versionNo',
      type: 'input',
      span: 8,
      props: { maxlength: 50, placeholder: '例如：V1.0' }
    },
    {
      label: '适用组织岗位',
      key: 'scopeKeys',
      type: 'dataSelect',
      span: 24,
      description:
        '已选择 ' + form.value.scopeKeys.length + ' 个岗位，同一份指导书可同时适用于多个组织岗位。',
      props: {
        mode: 'tree',
        multiple: true,
        selectedData: selectedScopeNodes.value,
        data: treeData.value,
        rowKey: 'key',
        labelKey: 'label',
        descriptionKey: 'description',
        disabledKey: 'disabled',
        childrenKey: 'children',
        title: '选择适用组织岗位',
        subtitle: '可跨组织多选岗位；组织节点用于分组，岗位叶子可勾选',
        placeholder: '请选择一个或多个适用岗位',
        searchPlaceholder: '搜索组织、岗位名称或编码',
        showPagination: false,
        showSelectedPanel: true,
        treeCheckStrictly: true,
        maxTagCount: 3,
        emptyText: '暂无可选岗位',
        emptyDescription: '请先在 HR 岗位管理中新增并启用岗位，再维护岗位作业指导书。',
        'onUpdate:selectedData': handleSelectedDataUpdate
      },
      slots: { empty: () => h(SmisDataSourceEmptyActions, { source: 'position' }) }
    },
    { label: '文件与版本', key: 'fileSection', type: 'divider', span: 24 },
    {
      label: '文件编号',
      key: 'fileNumber',
      type: 'input',
      span: 8,
      props: { maxlength: 100, placeholder: '填写企业文件编号' }
    },
    {
      label: '文件类型',
      key: 'fileType',
      type: 'select',
      span: 8,
      options: fileTypeOptions.value,
      props: {
        clearable: true,
        filterable: true,
        placeholder: '请选择文件类型'
      }
    },
    {
      label: '上传日期',
      key: 'uploadDate',
      type: 'date',
      span: 8,
      props: {
        type: 'date',
        valueFormat: 'YYYY-MM-DD',
        format: 'YYYY-MM-DD',
        placeholder: '请选择上传日期'
      }
    },
    { label: '关联文件', key: 'fileAttachment', type: 'text', span: 24 },
    {
      label: '文件链接',
      key: 'fileUrl',
      type: 'input',
      span: 24,
      hidden: !showLinkInput.value,
      props: {
        id: 'work-instruction-file-url',
        clearable: true,
        maxlength: 2048,
        placeholder: '粘贴可访问的文件链接',
        onInput: handleFileUrlInput
      }
    }
  ])

  const handleSelectedDataUpdate = (rows: Record<string, unknown>[]): void => {
    selectedScopeNodes.value = rows.filter(
      (row): row is WorkInstructionTreeNode => row.nodeType === 'position'
    )
  }
  const handleResourceConfirm = (resources: Resource[]): void => {
    const resource = resources[0]
    if (!resource) return
    form.value.fileUrl = resource.url?.trim() || ''
    form.value.originalFileName = resource.originName?.trim() || ''
    form.value.fileType = getResourceExtension(resource) || form.value.fileType
    form.value.uploadDate = dayjs().format('YYYY-MM-DD')
    resourcePickerValue.value = resource.url
    showLinkInput.value = false
  }
  const handleFileUrlInput = (): void => {
    form.value.originalFileName = ''
    resourcePickerValue.value = undefined
  }
  const removeAttachment = (): void => {
    form.value.fileUrl = ''
    form.value.originalFileName = ''
    resourcePickerValue.value = undefined
    showLinkInput.value = false
  }
  const resetForm = async (): Promise<void> => {
    Object.assign(form.value, createInitialForm())
    selectedScopeNodes.value = []
    resourcePickerValue.value = undefined
    resourcePickerVisible.value = false
    showLinkInput.value = false
    await nextTick()
    formRef.value?.clearValidate()
  }
  const getResourceExtension = (resource: Resource): string => {
    const suffix = resource.suffix?.trim().replace(/^\./, '')
    if (suffix) return suffix.toLocaleLowerCase('en-US')
    const fileName = resource.originName?.trim() || resource.url?.trim() || ''
    const extension = fileName.split(/[?#]/, 1)[0]?.match(/\.([^./\\]+)$/)?.[1]
    return extension?.toLocaleLowerCase('en-US') || ''
  }
  const buildPayload = (): PositionWorkInstructionSavePayload => ({
    id: form.value.id,
    instructionName: form.value.instructionName.trim(),
    fileNumber: form.value.fileNumber.trim(),
    fileType: form.value.fileType.trim(),
    uploadDate: form.value.uploadDate,
    versionNo: form.value.versionNo.trim(),
    fileUrl: form.value.fileUrl.trim(),
    originalFileName: form.value.originalFileName.trim(),
    scopes: form.value.scopeKeys
      .map((key) => leafNodeMap.value.get(String(key)))
      .filter((node): node is WorkInstructionTreeNode => Boolean(node?.positionId))
      .map((node) => ({ organizationId: node.organizationId, positionId: node.positionId! }))
  })
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const type = form.value.id ? 'edit' : 'add'
      await savePositionWorkInstruction(buildPayload())
      emit('success', type)
      return true
    } catch (error) {
      notifyFriendlyError(error, '岗位作业指导书保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: WorkInstructionDialogOpenData): Promise<void> => {
    await resetForm()
    treeData.value = data.treeData
    if (data.row) {
      const row = structuredClone(toRaw(data.row))
      Object.assign(form.value, {
        ...createInitialForm(),
        id: row.id,
        instructionName: row.instructionName,
        scopeKeys: row.scopes.map((scope) => scope.scopeKey),
        fileNumber: row.fileNumber || '',
        fileType: row.fileType || '',
        uploadDate: row.uploadDate || '',
        versionNo: row.versionNo || '',
        fileUrl: row.fileUrl || '',
        originalFileName: row.originalFileName || ''
      })
      selectedScopeNodes.value = form.value.scopeKeys
        .map((key) => leafNodeMap.value.get(String(key)))
        .filter((node): node is WorkInstructionTreeNode => Boolean(node))
      resourcePickerValue.value = form.value.fileUrl || undefined
    }

    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑岗位作业指导书' : '新增岗位作业指导书',
      subtitle: '维护指导书文件信息，并选择一个或多个适用组织岗位',
      confirmText: '保存',
      contentMaxHeight: 'calc(100vh - 176px)',
      onOpen: async (_data, api) => {
        if (getDictMap.value.FILE_EXTENSION_LABEL_MAP?.length) return
        api.setLoading(true)
        try {
          await userStore.ensureDictLoaded('FILE_EXTENSION_LABEL_MAP')
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
  .work-instruction-dialog {
    &__scope-picker {
      width: 100%;
    }

    &__scope-picker > p {
      display: flex;
      gap: 6px;
      align-items: center;
      margin: 8px 0 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__scope-picker > p :deep(svg) {
      color: var(--theme-color);
    }

    &__attachment {
      display: flex;
      gap: 14px;
      align-items: center;
      min-width: 0;
      padding: 14px 16px;
      background: var(--art-gray-100);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--art-surface-radius);
    }

    &__attachment-icon {
      display: flex;
      flex: 0 0 40px;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      font-size: 20px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
      border-radius: var(--el-border-radius-base);
    }

    &__attachment-copy {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      align-items: flex-start;
      min-width: 0;
    }

    &__attachment-copy > strong {
      color: var(--el-text-color-primary);
    }

    &__attachment-copy :deep(.art-attachment-link) {
      max-width: 100%;
      margin: 2px 0;
    }

    &__attachment-caption {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__attachment-actions {
      display: flex;
      flex: none;
      gap: 8px;

      .el-button + .el-button {
        margin-left: 0;
      }
    }

    &__link-toggle {
      margin-top: 8px;
    }

    &__link-field {
      display: grid;
      gap: 8px;
      margin-top: 10px;

      label {
        font-size: 12px;
        color: var(--el-text-color-regular);
      }
    }

    @media (width <= 640px) {
      &__attachment {
        flex-wrap: wrap;
      }

      &__attachment-actions {
        width: 100%;
        padding-left: 54px;
      }
    }
  }
</style>
