<template>
  <ArtDialog ref="dialogRef" size="lg" @error="handleDialogError">
    <div class="safety-inspection-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:shield-check-line" /></template>
        <strong>{{
          form.model.id ? form.model.inspectionName : '形成可追溯的安全检查记录'
        }}</strong>
        <p>{{ targetTenantLabel }} · 类别、组织、员工和附件归属同一租户，保留检查时点名称快照。</p>
      </ArtEntitySummary>
      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="24"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
        tenant-scope-mode="manual"
      >
        <template #inspectionTypeId>
          <ElSelect
            v-model="form.model.inspectionTypeId"
            filterable
            placeholder="请选择排查类型"
            class="w-full"
          >
            <ElOption
              v-for="item in inspectionTypes"
              :key="item.id"
              :label="`${item.typeName} · ${item.typeCode}`"
              :value="item.id"
            />
          </ElSelect>
        </template>
        <template #inspectionOrganizationId>
          <OrganizationTreeSelect
            v-model="form.model.inspectionOrganizationId"
            :organizations="organizations"
            title="选择检查单位"
            placeholder="点击选择检查单位"
          />
        </template>
        <template #inspectedOrganizationId>
          <OrganizationTreeSelect
            v-model="form.model.inspectedOrganizationId"
            :organizations="organizations"
            title="选择被检查单位"
            placeholder="点击选择被检查单位"
          />
        </template>
        <template #inspectorIds>
          <ArtEmployeeSelect
            v-model:model-values="form.model.inspectorIds"
            v-model:selected-data="inspectorSelection"
            multiple
            :tenant-id="form.model.tenantId"
            title="选择检查人"
            subtitle="数据来自记录所属租户的员工花名册，可多选"
            placeholder="选择一名或多名检查人"
          />
        </template>
        <template #planAttachmentUrls>
          <ArtUploadFile
            v-model="form.model.planAttachmentUrls"
            multiple
            :limit="8"
            :resource-tenant-id="form.model.tenantId"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,image/*"
            tip="支持检查计划、表单、图片与压缩包，单个文件不超过 20 MB"
          />
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { useTenantScopeFormPolicy } from '@/hooks/core/useTenantScopeFormPolicy'
  import {
    createTenantScopeReadGuard,
    resolveTenantWriteTargetId
  } from '@/utils/tenant-scope-context'
  import { formatTenantLabel, toTenantSelectOptions } from '@/utils/tenant-display'
  import TreeUtils from '@/utils/tree'
  import { toDualControlOrganizationTree } from '@smis/views/dual-control-system/shared/organization-tree'
  import {
    saveSafetyInspection,
    type SmisSafetyInspectionOrganization,
    type SmisSafetyInspectionPayload,
    type SmisSafetyInspectionRecord,
    type SmisSafetyInspectionTypeOption
  } from '@smis/api'
  import OrganizationTreeSelect from '@smis/views/dual-control-system/shared/organization-tree-select.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'

  export interface SafetyInspectionDialogOpenData {
    row?: SmisSafetyInspectionRecord
    inspectionTypes: SmisSafetyInspectionTypeOption[]
    organizations: SmisSafetyInspectionOrganization[]
    presetInspectionTypeId?: string
    presetInspectedOrganizationId?: string
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getUserInfo, isPlatformSuper } = storeToRefs(userStore)
  const tenantScopeStore = useTenantScopeStore()
  const {
    tenantOptions,
    loading: tenantLoading,
    loadError: tenantError
  } = storeToRefs(tenantScopeStore)
  const { effectiveTenantId, shouldExposeTenantField } = useTenantScopeFormPolicy()
  const dialogRef = ref<ArtDialogExpose<SafetyInspectionDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const inspectorSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const tenantSelectOptions = computed(() =>
    toTenantSelectOptions(
      tenantOptions.value.length
        ? tenantOptions.value
        : getUserInfo.value.tenantId
          ? [
              {
                id: getUserInfo.value.tenantId,
                tenantCode: getUserInfo.value.tenant?.tenantCode,
                tenantName: getUserInfo.value.tenant?.tenantName || '账号所属租户'
              }
            ]
          : []
    )
  )
  const options = reactive({
    inspectionTypes: [] as SmisSafetyInspectionTypeOption[],
    organizations: [] as SmisSafetyInspectionOrganization[]
  })
  const initial = (): SmisSafetyInspectionPayload => ({
    id: undefined,
    tenantId: '',
    inspectionTypeId: '',
    inspectionName: '',
    inspectionOrganizationId: '',
    inspectedOrganizationId: '',
    inspectionTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    planAttachmentUrls: [],
    inspectorIds: [],
    remark: ''
  })
  const form = reactive<{
    model: SmisSafetyInspectionPayload
    items: ComputedRef<FormItem[]>
    rules: FormRules<SmisSafetyInspectionPayload>
  }>({
    model: initial(),
    items: computed((): FormItem[] => [
      { label: '检查信息', key: 'base', type: 'divider', span: 24 },
      ...(isPlatformSuper.value && shouldExposeTenantField.value && !form.model.id
        ? [
            {
              label: '所属租户',
              key: 'tenantId',
              type: 'select' as const,
              span: 24,
              options: tenantSelectOptions.value,
              description: tenantError.value
                ? '租户列表加载失败，可关闭后重新打开重试。'
                : '变更所属租户将清空类别、组织、人员和附件，请重新选择。',
              props: { filterable: true, clearable: false, loading: tenantLoading.value }
            }
          ]
        : []),
      { label: '检查名称', key: 'inspectionName', type: 'input', props: { maxlength: 160 } },
      { label: '检查类别', key: 'inspectionTypeId', type: 'text' },
      {
        label: '检查时间',
        key: 'inspectionTime',
        type: 'date',
        props: {
          type: 'datetime',
          valueFormat: 'YYYY-MM-DD HH:mm:ss',
          clearable: true,
          class: '!w-full'
        }
      },
      { label: '检查人员', key: 'people', type: 'divider', span: 24 },
      { label: '检查单位', key: 'inspectionOrganizationId', type: 'text' },
      { label: '被检查单位', key: 'inspectedOrganizationId', type: 'text' },
      { label: '检查人', key: 'inspectorIds', type: 'text', span: 24 },
      { label: '证据材料', key: 'evidence', type: 'divider', span: 24 },
      { label: '检查计划附件', key: 'planAttachmentUrls', type: 'text', span: 24 },
      {
        label: '检查说明',
        key: 'remark',
        type: 'textarea',
        span: 24,
        props: { rows: 4, maxlength: 2000, showWordLimit: true, resize: 'none' }
      }
    ]),
    rules: {
      tenantId: [{ required: true, message: '请选择所属租户', trigger: 'change' }],
      inspectionName: [{ required: true, message: '请输入检查名称', trigger: 'blur' }],
      inspectionTypeId: [{ required: true, message: '请选择检查类别', trigger: 'change' }],
      inspectionOrganizationId: [{ required: true, message: '请选择检查单位', trigger: 'change' }],
      inspectedOrganizationId: [{ required: true, message: '请选择被检查单位', trigger: 'change' }],
      inspectionTime: [{ required: true, message: '请选择检查时间', trigger: 'change' }],
      inspectorIds: [
        {
          type: 'array',
          required: true,
          min: 1,
          message: '请至少选择一名检查人',
          trigger: 'change'
        }
      ]
    }
  })

  const organizationTree = new TreeUtils({ parentKey: 'parentId' })
  const targetTenantLabel = computed(() =>
    formatTenantLabel(
      {
        tenant:
          tenantOptions.value.find((tenant) => tenant.id === form.model.tenantId) ||
          (form.model.tenantId === getUserInfo.value.tenantId ? getUserInfo.value.tenant : null)
      },
      '记录所属租户'
    )
  )
  const inspectionTypes = computed(() =>
    options.inspectionTypes.filter((item) => item.tenantId === form.model.tenantId)
  )
  const organizations = computed(() =>
    toDualControlOrganizationTree(
      organizationTree
        .treeToList(options.organizations)
        .filter((item) => item.tenantId === form.model.tenantId)
    )
  )
  watch(
    () => form.model.tenantId,
    () => {
      form.model.inspectionTypeId = ''
      form.model.inspectionOrganizationId = ''
      form.model.inspectedOrganizationId = ''
      form.model.inspectorIds = []
      form.model.planAttachmentUrls = []
      inspectorSelection.value = []
    },
    { flush: 'sync' }
  )

  const toSelectedEmployees = (row: SmisSafetyInspectionRecord): EmployeeIntegrationItem[] =>
    row.inspectors.map((employee) => ({
      id: employee.id,
      tenantId: employee.tenantId,
      organizationId: employee.organizationId ?? null,
      employeeNo: employee.employeeNo,
      employeeName: employee.employeeName,
      avatarUrl: null,
      jobTitle: employee.jobTitle ?? null,
      employmentStatus: employee.employmentStatus
    }))
  const handleDialogError = (error: unknown): void => {
    notifyFriendlyError(error, '安全检查表单初始化失败，请重新打开后重试')
    void dialogRef.value?.handleClose(true)
  }
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await saveSafetyInspection({
        ...toRaw(form.model),
        tenantId: resolveTenantWriteTargetId({
          explicitTenantId: dialogRef.value?.getData()?.row?.tenantId || form.model.tenantId,
          effectiveTenantId: effectiveTenantId.value,
          actorTenantId: getUserInfo.value.tenantId,
          canWriteToOtherTenant: isPlatformSuper.value
        }),
        inspectionName: form.model.inspectionName.trim(),
        remark: normalizeNullableText(form.model.remark),
        planAttachmentUrls: [...form.model.planAttachmentUrls],
        inspectorIds: [...form.model.inspectorIds]
      })
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '安全检查保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: SafetyInspectionDialogOpenData): Promise<void> => {
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑安全检查' : '新增安全检查',
      subtitle: '明确检查对象、类别、时间、人员和计划证据',
      confirmText: data.row ? '保存更改' : '创建检查记录',
      contentMaxHeight: 'calc(100vh - 150px)',
      onConfirm: handleSubmit,
      onOpen: async () => {
        const assertScope = createTenantScopeReadGuard()
        Object.assign(form.model, initial())
        form.model.tenantId = resolveTenantWriteTargetId({
          explicitTenantId: data.row?.tenantId,
          effectiveTenantId: effectiveTenantId.value,
          actorTenantId: getUserInfo.value.tenantId,
          canWriteToOtherTenant: isPlatformSuper.value
        })
        options.inspectionTypes = data.inspectionTypes
        options.organizations = data.organizations
        inspectorSelection.value = []
        if (data.row) {
          Object.assign(form.model, {
            id: data.row.id,
            inspectionTypeId: data.row.inspectionTypeId,
            inspectionName: data.row.inspectionName,
            inspectionOrganizationId: data.row.inspectionOrganizationId,
            inspectedOrganizationId: data.row.inspectedOrganizationId,
            inspectionTime: dayjs(data.row.inspectionTime).format('YYYY-MM-DD HH:mm:ss'),
            planAttachmentUrls: [...data.row.planAttachmentUrls],
            inspectorIds: data.row.inspectors.map((employee) => employee.id),
            remark: data.row.remark || ''
          })
          inspectorSelection.value = toSelectedEmployees(data.row)
        } else {
          form.model.inspectionTypeId = inspectionTypes.value.some(
            (item) => item.id === data.presetInspectionTypeId
          )
            ? data.presetInspectionTypeId || ''
            : ''
          form.model.inspectedOrganizationId = organizationTree.findNode(
            organizations.value,
            data.presetInspectedOrganizationId || ''
          )
            ? data.presetInspectedOrganizationId || ''
            : ''
        }
        if (isPlatformSuper.value && shouldExposeTenantField.value && !data.row) {
          await tenantScopeStore.loadTenantOptions()
          assertScope()
        }
        await nextTick()
        formRef.value?.clearValidate()
      }
    })
  }

  defineExpose({ handleOpen })
</script>
