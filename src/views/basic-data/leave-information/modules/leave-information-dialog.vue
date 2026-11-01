<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="leave-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:shield-user-line" /></template>
        <strong>花名册联动与审计快照</strong>
        <p>申请人和代理人来自员工花名册；身份证号自动带出，并按本次请假保存快照。</p>
      </ArtEntitySummary>

      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="24"
        label-position="top"
      >
        <template #organizationId>
          <ElTreeSelect
            v-model="form.model.organizationId"
            class="leave-dialog__full-control"
            :data="organizationTree"
            :props="organizationTreeProps"
            node-key="id"
            value-key="id"
            check-strictly
            filterable
            clearable
            default-expand-all
            placeholder="请选择组织部门"
          />
        </template>

        <template #employeeId>
          <ArtEmployeeSelect
            v-model="form.model.employeeId"
            v-model:selected-data="applicantSelection"
            :api-fn="fetchLeaveEmployeeOptions"
            :tenant-id="getUserInfo.tenantId"
            title="从员工花名册选择申请人"
            subtitle="申请人来自当前租户员工花名册，可按姓名、工号、组织或岗位检索"
            placeholder="点击选择申请人"
            @change="handleApplicantChange"
          />
        </template>

        <template #proxyEmployeeId>
          <ArtEmployeeSelect
            v-model="form.model.proxyEmployeeId"
            v-model:selected-data="proxySelection"
            :api-fn="fetchLeaveEmployeeOptions"
            :tenant-id="getUserInfo.tenantId"
            :disabled="!form.model.isProxy"
            title="从员工花名册选择代理人"
            subtitle="仅可选择当前租户在职或试用期员工，且不能与申请人相同"
            :placeholder="form.model.isProxy ? '点击选择代理人' : '请先选择需要代理'"
            @change="handleProxyChange"
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
  import dayjs from 'dayjs'
  import { computed, nextTick, reactive, ref, shallowRef } from 'vue'
  import { storeToRefs } from 'pinia'
  import type { FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchLeaveEmployeeDetail,
    fetchLeaveEmployeeOptions,
    fetchLeaveInformationDetail,
    saveLeaveInformation,
    type LeaveInformation,
    type LeaveInformationSavePayload
  } from '@smis/api'

  type Organization = Api.SystemManage.OrganizationListItem

  export interface LeaveInformationDialogOpenData {
    organizations: Organization[]
    row?: LeaveInformation
  }

  interface LeaveInformationForm {
    id?: string
    organizationId: string
    employeeId: string
    applicantIdCardNo: string
    startDate: string
    endDate: string
    leaveTypeCode: string
    isProxy: boolean
    proxyEmployeeId?: string
    reason: string
  }

  interface DialogFormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{
    success: [type: 'add' | 'edit', organizationId: string]
  }>()
  const userStore = useUserStore()
  const { getDictMap, getUserInfo } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<LeaveInformationDialogOpenData>>()
  const formRef = ref<DialogFormExpose>()
  const organizationTree = shallowRef<Organization[]>([])
  const applicantSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const proxySelection = shallowRef<EmployeeIntegrationItem[]>([])
  const organizationTreeProps = {
    children: 'children',
    label: 'organizationName',
    value: 'id'
  }

  const createInitialForm = (): LeaveInformationForm => ({
    id: undefined,
    organizationId: '',
    employeeId: '',
    applicantIdCardNo: '',
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
    leaveTypeCode: '',
    isProxy: false,
    proxyEmployeeId: undefined,
    reason: ''
  })

  const form = reactive<{
    model: LeaveInformationForm
    items: ComputedRef<FormItem[]>
    rules: ComputedRef<FormRules<LeaveInformationForm>>
  }>({
    model: createInitialForm(),
    items: computed(() => [
      { label: '申请人信息', key: 'applicantSection', type: 'divider', span: 24 },
      { label: '组织名称', key: 'organizationId', type: 'text' },
      { label: '申请人', key: 'employeeId', type: 'text' },
      {
        label: '申请人身份证号',
        key: 'applicantIdCardNo',
        type: 'input',
        span: 24,
        props: {
          disabled: true,
          placeholder: '选择申请人后从员工花名册自动带出'
        }
      },
      { label: '请假安排', key: 'leaveSection', type: 'divider', span: 24 },
      {
        label: '开始日期',
        key: 'startDate',
        type: 'date',
        props: {
          type: 'date',
          valueFormat: 'YYYY-MM-DD',
          format: 'YYYY-MM-DD',
          class: '!w-full',
          clearable: false
        }
      },
      {
        label: '结束日期',
        key: 'endDate',
        type: 'date',
        props: {
          type: 'date',
          valueFormat: 'YYYY-MM-DD',
          format: 'YYYY-MM-DD',
          class: '!w-full',
          disabledDate: disableEndDate
        }
      },
      {
        label: '请假类型',
        key: 'leaveTypeCode',
        type: 'select',
        options: leaveTypeOptions.value,
        props: { filterable: true, placeholder: '请选择请假类型' }
      },
      {
        label: '是否代理',
        key: 'isProxy',
        type: 'select',
        options: booleanOptions.value,
        props: { placeholder: '请选择', onChange: handleProxyFlagChange }
      },
      {
        label: '代理人',
        key: 'proxyEmployeeId',
        type: 'text',
        span: 24
      },
      {
        label: '请假事由',
        key: 'reason',
        type: 'input',
        span: 24,
        props: {
          type: 'textarea',
          rows: 4,
          maxlength: 500,
          showWordLimit: true,
          resize: 'none',
          placeholder: '请说明请假原因、工作交接或需要关注的事项'
        }
      }
    ]),
    rules: computed(() => ({
      organizationId: [{ required: true, message: '请选择组织名称', trigger: 'change' }],
      employeeId: [{ required: true, message: '请选择申请人', trigger: 'change' }],
      applicantIdCardNo: [
        { required: true, message: '申请人员工档案未维护身份证号', trigger: 'change' }
      ],
      startDate: [{ required: true, message: '请选择开始日期', trigger: 'change' }],
      endDate: [
        { required: true, message: '请选择结束日期', trigger: 'change' },
        { validator: validateDateRange, trigger: 'change' }
      ],
      leaveTypeCode: [{ required: true, message: '请选择请假类型', trigger: 'change' }],
      isProxy: [{ required: true, message: '请选择是否代理', trigger: 'change' }],
      proxyEmployeeId: [{ validator: validateProxyEmployee, trigger: 'change' }],
      reason: [
        { required: true, message: '请输入请假事由', trigger: 'blur' },
        { max: 500, message: '请假事由不能超过 500 个字符', trigger: 'blur' }
      ]
    }))
  })

  const leaveTypeOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.smisLeaveType ?? []).map(toDictionaryOption)
  )
  const booleanOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.commonBoolean ?? []).map((item) => ({
      label: item.label || item.name,
      value: String(item.value) === 'true'
    }))
  )

  function disableEndDate(date: Date): boolean {
    return Boolean(form.model.startDate) && dayjs(date).isBefore(dayjs(form.model.startDate), 'day')
  }
  function validateDateRange(
    _rule: unknown,
    _value: string,
    callback: (error?: Error) => void
  ): void {
    const start = dayjs(form.model.startDate)
    const end = dayjs(form.model.endDate)
    if (!start.isValid() || !end.isValid()) return callback()
    if (end.isBefore(start, 'day')) return callback(new Error('结束日期不能早于开始日期'))
    if (start.year() !== end.year()) return callback(new Error('跨年度请假请拆分为两条记录'))
    callback()
  }
  function validateProxyEmployee(
    _rule: unknown,
    value: string | undefined,
    callback: (error?: Error) => void
  ): void {
    if (!form.model.isProxy) return callback()
    if (!value) return callback(new Error('请选择代理人'))
    if (value === form.model.employeeId) return callback(new Error('代理人不能与申请人相同'))
    callback()
  }

  const setApplicant = async (employeeId: string, updateOrganization: boolean): Promise<void> => {
    const response = await fetchLeaveEmployeeDetail(employeeId)
    const employee = response.data
    if (!employee) return
    applicantSelection.value = [employee]
    form.model.applicantIdCardNo = employee.idCardNo?.trim() || ''
    if (updateOrganization && employee.organizationId) {
      form.model.organizationId = employee.organizationId
    }
  }
  const handleApplicantChange = async (
    value: string | string[] | undefined,
    rows: EmployeeIntegrationItem[]
  ): Promise<void> => {
    const employeeId = Array.isArray(value) ? value[0] : value
    applicantSelection.value = rows
    form.model.applicantIdCardNo = ''
    if (!employeeId) return
    await setApplicant(employeeId, true)
    if (form.model.proxyEmployeeId === employeeId) {
      form.model.proxyEmployeeId = undefined
      proxySelection.value = []
    }
  }
  const handleProxyChange = (
    _value: string | string[] | undefined,
    rows: EmployeeIntegrationItem[]
  ): void => {
    proxySelection.value = rows
  }
  const handleProxyFlagChange = (value: boolean): void => {
    if (value) return
    form.model.proxyEmployeeId = undefined
    proxySelection.value = []
  }

  const toEmployeeSelection = (
    employee: LeaveInformation['applicant']
  ): EmployeeIntegrationItem => ({
    id: employee.id,
    tenantId: employee.tenantId || getUserInfo.value.tenantId || '',
    organizationId: employee.organizationId,
    employeeNo: employee.employeeNo,
    employeeName: employee.employeeName,
    avatarUrl: employee.avatarUrl,
    jobTitle: employee.jobTitle,
    employmentStatus: employee.employmentStatus || 'active',
    organization:
      employee.organization?.id &&
      employee.organization.organizationCode &&
      employee.organization.organizationName
        ? {
            id: employee.organization.id,
            organizationCode: employee.organization.organizationCode,
            organizationName: employee.organization.organizationName
          }
        : null
  })

  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, createInitialForm())
    applicantSelection.value = []
    proxySelection.value = []
    await nextTick()
    formRef.value?.clearValidate()
  }
  const initializeNewRecord = async (): Promise<void> => {
    const employeeId = getUserInfo.value.hrEmployeeId
    if (!employeeId) return
    form.model.employeeId = employeeId
    await setApplicant(employeeId, true)
  }
  const initializeEditRecord = async (id: string): Promise<void> => {
    const response = await fetchLeaveInformationDetail(id)
    const record = response.data
    if (!record) return
    Object.assign(form.model, {
      ...createInitialForm(),
      id: record.id,
      organizationId: record.organizationId,
      employeeId: record.employeeId,
      applicantIdCardNo: record.applicantIdCardNo || '',
      startDate: record.startDate,
      endDate: record.endDate,
      leaveTypeCode: record.leaveTypeCode,
      isProxy: record.isProxy,
      proxyEmployeeId: record.proxyEmployeeId || undefined,
      reason: record.reason
    })
    applicantSelection.value = record.applicant ? [toEmployeeSelection(record.applicant)] : []
    proxySelection.value = record.proxyEmployee ? [toEmployeeSelection(record.proxyEmployee)] : []
  }
  const buildPayload = (): LeaveInformationSavePayload => ({
    id: form.model.id,
    organizationId: form.model.organizationId,
    employeeId: form.model.employeeId,
    leaveTypeCode: form.model.leaveTypeCode,
    startDate: form.model.startDate,
    endDate: form.model.endDate,
    reason: form.model.reason.trim(),
    isProxy: form.model.isProxy,
    proxyEmployeeId: form.model.isProxy ? form.model.proxyEmployeeId || null : null
  })
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const type = form.model.id ? 'edit' : 'add'
      await saveLeaveInformation(buildPayload())
      emit('success', type, form.model.organizationId)
      return true
    } catch (error) {
      notifyFriendlyError(error, '请假信息保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: LeaveInformationDialogOpenData): Promise<void> => {
    await resetForm()
    organizationTree.value = data.organizations
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑请假信息' : '新增请假信息',
      subtitle: '维护申请人、组织、请假安排与工作代理关系',
      confirmText: '保存',
      contentMaxHeight: 'calc(100vh - 176px)',
      loading: true,
      onOpen: async (_openData, api) => {
        try {
          await Promise.all([
            userStore.ensureDictLoaded('smisLeaveType'),
            userStore.ensureDictLoaded('commonBoolean'),
            data.row?.id ? initializeEditRecord(data.row.id) : initializeNewRecord()
          ])
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
  .leave-dialog {
    &__full-control {
      width: 100%;
    }
  }
</style>
