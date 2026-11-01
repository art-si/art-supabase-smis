<template>
  <ArtDialog ref="dialogRef" size="xl" :loading="loading" loading-text="正在加载排查明细…">
    <div v-if="detail" class="hidden-hazard-task-execution">
      <div class="hidden-hazard-task-execution__context">
        <span aria-hidden="true"><ArtSvgIcon icon="ri:task-line" /></span>
        <div
          ><strong>{{ detail.taskNo }}</strong
          ><p
            >{{ detail.inspectionObject }} · 计划完成 {{ formatDate(detail.plannedEndAt) }}</p
          ></div
        >
        <span class="hidden-hazard-task-execution__progress"
          >{{ completedCount }} / {{ detail.items.length }}</span
        >
      </div>
      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :span="24"
        label-position="top"
      />
    </div>
    <template #footer="{ api }">
      <div class="hidden-hazard-task-execution__footer">
        <span>保存进度允许保留未排查项目；异常项会立即生成隐患编号。</span>
        <div
          ><ElButton @click="api.handleClose()">关闭</ElButton
          ><ElButton
            :loading="submitting"
            :disabled="!formRef?.readyToSubmit"
            @click="handleSubmit(false)"
            >保存进度</ElButton
          ><ElButton
            type="primary"
            :loading="submitting"
            :disabled="!formRef?.readyToSubmit"
            @click="handleSubmit(true)"
            >提交并完成</ElButton
          ></div
        >
      </div>
    </template>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { normalizeNullableText } from '@/utils/form/normalize'
  import { ElMessage } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import {
    fetchHiddenHazardInspectionTaskDetail,
    saveHiddenHazardInspectionExecution,
    type SmisHiddenHazardInspectionResult,
    type SmisHiddenHazardInspectionTask,
    type SmisHiddenHazardInspectionTaskDetail
  } from '@smis/api'

  const configuredItemResultOptions = useDictionaryOptions('smisHiddenHazardInspectionResult')
  const itemResultOptions = computed(() =>
    configuredItemResultOptions.filter(
      (option) => option.value === 'normal' || option.value === 'abnormal'
    )
  )

  export interface HiddenHazardTaskExecutionOpenData {
    row: SmisHiddenHazardInspectionTask
  }
  interface ExecutionItem {
    id: string
    result: SmisHiddenHazardInspectionResult
    remark: string
    attachmentUrls: string[]
  }
  interface ExecutionForm {
    executionSummary: string
    attachmentUrls: string[]
    items: ExecutionItem[]
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<HiddenHazardTaskExecutionOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const detail = shallowRef<SmisHiddenHazardInspectionTaskDetail | null>(null)
  const loading = ref(false)
  const submitting = ref(false)
  const uploadImageSize = 88
  const formModel = reactive<ExecutionForm>({ executionSummary: '', attachmentUrls: [], items: [] })
  const form = reactive<{ model: ExecutionForm; items: ComputedRef<FormItem[]> }>({
    model: formModel,
    items: computed<FormItem[]>(() => [
      { label: '执行信息', key: 'execution', type: 'divider', span: 24 },
      {
        label: '执行总结',
        key: 'executionSummary',
        type: 'textarea',
        span: 16,
        props: {
          rows: 3,
          maxlength: 2000,
          showWordLimit: true,
          resize: 'none',
          placeholder: '说明总体情况、发现问题和后续建议'
        }
      },
      {
        label: '任务附件',
        key: 'attachmentUrls',
        span: 8,
        type: 'uploadImage',
        get props(): FormItem['props'] {
          return { multiple: true, limit: 8, size: uploadImageSize, title: '上传现场照片' }
        }
      },
      { label: '排查明细', key: 'details', type: 'divider', span: 24 },
      ...formModel.items.flatMap((item, index): FormItem[] => [
        {
          key: 'item-' + item.id,
          label:
            String(index + 1).padStart(2, '0') +
            ' · ' +
            (detail.value?.items[index]?.standardName || '排查项目'),
          type: 'divider',
          span: 24
        },
        {
          key: 'items.' + index + '.result',
          label: '排查结果',
          type: 'radioGroup',
          span: 24,
          description: [
            detail.value?.items[index]?.itemCode,
            detail.value?.items[index]?.inspectionContent
          ]
            .filter(Boolean)
            .join(' · '),
          options: itemResultOptions.value,
          props: { size: 'small', optionType: 'button' }
        },
        {
          key: 'items.' + index + '.remark',
          label: '检查说明',
          type: 'textarea',
          span: 16,
          props: {
            rows: 2,
            maxlength: 1000,
            showWordLimit: true,
            placeholder: '填写检查说明；异常项请描述位置、现象与处置建议'
          }
        },
        {
          key: 'items.' + index + '.attachmentUrls',
          label: '项目照片',
          type: 'uploadImage',
          span: 8,
          props: { multiple: true, limit: 4, size: uploadImageSize, title: '项目照片' }
        }
      ])
    ])
  })
  const completedCount = computed(
    () => form.model.items.filter((item) => item.result !== 'pending').length
  )
  const formatDate = createDateTimeFormatter({ format: 'YYYY-MM-DD HH:mm' })
  const initialize = (value: SmisHiddenHazardInspectionTaskDetail): void => {
    Object.assign(form.model, {
      executionSummary: value.executionSummary || '',
      attachmentUrls: [...value.attachmentUrls],
      items: value.items.map((item) => ({
        id: item.id,
        result: item.result,
        remark: item.remark || '',
        attachmentUrls: [...item.attachmentUrls]
      }))
    })
  }
  const handleSubmit = async (complete: boolean): Promise<void> => {
    if (!detail.value || submitting.value) return
    if (complete && form.model.items.some((item) => item.result === 'pending'))
      return void ElMessage.warning('提交完成前请填写全部排查结果')
    if (
      complete &&
      form.model.items.some((item) => item.result === 'abnormal' && !item.remark.trim())
    )
      return void ElMessage.warning('异常项目必须填写问题说明')
    try {
      submitting.value = true
      await saveHiddenHazardInspectionExecution({
        id: detail.value.id,
        executionSummary: normalizeNullableText(form.model.executionSummary),
        attachmentUrls: [...form.model.attachmentUrls],
        items: form.model.items.map((item) => ({
          ...item,
          remark: normalizeNullableText(item.remark)
        })),
        complete
      })
      emit('success')
      dialogRef.value?.handleClose(true)
    } catch {
      /* 响应层统一提示 */
    } finally {
      submitting.value = false
    }
  }
  const handleOpen = async (data: HiddenHazardTaskExecutionOpenData): Promise<void> => {
    detail.value = null
    loading.value = true
    await dialogRef.value?.handleOpen(data, {
      title: '执行隐患排查任务',
      subtitle: `${data.row.taskNo} · ${data.row.inspectionObject}`,
      contentMaxHeight: 'calc(100vh - 150px)',
      onOpen: async () => {
        try {
          const value = await fetchHiddenHazardInspectionTaskDetail(data.row.id)
          detail.value = value
          if (value) initialize(value)
        } finally {
          loading.value = false
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .hidden-hazard-task-execution {
    &__context {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 14px 16px;
      margin-bottom: 18px;
      background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-base);
    }

    &__context > span:first-child {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      color: var(--theme-color);
      background: var(--default-box-color);
      border-radius: var(--el-border-radius-base);
    }

    &__context p {
      margin: 3px 0 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__progress {
      padding: 6px 10px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
      border-radius: 999px;
    }

    &__items {
      display: grid;
      gap: 12px;
    }

    &__items article {
      padding: 16px;
      background: var(--default-box-color);
      border: 1px solid var(--el-border-color-lighter);
      border-left: 3px solid var(--el-border-color);
      border-radius: var(--el-border-radius-base);
    }

    &__items article[data-result='normal'] {
      border-left-color: var(--el-color-success);
    }

    &__items article[data-result='abnormal'] {
      border-left-color: var(--el-color-danger);
    }

    &__items header {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
    }

    &__items header > span {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
      border-radius: var(--el-border-radius-base);
    }

    &__items header strong,
    &__items header small {
      display: block;
    }

    &__items header small {
      margin-top: 2px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    &__items article > p {
      margin: 12px 0;
      line-height: 1.6;
    }

    &__item-fields {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 250px;
      gap: 16px;
      align-items: start;
    }

    &__footer {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    &__footer > span {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    @media (width <= 760px) {
      &__item-fields {
        grid-template-columns: minmax(0, 1fr);
      }

      &__items header {
        grid-template-columns: 34px minmax(0, 1fr);
      }

      &__items header .el-radio-group {
        grid-column: 1 / -1;
      }

      &__footer {
        flex-direction: column;
        align-items: flex-end;
      }
    }
  }
</style>
