<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="hazard-registration-dialog">
      <div class="hazard-registration-dialog__context" role="note">
        <span aria-hidden="true"><ArtSvgIcon icon="ri:alarm-warning-line" /></span>
        <div>
          <strong>登记现场隐患并进入核准流程</strong>
          <p>隐患编号保存后按月生成四位流水；上报人默认当前账号关联员工，可按实际情况调整。</p>
        </div>
      </div>
      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="formItems"
        :rules="form.rules"
        :span="12"
        :gutter="24"
        label-position="top"
      >
        <template #siteId>
          <ElTreeSelect
            v-model="form.model.siteId"
            class="hazard-registration-dialog__control"
            :data="options.sites"
            :props="{ label: 'siteName', children: 'children' }"
            node-key="id"
            value-key="id"
            check-strictly
            filterable
            default-expand-all
            placeholder="请选择隐患所在场所"
          />
        </template>
        <template #reporterEmployeeId>
          <ArtEmployeeSelect
            v-model="form.model.reporterEmployeeId"
            v-model:selected-data="form.reporterSelection"
            :tenant-id="getUserInfo.tenantId"
            title="选择上报人"
            subtitle="数据来自当前租户员工花名册"
            placeholder="点击从员工花名册选择"
          />
        </template>
        <template #imageUrls>
          <ArtUploadImage
            v-model="form.model.imageUrls"
            title="上传隐患照片"
            multiple
            :limit="9"
            :size="104"
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
  import type { FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    registerHiddenHazard,
    type SmisHiddenHazardRegistrationPayload,
    type SmisSite
  } from '@smis/api'

  export interface HazardRegistrationDialogOpenData {
    sites: SmisSite[]
  }
  interface RegistrationFormModel extends SmisHiddenHazardRegistrationPayload {
    hazardNo: string
    rectificationSuggestion: string
  }
  interface RegistrationFormGroup {
    model: RegistrationFormModel
    rules: FormRules<RegistrationFormModel>
    reporterSelection: EmployeeIntegrationItem[]
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap, getUserInfo } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<HazardRegistrationDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const formItems = ref<FormItem[]>([])
  const options = reactive<{ sites: SmisSite[] }>({ sites: [] })
  const initialModel = (): RegistrationFormModel => ({
    hazardNo: '',
    description: '',
    siteId: '',
    hazardLevel: '',
    reporterEmployeeId: getUserInfo.value.hrEmployeeId || '',
    reportedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    imageUrls: [],
    rectificationSuggestion: ''
  })
  const form = reactive<RegistrationFormGroup>({
    model: initialModel(),
    rules: {
      description: [{ required: true, message: '请输入隐患描述', trigger: 'blur' }],
      siteId: [{ required: true, message: '请选择隐患位置', trigger: 'change' }],
      hazardLevel: [{ required: true, message: '请选择隐患级别', trigger: 'change' }],
      reporterEmployeeId: [{ required: true, message: '请选择上报人', trigger: 'change' }],
      reportedAt: [{ required: true, message: '请选择上报时间', trigger: 'change' }]
    },
    reporterSelection: []
  })
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const buildItems = (): FormItem[] => [
    { label: '登记信息', key: 'identity', type: 'divider', span: 24 },
    {
      label: '隐患编号',
      key: 'hazardNo',
      type: 'input',
      span: 8,
      description: '保存后按 YH + 年月 + 四位流水自动生成',
      props: { readonly: true, placeholder: '保存后自动生成' }
    },
    { label: '隐患位置', key: 'siteId', type: 'text', span: 8 },
    {
      label: '隐患级别',
      key: 'hazardLevel',
      type: 'select',
      span: 8,
      options: dictOptions('smisHazardLevel'),
      props: { clearable: false, placeholder: '请选择隐患级别' }
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
        placeholder: '说明隐患现象、涉及设备或区域以及当前风险'
      }
    },
    { label: '上报信息', key: 'report', type: 'divider', span: 24 },
    { label: '上报人', key: 'reporterEmployeeId', type: 'text', span: 12 },
    {
      label: '上报时间',
      key: 'reportedAt',
      type: 'date',
      span: 12,
      props: {
        type: 'datetime',
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
        class: '!w-full',
        clearable: false,
        placeholder: '请选择上报时间'
      }
    },
    { label: '现场证据', key: 'imageUrls', type: 'text', span: 24 },
    {
      label: '整改建议',
      key: 'rectificationSuggestion',
      type: 'textarea',
      span: 24,
      props: {
        rows: 3,
        maxlength: 1000,
        showWordLimit: true,
        resize: 'none',
        placeholder: '可填写建议采取的控制或整改措施'
      }
    }
  ]

  const currentEmployeeSelection = (): EmployeeIntegrationItem[] => {
    const employee = getUserInfo.value.hrEmployee
    if (!employee) return []
    return [
      {
        id: employee.id,
        tenantId: getUserInfo.value.tenantId || '',
        organizationId: null,
        employeeNo: employee.employeeNo,
        employeeName: employee.employeeName,
        jobTitle: employee.jobTitle,
        employmentStatus: employee.employmentStatus || 'active'
      }
    ]
  }
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await registerHiddenHazard({
        description: form.model.description.trim(),
        siteId: form.model.siteId,
        hazardLevel: form.model.hazardLevel,
        reporterEmployeeId: form.model.reporterEmployeeId,
        reportedAt: form.model.reportedAt,
        imageUrls: [...form.model.imageUrls],
        rectificationSuggestion: normalizeNullableText(form.model.rectificationSuggestion)
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '隐患登记保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: HazardRegistrationDialogOpenData): Promise<void> => {
    Object.assign(form.model, initialModel())
    options.sites = data.sites
    form.reporterSelection = currentEmployeeSelection()
    formItems.value = buildItems()
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: '隐患登记',
      subtitle: '记录隐患位置、级别、现场证据与上报信息',
      confirmText: '登记隐患',
      contentMaxHeight: 'calc(100vh - 150px)',
      loading: true,
      onOpen: async (_openData, api) => {
        try {
          await userStore.ensureDictLoaded('smisHazardLevel')
          formItems.value = buildItems()
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit,
      onReset: () => {
        Object.assign(form.model, initialModel())
        form.reporterSelection = []
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .hazard-registration-dialog {
    min-width: 0;

    &__context {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      padding: 14px 16px;
      margin-bottom: 18px;
      background: color-mix(in srgb, var(--el-color-warning) 8%, var(--default-box-color));
      border-left: 3px solid var(--el-color-warning);
      border-radius: var(--el-border-radius-base);
    }

    &__context > span {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      color: var(--el-color-warning);
      background: var(--default-box-color);
      border-radius: var(--el-border-radius-base);
    }

    &__context p {
      margin: 3px 0 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__control {
      width: 100%;
    }
  }
</style>
