<template>
  <ArtDialog ref="dialogRef" size="md">
    <div class="risk-map-scene-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:map-2-line" /></template>
        <strong>建立场景层级与画布底图</strong>
        <p>上级场景用于组织全厂、区域与作业区层级；底图可后续随时替换。</p>
      </ArtEntitySummary>
      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="20"
        label-position="top"
      >
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { saveRiskMapScene, type SmisRiskMapScene, type SmisRiskMapScenePayload } from '@smis/api'

  export interface RiskMapSceneDialogOpenData {
    row?: SmisRiskMapScene
    sceneTree: SmisRiskMapScene[]
    presetParentId?: string
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [id: string, type: 'add' | 'edit'] }>()
  const dialogRef = ref<ArtDialogExpose<RiskMapSceneDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const sceneTree = shallowRef<SmisRiskMapScene[]>([])
  const treeProps = { label: 'sceneName', children: 'children', disabled: 'disabled' }
  const initial = (): SmisRiskMapScenePayload => ({
    id: undefined,
    parentId: null,
    sceneName: '',
    backgroundUrl: '',
    canvasWidth: 1000,
    canvasHeight: 650,
    sort: 10
  })
  const form = reactive<{
    model: SmisRiskMapScenePayload
    items: FormItem[]
    rules: FormRules<SmisRiskMapScenePayload>
  }>({
    model: initial(),
    items: [
      {
        label: '场景名称',
        key: 'sceneName',
        type: 'input',
        span: 24,
        props: { maxlength: 80, placeholder: '如 全厂风险图、生产一楼' }
      },
      {
        label: '上级场景',
        key: 'parentId',
        span: 24,
        type: 'treeSelect',
        get props(): FormItem['props'] {
          return {
            data: sceneTree.value,
            props: treeProps,
            nodeKey: 'id',
            valueKey: 'id',
            checkStrictly: true,
            filterable: true,
            clearable: true,
            defaultExpandAll: true,
            placeholder: '未选择时作为根场景'
          }
        }
      },
      {
        label: '画布宽度',
        key: 'canvasWidth',
        type: 'number',
        props: { min: 480, max: 4000, step: 20, controlsPosition: 'right' }
      },
      {
        label: '画布高度',
        key: 'canvasHeight',
        type: 'number',
        props: { min: 320, max: 3000, step: 20, controlsPosition: 'right' }
      },
      {
        label: '排序',
        key: 'sort',
        type: 'number',
        props: { min: 0, max: 9999, controlsPosition: 'right' }
      },
      {
        label: '场景底图',
        key: 'backgroundUrl',
        span: 24,
        type: 'uploadImage',
        get props(): FormItem['props'] {
          return { limit: 1, size: 132, title: '上传场景底图', fileType: 'image/*' }
        }
      }
    ],
    rules: {
      sceneName: [{ required: true, message: '请输入场景名称', trigger: 'blur' }],
      canvasWidth: [{ required: true, message: '请输入画布宽度', trigger: 'change' }],
      canvasHeight: [{ required: true, message: '请输入画布高度', trigger: 'change' }]
    }
  })

  const markCurrentDisabled = (rows: SmisRiskMapScene[], currentId?: string): SmisRiskMapScene[] =>
    rows.map((row) => ({
      ...row,
      disabled: row.id === currentId,
      children: row.children ? markCurrentDisabled(row.children, currentId) : []
    })) as SmisRiskMapScene[]
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const result = await saveRiskMapScene({
        ...toRaw(form.model),
        sceneName: form.model.sceneName.trim(),
        backgroundUrl: normalizeNullableText(form.model.backgroundUrl)
      })
      const id = String(result.data || form.model.id)
      emit('success', id, form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '风险四色图场景保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: RiskMapSceneDialogOpenData): Promise<void> => {
    Object.assign(form.model, initial())
    sceneTree.value = markCurrentDisabled(data.sceneTree, data.row?.id)
    if (data.row) {
      Object.assign(form.model, {
        id: data.row.id,
        parentId: data.row.parentId || null,
        sceneName: data.row.sceneName,
        backgroundUrl: data.row.backgroundUrl || '',
        canvasWidth: data.row.canvasWidth,
        canvasHeight: data.row.canvasHeight,
        sort: data.row.sort
      })
    } else {
      form.model.parentId = data.presetParentId || null
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑四色图场景' : '新增四色图场景',
      subtitle: '配置层级、画布尺寸与场景底图',
      confirmText: data.row ? '保存场景设置' : '创建场景',
      contentMaxHeight: 'calc(100vh - 180px)',
      onConfirm: handleSubmit
    })
  }

  defineExpose({ handleOpen })
</script>
