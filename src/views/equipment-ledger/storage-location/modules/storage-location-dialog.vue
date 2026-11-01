<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="storage-location-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:map-pin-2-line" /></template>
        <strong>统一设备物理位置口径</strong>
        <p>位置按租户构建树形层级，并关联归属部门与员工花名册负责人。</p>
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
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'

  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import type { FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import { fetchEnabledOrganizationTree } from '@/api/system-manage'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useTenantScopeFormPolicy } from '@/hooks/core/useTenantScopeFormPolicy'
  import { useUserStore } from '@/store/modules/user'
  import TreeUtils from '@/utils/tree'
  import {
    saveStorageLocation,
    type SmisStorageLocation,
    type SmisStorageLocationSavePayload,
    type SmisStorageLocationStatus
  } from '@smis/api'

  interface ParentTreeOption extends SmisStorageLocation {
    locationLabel: string
    disabled?: boolean
    children?: ParentTreeOption[]
  }

  export interface StorageLocationDialogOpenData {
    row?: SmisStorageLocation
    tenantId: string
    allTenants: boolean
    tree: SmisStorageLocation[]
    presetParentId?: string
  }

  interface StorageLocationForm {
    id?: string
    parentId?: string
    organizationId: string
    responsibleEmployeeId?: string
    locationCode: string
    locationName: string
    locationShortName: string
    detailLocation: string
    remark: string
    status: SmisStorageLocationStatus
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
    reloadOptions: (key: string) => Promise<void>
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap, getUserInfo } = storeToRefs(userStore)
  const { effectiveTenantId } = useTenantScopeFormPolicy()
  const dialogRef = ref<ArtDialogExpose<StorageLocationDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const targetTenantId = ref(getUserInfo.value.tenantId || '')
  const responsibleSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const source = reactive<{ tree: SmisStorageLocation[] }>({ tree: [] })

  const initialForm = (): StorageLocationForm => ({
    id: undefined,
    parentId: undefined,
    organizationId: '',
    responsibleEmployeeId: undefined,
    locationCode: '',
    locationName: '',
    locationShortName: '',
    detailLocation: '',
    remark: '',
    status: 'enabled'
  })
  const formModel = reactive<StorageLocationForm>(initialForm())

  const statusOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.commonEnabledStatus ?? []).map(toDictionaryOption)
  )

  const parentOptions = computed<ParentTreeOption[]>(() => {
    const blockedIds = formModel.id
      ? treeUtils
          .getDescendants(source.tree, formModel.id, true)
          .map((item) => item.id)
          .filter((id): id is string => Boolean(id))
      : []

    return treeUtils.mapTree(source.tree as ParentTreeOption[], (item) => ({
      ...item,
      locationLabel: `${item.locationName} · ${item.locationCode}${
        item.status === 'disabled' ? '（停用）' : ''
      }`,
      disabled: Boolean(item.id && blockedIds.includes(item.id))
    }))
  })

  const form = reactive<{
    model: StorageLocationForm
    items: ComputedRef<FormItem[]>
    rules: FormRules<StorageLocationForm>
  }>({
    model: formModel,
    items: computed(() => [
      { label: '层级与归属', key: 'hierarchySection', type: 'divider', span: 24 },
      {
        label: '设备位置编码',
        key: 'locationCode',
        type: 'input',
        props: { maxlength: 40, clearable: true, placeholder: '如 PLANT_A_FLOOR_01' }
      },
      {
        label: '位置名称',
        key: 'locationName',
        type: 'input',
        props: { maxlength: 100, clearable: true, placeholder: '如 A 厂房一层' }
      },
      {
        label: '位置简称',
        key: 'locationShortName',
        type: 'input',
        props: { maxlength: 50, clearable: true, placeholder: '用于紧凑列表和标签展示' }
      },
      {
        label: '上级位置',
        key: 'parentId',
        type: 'treeSelect',
        props: {
          data: parentOptions.value,
          clearable: true,
          checkStrictly: true,
          defaultExpandAll: true,
          renderAfterExpand: false,
          nodeKey: 'id',
          placeholder: '不选择表示一级位置',
          props: {
            label: 'locationLabel',
            value: 'id',
            children: 'children',
            disabled: 'disabled'
          }
        }
      },
      {
        label: '归属部门',
        key: 'organizationId',
        type: 'treeSelect',
        api: fetchEnabledOrganizationTree,
        immediate: false,
        beforeFetch: () => ({ tenantId: targetTenantId.value }),
        resultField: 'data',
        labelField: 'organizationName',
        valueField: 'id',
        labelFn: (item) => `${item.organizationName}（${item.organizationCode}）`,
        childrenField: 'children',
        props: {
          clearable: true,
          checkStrictly: true,
          defaultExpandAll: true,
          renderAfterExpand: false,
          placeholder: '请选择系统组织部门'
        }
      },
      {
        label: '位置负责人',
        key: 'responsibleEmployeeId',
        type: 'employeeSelect',
        get props(): FormItem['props'] {
          return {
            selectedData: responsibleSelection.value,
            'onUpdate:selectedData': ($event: typeof responsibleSelection.value) => {
              responsibleSelection.value = $event
            },
            tenantId: targetTenantId.value,
            title: '选择位置负责人',
            subtitle: '数据来自当前租户员工花名册，可按姓名、工号、组织或岗位检索',
            placeholder: '点击从员工花名册选择'
          }
        }
      },
      { label: '位置说明', key: 'detailSection', type: 'divider', span: 24 },
      {
        label: '详细位置',
        key: 'detailLocation',
        type: 'input',
        span: 24,
        props: {
          maxlength: 300,
          clearable: true,
          placeholder: '如 A 厂房一层东侧动力站 01 区'
        }
      },
      {
        label: '启用状态',
        key: 'status',
        type: 'select',
        options: statusOptions.value,
        props: { clearable: false, placeholder: '请选择启用状态' }
      },
      {
        label: '备注',
        key: 'remark',
        type: 'input',
        span: 24,
        props: {
          type: 'textarea',
          rows: 4,
          maxlength: 500,
          showWordLimit: true,
          resize: 'none',
          placeholder: '可补充区域边界、通行要求或安全注意事项'
        }
      }
    ]),
    rules: {
      locationCode: [
        { required: true, message: '请输入设备位置编码', trigger: 'blur' },
        {
          pattern: /^[A-Za-z][A-Za-z0-9_-]*$/,
          message: '编码须以字母开头，仅支持字母、数字、下划线和短横线',
          trigger: 'blur'
        },
        { max: 40, message: '设备位置编码不能超过 40 个字符', trigger: 'blur' }
      ],
      locationName: [
        { required: true, message: '请输入位置名称', trigger: 'blur' },
        { max: 100, message: '位置名称不能超过 100 个字符', trigger: 'blur' }
      ],
      locationShortName: [{ max: 50, message: '位置简称不能超过 50 个字符', trigger: 'blur' }],
      organizationId: [{ required: true, message: '请选择归属部门', trigger: 'change' }],
      detailLocation: [{ max: 300, message: '详细位置不能超过 300 个字符', trigger: 'blur' }],
      status: [{ required: true, message: '请选择启用状态', trigger: 'change' }],
      remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }]
    }
  })

  const toEmployeeSelection = (row: SmisStorageLocation): EmployeeIntegrationItem[] => {
    if (!row.responsible) return []
    return [
      {
        id: row.responsible.id,
        tenantId: targetTenantId.value,
        organizationId: row.responsible.organizationId,
        employeeNo: row.responsible.employeeNo,
        employeeName: row.responsible.employeeName,
        jobTitle: row.responsible.jobTitle,
        employmentStatus: row.responsible.employmentStatus,
        organization:
          row.responsible.organizationId && row.responsible.organizationName
            ? {
                id: row.responsible.organizationId,
                organizationCode: row.responsible.organizationCode || '',
                organizationName: row.responsible.organizationName
              }
            : null
      }
    ]
  }

  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, initialForm())
    targetTenantId.value = effectiveTenantId.value || getUserInfo.value.tenantId || ''
    source.tree = []
    responsibleSelection.value = []
    await nextTick()
    formRef.value?.clearValidate()
  }

  const buildPayload = (): SmisStorageLocationSavePayload => ({
    id: form.model.id,
    parentId: form.model.parentId || null,
    organizationId: form.model.organizationId,
    responsibleEmployeeId: form.model.responsibleEmployeeId || null,
    locationCode: form.model.locationCode.trim().toUpperCase(),
    locationName: form.model.locationName.trim(),
    locationShortName: form.model.locationShortName.trim(),
    detailLocation: form.model.detailLocation.trim(),
    remark: form.model.remark.trim(),
    status: form.model.status
  })

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await saveStorageLocation(buildPayload())
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '设备存放位置保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: StorageLocationDialogOpenData): Promise<void> => {
    await resetForm()
    targetTenantId.value =
      data.row?.tenantId ||
      data.tenantId ||
      effectiveTenantId.value ||
      getUserInfo.value.tenantId ||
      ''
    source.tree = data.allTenants
      ? data.tree.filter((location) => location.tenantId === targetTenantId.value)
      : data.tree
    if (data.row) {
      Object.assign(form.model, {
        id: data.row.id,
        parentId: data.row.parentId || undefined,
        organizationId: data.row.organizationId,
        responsibleEmployeeId: data.row.responsibleEmployeeId || undefined,
        locationCode: data.row.locationCode,
        locationName: data.row.locationName,
        locationShortName: data.row.locationShortName || '',
        detailLocation: data.row.detailLocation || '',
        remark: data.row.remark || '',
        status: data.row.status
      })
      responsibleSelection.value = toEmployeeSelection(data.row)
    } else if (data.presetParentId) {
      const parent = treeUtils.findNode(source.tree, data.presetParentId)
      form.model.parentId = data.presetParentId
      if (parent?.organizationId) form.model.organizationId = parent.organizationId
    }

    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑存放位置' : data.presetParentId ? '新增下级位置' : '新增存放位置',
      subtitle: '维护物理位置层级、组织归属与花名册责任人',
      confirmText: '保存存放位置',
      contentMaxHeight: 'calc(100vh - 176px)',
      loading: true,
      onOpen: async (_openData, api) => {
        try {
          await Promise.all([
            userStore.ensureDictLoaded('commonEnabledStatus'),
            formRef.value?.reloadOptions('organizationId')
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
