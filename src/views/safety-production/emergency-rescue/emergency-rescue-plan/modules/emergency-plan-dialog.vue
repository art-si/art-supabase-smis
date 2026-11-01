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
    <div class="plan-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:file-shield-2-line" /></template>
        <strong>预案适用范围与演练规则</strong
        ><p>预案编码保存后自动生成；预案级别随适用单位自动联动，不允许手工篡改。</p>
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
        <template #planLevel>
          <div class="plan-dialog__derived">
            <ArtDictDisplay
              dict-code="smisEmergencyPlanLevel"
              :value="derivedPlanLevel"
              display="tag"
            />
            <small>由适用单位自动联动</small>
          </div>
        </template>
        <template #isValid>
          <div class="plan-dialog__derived">
            <ElTag :type="currentIsValid ? 'success' : 'info'" effect="light">{{
              currentIsValid ? '是' : '否'
            }}</ElTag>
            <small>请使用列表“有效/置废”操作变更</small>
          </div>
        </template>
      </ArtForm>
    </div>

    <template #footer="{ api }">
      <div class="plan-dialog__footer">
        <ElButton @click="api.handleClose()">关闭</ElButton>
        <ElButton :loading="submitting" @click="handleSave(false)">保存</ElButton>
        <ElButton
          v-auth="'SmisEmergencyRescuePlan:Submit'"
          type="primary"
          :loading="submitting"
          @click="handleSave(true)"
          >保存并提交</ElButton
        >
      </div>
    </template>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import { useUserStore } from '@/store/modules/user'
  import TreeUtils from '@/utils/tree'
  import {
    saveEmergencyRescuePlan,
    type SmisEmergencyPosition,
    type SmisEmergencyRescuePlan,
    type SmisEmergencyPlanCategory,
    type SmisEmergencyPlanFrequency,
    type SmisEmergencyPlanLevel,
    type SmisTreeOrganization
  } from '@smis/api'

  export interface EmergencyPlanDialogOpenData {
    row?: SmisEmergencyRescuePlan
    organizations: SmisTreeOrganization[]
    positions: SmisEmergencyPosition[]
  }
  interface PlanForm {
    id?: string
    planNo: string
    planName: string
    planVersion: string
    applicableOrganizationId: string
    planCategory: SmisEmergencyPlanCategory | ''
    applicablePositionIds: string[]
    frequency: SmisEmergencyPlanFrequency | ''
    reviewDate: string
    reviewExperts: string
    planAttachmentUrls: string[]
    filingAttachmentUrls: string[]
    isSpecialEquipmentDrill: boolean
    description: string
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const activeFormTab = ref('identity')
  const dialogRef = ref<ArtDialogExpose<EmergencyPlanDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const numberRule = useDocumentNumberRule('smis.emergency_rescue_plan')
  const organizations = shallowRef<SmisTreeOrganization[]>([])
  const positions = shallowRef<SmisEmergencyPosition[]>([])
  const currentIsValid = ref(true)
  const submitting = ref(false)
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const initialForm = (): PlanForm => ({
    planNo: '',
    planName: '',
    planVersion: '',
    applicableOrganizationId: '',
    planCategory: '',
    applicablePositionIds: [],
    frequency: '',
    reviewDate: '',
    reviewExperts: '',
    planAttachmentUrls: [],
    filingAttachmentUrls: [],
    isSpecialEquipmentDrill: false,
    description: ''
  })
  const form = ref<PlanForm>(initialForm())
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const flatOrganizations = computed(
    () => treeUtils.treeToList(organizations.value) as SmisTreeOrganization[]
  )
  const selectedOrganization = computed(() =>
    flatOrganizations.value.find((item) => item.id === form.value.applicableOrganizationId)
  )
  const positionOptions = computed(() => positions.value)
  const isPublicScope = computed(
    () =>
      ['00'].includes(selectedOrganization.value?.organizationCode || '') ||
      Boolean(selectedOrganization.value?.organizationCode?.endsWith('-00'))
  )
  const derivedPlanLevel = computed<SmisEmergencyPlanLevel>(() => {
    const organization = selectedOrganization.value
    if (!organization || organization.organizationType === 'company') return 'company'
    if (organization.organizationType === 'division') return 'operation_area'
    let depth = 1
    let parentId = organization.parentId
    while (parentId) {
      depth += 1
      parentId = flatOrganizations.value.find((item) => item.id === parentId)?.parentId
    }
    return depth >= 4 ? 'team' : 'operation_department'
  })
  const booleanOptions = computed(() =>
    dictOptions('commonBoolean').map((item) => ({ ...item, value: item.value === 'true' }))
  )
  const items = computed<FormItem[]>(() => [
    { label: '预案与范围', key: 'identity', type: 'tab', span: 24 },
    {
      label: '预案编码',
      key: 'planNo',
      type: 'input',
      description: numberRule.description.value,
      props: numberRule.inputProps(Boolean(form.value.id), '保存后自动生成', true)
    },
    {
      label: '预案名称',
      key: 'planName',
      type: 'input',
      props: { maxlength: 160, placeholder: '请输入预案名称' }
    },
    {
      label: '预案版本号',
      key: 'planVersion',
      type: 'input',
      props: { maxlength: 60, placeholder: '例如：V1.0' }
    },
    {
      label: '预案类别',
      key: 'planCategory',
      type: 'select',
      options: dictOptions('smisEmergencyPlanCategory'),
      props: { clearable: false }
    },
    {
      label: '周期频次',
      key: 'frequency',
      type: 'select',
      options: dictOptions('smisEmergencyPlanFrequency'),
      props: { clearable: false }
    },

    {
      label: '适用单位',
      key: 'applicableOrganizationId',
      type: 'treeSelect',
      description: isPublicScope.value ? '公共单位预案对本公司所有人员可见、可选' : undefined,
      props: {
        data: organizations.value,
        props: { label: 'organizationName', children: 'children' },
        nodeKey: 'id',
        valueKey: 'id',
        checkStrictly: true,
        clearable: false,
        filterable: true,
        defaultExpandAll: true,
        placeholder: '请选择适用单位',
        class: 'w-full!'
      }
    },
    { label: '预案级别', key: 'planLevel', type: 'text' },
    {
      label: '适用岗位',
      key: 'applicablePositionIds',
      span: 24,
      type: 'select',
      get options(): FormItem['options'] {
        return positionOptions.value.map((position) => ({
          label: `${position.positionName} · ${position.positionCode}`,
          value: position.id
        }))
      },
      get props(): FormItem['props'] {
        return {
          filterable: true,
          clearable: true,
          multiple: true,
          collapseTags: true,
          collapseTagsTooltip: true,
          placeholder: '请选择适用岗位；不选表示全部岗位'
        }
      }
    },
    {
      label: '是否特种设备演练',
      key: 'isSpecialEquipmentDrill',
      type: 'segment',
      options: booleanOptions.value
    },
    { label: '评审与资料', key: 'review', type: 'tab', span: 24 },
    {
      label: '评审时间',
      key: 'reviewDate',
      type: 'date',
      props: {
        valueFormat: 'YYYY-MM-DD',
        clearable: true,
        disabledDate: (date: Date) => date.getTime() > Date.now()
      }
    },
    {
      label: '评审专家',
      key: 'reviewExperts',
      type: 'input',
      props: { maxlength: 500, placeholder: '请输入评审专家姓名，多人可用顿号分隔' }
    },
    {
      label: '预案附件',
      key: 'planAttachmentUrls',
      span: 24,
      type: 'uploadFile',
      get props(): FormItem['props'] {
        return {
          multiple: true,
          limit: 10,
          accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,image/*',
          tip: '支持文档、压缩包和图片，最多 10 个，单个文件不超过 20 MB'
        }
      }
    },
    {
      label: '备案表附件',
      key: 'filingAttachmentUrls',
      span: 24,
      type: 'uploadFile',
      get props(): FormItem['props'] {
        return {
          multiple: true,
          limit: 10,
          accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,image/*',
          tip: '支持备案表文档、压缩包和图片，最多 10 个，单个文件不超过 20 MB'
        }
      }
    },

    { label: '是否有效', key: 'isValid', type: 'text' },
    {
      label: '预案描述',
      key: 'description',
      type: 'textarea',
      span: 24,
      props: {
        rows: 5,
        maxlength: 2000,
        showWordLimit: true,
        resize: 'none',
        placeholder: '说明适用场景、响应范围及演练要点'
      }
    }
  ])
  const rules: FormRules<PlanForm> = {
    planName: [{ required: true, message: '请输入预案名称', trigger: 'blur' }],
    planVersion: [{ required: true, message: '请输入预案版本号', trigger: 'blur' }],
    planCategory: [{ required: true, message: '请选择预案类别', trigger: 'change' }],
    frequency: [{ required: true, message: '请选择周期频次', trigger: 'change' }],
    applicableOrganizationId: [{ required: true, message: '请选择适用单位', trigger: 'change' }],
    reviewDate: [{ required: true, message: '请选择评审时间', trigger: 'change' }],
    reviewExperts: [{ required: true, message: '请输入评审专家', trigger: 'blur' }]
  }
  const handleSave = async (submit: boolean): Promise<void> => {
    if (submitting.value) return
    try {
      await formRef.value?.validate()
      submitting.value = true
      await saveEmergencyRescuePlan(
        {
          ...toRaw(form.value),
          planCategory: form.value.planCategory as SmisEmergencyPlanCategory,
          frequency: form.value.frequency as SmisEmergencyPlanFrequency
        },
        submit
      )
      emit('success', form.value.id ? 'edit' : 'add')
      dialogRef.value?.handleClose(true)
    } catch {
      /* 表单或服务端会给出明确提示 */
    } finally {
      submitting.value = false
    }
  }
  const handleOpen = async (data: EmergencyPlanDialogOpenData): Promise<void> => {
    Object.assign(form.value, initialForm())
    organizations.value = data.organizations
    positions.value = data.positions
    currentIsValid.value = data.row?.isValid ?? true
    if (data.row)
      Object.assign(form.value, {
        id: data.row.id,
        planNo: data.row.planNo,
        planName: data.row.planName,
        planVersion: data.row.planVersion || '',
        applicableOrganizationId: data.row.applicableOrganizationId,
        planCategory: data.row.planCategory,
        applicablePositionIds: [...data.row.applicablePositionIds],
        frequency: data.row.frequency,
        reviewDate: data.row.reviewDate || '',
        reviewExperts: data.row.reviewExperts || '',
        planAttachmentUrls: [...data.row.planAttachmentUrls],
        filingAttachmentUrls: [...data.row.filingAttachmentUrls],
        isSpecialEquipmentDrill: data.row.isSpecialEquipmentDrill,
        description: data.row.description || ''
      })
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑应急救援预案' : '新增应急救援预案',
      subtitle: '维护预案版本、适用范围、评审周期与归档附件',
      contentMaxHeight: 'calc(100vh - 150px)',
      loading: true,
      onOpen: async (_data, api) => {
        try {
          await Promise.all([
            numberRule.loadRule(),
            ...[
              'commonBoolean',
              'smisEmergencyPlanCategory',
              'smisEmergencyPlanFrequency',
              'smisEmergencyPlanLevel'
            ].map((code) => userStore.ensureDictLoaded(code))
          ])
        } finally {
          api.setLoading(false)
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .plan-dialog {
    &__control {
      width: 100%;
    }

    &__field-stack {
      display: grid;
      gap: 6px;

      small {
        color: var(--el-color-success);
      }
    }

    &__derived {
      display: flex;
      gap: 10px;
      align-items: center;
      min-height: 32px;

      small {
        color: var(--el-text-color-secondary);
      }
    }

    &__footer {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: flex-end;
      width: 100%;
    }
  }
</style>
