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
    <div class="hazard-dialog">
      <ArtEntitySummary
        icon="ri:alarm-warning-line"
        title="危险源基础信息与管控责任"
        description="危险源编号保存后按租户编号规则自动生成；提交后进入正式台账统计。"
        spaced
      />
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
      </ArtForm>
    </div>

    <template #footer="{ api }">
      <div class="hazard-dialog__footer">
        <ElButton :disabled="submitting" @click="api.handleClose()">关闭</ElButton>
        <ElButton :loading="submitting" @click="handleSave(false)">保存</ElButton>
        <ElButton
          v-auth="'SmisHazardSourceLedger:Submit'"
          type="primary"
          :loading="submitting"
          @click="handleSave(true)"
        >
          保存并提交
        </ElButton>
      </div>
    </template>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'
  import type { FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchHazardSourceEmployees,
    saveHazardSource,
    type SmisHazardSite,
    type SmisTreeOrganization,
    type SmisHazardSource,
    type SmisHazardSourceLevel,
    type SmisHazardSourceRiskLevel
  } from '@smis/api'

  export interface HazardSourceDialogOpenData {
    row?: SmisHazardSource
    sites: SmisHazardSite[]
    organizations: SmisTreeOrganization[]
    presetSiteId?: string
  }
  interface HazardForm {
    id?: string
    hazardNo: string
    hazardName: string
    siteId: string
    hazardLevel: SmisHazardSourceLevel | ''
    riskLevel: SmisHazardSourceRiskLevel
    controlOrganizationId: string
    responsibleEmployeeId?: string
    quantity?: number
    location: string
    evaluationDate: string
    evaluationOrganization: string
    filingDate: string
    filingOrganization: string
    filingNo: string
    imageUrls: string[]
    remark: string
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap, getUserInfo } = storeToRefs(userStore)
  const activeFormTab = ref('identity')
  const dialogRef = ref<ArtDialogExpose<HazardSourceDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const numberRule = useDocumentNumberRule('smis.hazard_source')
  const submitting = ref(false)
  const sites = shallowRef<SmisHazardSite[]>([])
  const organizations = shallowRef<SmisTreeOrganization[]>([])
  const employeeSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const initialForm = (): HazardForm => ({
    hazardNo: '',
    hazardName: '',
    siteId: '',
    hazardLevel: '',
    riskLevel: 'unidentified',
    controlOrganizationId: '',
    responsibleEmployeeId: undefined,
    quantity: undefined,
    location: '',
    evaluationDate: '',
    evaluationOrganization: '',
    filingDate: '',
    filingOrganization: '',
    filingNo: '',
    imageUrls: [],
    remark: ''
  })
  const form = ref<HazardForm>(initialForm())
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const items = computed<FormItem[]>(() => [
    { label: '危险源与责任', key: 'identity', type: 'tab', span: 24 },
    {
      label: '危险源编号',
      key: 'hazardNo',
      type: 'input',
      description: numberRule.description.value,
      props: numberRule.inputProps(Boolean(form.value.id), '保存后自动生成', true)
    },
    {
      label: '危险源名称',
      key: 'hazardName',
      type: 'input',
      props: { maxlength: 160, placeholder: '请输入危险源名称' }
    },
    {
      label: '所在场所',
      key: 'siteId',
      type: 'treeSelect',
      get props(): FormItem['props'] {
        return {
          data: sites.value,
          props: { label: 'siteName', children: 'children' },
          nodeKey: 'id',
          valueKey: 'id',
          checkStrictly: true,
          filterable: true,
          defaultExpandAll: true,
          placeholder: '请选择场所'
        }
      }
    },
    {
      label: '数量',
      key: 'quantity',
      type: 'number',
      props: {
        min: 0.001,
        precision: 3,
        step: 1,
        controlsPosition: 'right',
        class: '!w-full',
        placeholder: '请输入数量'
      }
    },
    {
      label: '地点',
      key: 'location',
      type: 'input',
      props: { maxlength: 200, placeholder: '请输入危险源具体地点' }
    },
    {
      label: '危险等级',
      key: 'hazardLevel',
      type: 'select',
      options: dictOptions('smisHazardSourceLevel'),
      props: { clearable: false }
    },

    {
      label: '风险等级',
      key: 'riskLevel',
      type: 'select',
      options: dictOptions('smisHazardSourceRiskLevel'),
      props: { clearable: false }
    },
    {
      label: '管控部门',
      key: 'controlOrganizationId',
      type: 'treeSelect',
      get props(): FormItem['props'] {
        return {
          data: organizations.value,
          props: { label: 'organizationName', children: 'children' },
          nodeKey: 'id',
          valueKey: 'id',
          checkStrictly: true,
          filterable: true,
          defaultExpandAll: true,
          placeholder: '请选择管控部门'
        }
      }
    },
    {
      label: '责任人',
      key: 'responsibleEmployeeId',
      type: 'employeeSelect',
      get props(): FormItem['props'] {
        return {
          selectedData: employeeSelection.value,
          'onUpdate:selectedData': ($event: typeof employeeSelection.value) => {
            employeeSelection.value = $event
          },
          apiFn: fetchHazardSourceEmployees,
          tenantId: getUserInfo.value.tenantId,
          title: '选择危险源责任人',
          subtitle: '数据来自当前租户员工花名册',
          placeholder: '点击从员工花名册选择'
        }
      }
    },
    { label: '评价与资料', key: 'archive', type: 'tab', span: 24 },
    {
      label: '评价时间',
      key: 'evaluationDate',
      type: 'date',
      props: {
        valueFormat: 'YYYY-MM-DD',
        clearable: true,
        class: '!w-full',
        placeholder: '请选择评价时间'
      }
    },
    {
      label: '评价单位',
      key: 'evaluationOrganization',
      type: 'input',
      props: { maxlength: 200, placeholder: '请输入评价单位' }
    },
    {
      label: '备案时间',
      key: 'filingDate',
      type: 'date',
      props: {
        valueFormat: 'YYYY-MM-DD',
        clearable: true,
        class: '!w-full',
        placeholder: '请选择备案时间'
      }
    },
    {
      label: '备案单位',
      key: 'filingOrganization',
      type: 'input',
      props: { maxlength: 200, placeholder: '请输入备案单位' }
    },
    {
      label: '备案号',
      key: 'filingNo',
      type: 'input',
      span: 24,
      props: { maxlength: 100, placeholder: '请输入备案号' }
    },

    {
      label: '危险源照片',
      key: 'imageUrls',
      span: 24,
      type: 'uploadImage',
      get props(): FormItem['props'] {
        return { title: '上传危险源照片', multiple: true, limit: 9, size: 112 }
      }
    },
    {
      label: '备注',
      key: 'remark',
      type: 'textarea',
      span: 24,
      props: {
        rows: 4,
        maxlength: 1000,
        showWordLimit: true,
        resize: 'none',
        placeholder: '补充危险特征、管控边界或现场说明'
      }
    }
  ])
  const rules: FormRules<HazardForm> = {
    hazardName: [{ required: true, message: '请输入危险源名称', trigger: 'blur' }],
    siteId: [{ required: true, message: '请选择场所', trigger: 'change' }],
    hazardLevel: [{ required: true, message: '请选择危险等级', trigger: 'change' }],
    riskLevel: [{ required: true, message: '请选择风险等级', trigger: 'change' }],
    controlOrganizationId: [{ required: true, message: '请选择管控部门', trigger: 'change' }]
  }

  const toEmployeeSelection = (row: SmisHazardSource): EmployeeIntegrationItem[] =>
    row.responsibleEmployeeId
      ? [
          {
            id: row.responsibleEmployeeId,
            tenantId: getUserInfo.value.tenantId || '',
            organizationId: row.controlOrganizationId,
            employeeNo: row.responsibleEmployeeNo || '',
            employeeName: row.responsibleEmployeeName || '未命名员工',
            avatarUrl: null,
            jobTitle: null,
            employmentStatus: 'active',
            organization: {
              id: row.controlOrganizationId,
              organizationCode: '',
              organizationName: row.controlOrganizationName
            }
          }
        ]
      : []
  const handleSave = async (submit: boolean): Promise<void> => {
    if (submitting.value) return
    try {
      await formRef.value?.validate()
      submitting.value = true
      await saveHazardSource(
        {
          ...toRaw(form.value),
          hazardLevel: form.value.hazardLevel as SmisHazardSourceLevel,
          responsibleEmployeeId: form.value.responsibleEmployeeId || null,
          quantity: form.value.quantity ?? null,
          location: form.value.location || null,
          evaluationDate: form.value.evaluationDate || null,
          evaluationOrganization: form.value.evaluationOrganization || null,
          filingDate: form.value.filingDate || null,
          filingOrganization: form.value.filingOrganization || null,
          filingNo: form.value.filingNo || null
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
  const handleOpen = async (data: HazardSourceDialogOpenData): Promise<void> => {
    Object.assign(form.value, initialForm())
    sites.value = data.sites
    organizations.value = data.organizations
    employeeSelection.value = []
    if (data.row) {
      Object.assign(form.value, {
        id: data.row.id,
        hazardNo: data.row.hazardNo,
        hazardName: data.row.hazardName,
        siteId: data.row.siteId,
        hazardLevel: data.row.hazardLevel,
        riskLevel: data.row.riskLevel,
        controlOrganizationId: data.row.controlOrganizationId,
        responsibleEmployeeId: data.row.responsibleEmployeeId || undefined,
        quantity: data.row.quantity ?? undefined,
        location: data.row.location || '',
        evaluationDate: data.row.evaluationDate || '',
        evaluationOrganization: data.row.evaluationOrganization || '',
        filingDate: data.row.filingDate || '',
        filingOrganization: data.row.filingOrganization || '',
        filingNo: data.row.filingNo || '',
        imageUrls: [...data.row.imageUrls],
        remark: data.row.remark || ''
      })
      employeeSelection.value = toEmployeeSelection(data.row)
    } else form.value.siteId = data.presetSiteId || ''
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑危险源' : '新增危险源',
      subtitle: '维护危险源识别、场所归属、风险分级与管控责任',
      contentMaxHeight: 'calc(100vh - 150px)',
      loading: true,
      onOpen: async (_data, api) => {
        try {
          await Promise.all([
            numberRule.loadRule(),
            userStore.ensureDictLoaded('smisHazardSourceLevel'),
            userStore.ensureDictLoaded('smisHazardSourceRiskLevel')
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
  .hazard-dialog {
    &__control {
      width: 100%;
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
