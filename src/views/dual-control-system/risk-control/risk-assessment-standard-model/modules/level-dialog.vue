<template>
  <ArtDialog ref="dialogRef" size="sm"
    ><ArtForm
      ref="formRef"
      v-model="model"
      :items="items"
      :rules="rules"
      :span="24"
      label-position="top"
  /></ArtDialog>
</template>
<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { ElMessage, type FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    saveRiskAssessmentLevel,
    type SmisRiskAssessmentLevel,
    type SmisRiskAssessmentLevelPayload
  } from '@smis/api'
  export interface LevelDialogOpenData {
    row: SmisRiskAssessmentLevel
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }
  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<LevelDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const model = ref<SmisRiskAssessmentLevelPayload>({
    id: '',
    levelName: '',
    minScore: 0,
    maxScore: null,
    color: '#2563EB',
    tagStyle: 'primary',
    sort: 10
  })
  const tagOptions = computed(() =>
    (getDictMap.value.smisTagStyle ?? []).filter((i) => i.value).map(toDictionaryOption)
  )
  const items = computed<FormItem[]>(() => [
    {
      label: '风险等级名称',
      key: 'levelName',
      type: 'input',
      props: { maxlength: 50, clearable: true }
    },
    {
      label: '最低分（含）',
      key: 'minScore',
      type: 'number',
      props: { min: 0, max: 999999, precision: 2, controlsPosition: 'right' }
    },
    {
      label: '最高分（不含）',
      key: 'maxScore',
      type: 'number',
      description: '最高风险等级可留空，表示无上限。',
      props: { min: 0, max: 999999, precision: 2, controlsPosition: 'right' }
    },
    {
      label: '等级颜色',
      key: 'color',
      type: 'colorPicker',
      props: {
        predefine: ['#2563EB', '#059669', '#FACC15', '#F97316', '#DC2626'],
        onChange: (v: string | null) => (model.value.color = v || '#2563EB')
      }
    },
    {
      label: '标签样式',
      key: 'tagStyle',
      type: 'tagStyleSelect',
      options: tagOptions.value,
      props: { clearable: false, placeholder: '请选择标签样式' }
    },
    {
      label: '排序',
      key: 'sort',
      type: 'number',
      props: { min: 0, max: 9999, controlsPosition: 'right' }
    }
  ])
  const rules: FormRules = {
    levelName: [{ required: true, message: '请输入风险等级名称', trigger: 'blur' }],
    minScore: [{ required: true, message: '请输入最低分', trigger: 'change' }],
    tagStyle: [{ required: true, message: '请选择标签样式', trigger: 'change' }]
  }
  const submit = async () => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '风险等级校验失败，请重试')
      return false
    }
    if (model.value.maxScore != null && model.value.maxScore <= model.value.minScore) {
      ElMessage.warning('最高分必须大于最低分')
      return false
    }
    try {
      await saveRiskAssessmentLevel({ ...model.value, levelName: model.value.levelName.trim() })
    } catch (error) {
      notifyFriendlyError(error, '风险等级保存失败，请检查内容后重试')
      return false
    }
    emit('success')
    return true
  }
  const handleOpen = async (data: LevelDialogOpenData) => {
    Object.assign(model.value, {
      id: data.row.id,
      levelName: data.row.levelName,
      minScore: data.row.minScore,
      maxScore: data.row.maxScore,
      color: data.row.color,
      tagStyle: data.row.tagStyle,
      sort: data.row.sort
    })
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: `编辑“${data.row.levelName}”等级`,
      subtitle: '调整分值区间、颜色与标签样式',
      confirmText: '保存风险等级',
      onOpen: async (_d, api) => {
        api.setLoading(true)
        try {
          await userStore.ensureDictLoaded('smisTagStyle')
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: submit
    })
  }
  defineExpose({ handleOpen })
</script>
