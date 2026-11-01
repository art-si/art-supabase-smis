<template>
  <ArtDialog
    ref="dialogRef"
    size="lg"
    @open="
      () => {
        activeFormTab = 'hierarchySection'
      }
    "
  >
    <div class="site-dialog">
      <ArtForm
        v-model:active-tab="activeFormTab"
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
            class="site-dialog__full-control"
            :data="organizationTree"
            :props="organizationTreeProps"
            node-key="id"
            value-key="id"
            check-strictly
            :multiple="!isEditing"
            :show-checkbox="!isEditing"
            collapse-tags
            collapse-tags-tooltip
            :max-collapse-tags="3"
            filterable
            clearable
            default-expand-all
            :placeholder="isEditing ? '请选择所属部门' : '请选择一个或多个所属部门'"
          />
        </template>

        <template #parentId>
          <ElTreeSelect
            v-model="form.model.parentId"
            class="site-dialog__full-control"
            :data="siteTree"
            :props="siteTreeProps"
            node-key="id"
            value-key="id"
            check-strictly
            filterable
            clearable
            default-expand-all
            placeholder="无上级场所（一级节点）"
          />
        </template>

        <template #responsibleEmployeeId>
          <ArtEmployeeSelect
            v-model="form.model.responsibleEmployeeId"
            v-model:selected-data="responsibleSelection"
            :api-fn="fetchSiteEmployeeOptions"
            :tenant-id="getUserInfo.tenantId"
            title="选择场所责任人"
            subtitle="数据来自当前租户员工花名册，可按姓名、工号、组织或职务检索"
            placeholder="点击从员工花名册选择"
          />
        </template>

        <template #addressPicker>
          <ArtAddressPicker
            v-model:address-detail="form.model.addressDetail"
            v-model:longitude="form.model.longitude"
            v-model:latitude="form.model.latitude"
            v-model:coordinate-system="form.model.coordinateSystem"
            hide-region-selector
            show-coordinate-hint
            :show-locate-button="true"
            detail-label="场所地址"
            detail-placeholder="输入地址后地图检索，或直接打开地图选点"
            label-width="86px"
          />
        </template>

        <template #imageUrls>
          <ArtUploadImage
            v-model="form.model.imageUrls"
            title="上传场所图片"
            multiple
            :limit="5"
            :size="112"
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
  import type { FormRules } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtAddressPicker from '@/components/core/forms/art-address-picker/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchSiteEmployeeOptions,
    saveSite,
    saveSites,
    type SmisSite,
    type SmisSiteSavePayload
  } from '@smis/api'

  type Organization = Api.SystemManage.OrganizationListItem

  export interface SiteDialogOpenData {
    organizations: Organization[]
    sites: SmisSite[]
    row?: SmisSite
    parent?: SmisSite
    initialOrganizationId?: string
  }

  interface SiteForm extends Omit<SmisSiteSavePayload, 'organizationId' | 'responsibleEmployeeId'> {
    organizationId: string | string[]
    responsibleEmployeeId?: string
    addressPicker?: undefined
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap, getUserInfo } = storeToRefs(userStore)
  const activeFormTab = ref('hierarchySection')
  const dialogRef = ref<ArtDialogExpose<SiteDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const isEditing = ref(false)
  const organizationTree = shallowRef<Organization[]>([])
  const siteTree = shallowRef<SmisSite[]>([])
  const responsibleSelection = shallowRef<EmployeeIntegrationItem[]>([])
  const organizationTreeProps = { children: 'children', label: 'organizationName', value: 'id' }
  const siteTreeProps = { children: 'children', label: 'siteName', value: 'id' }

  const initialForm = (): SiteForm => ({
    organizationId: isEditing.value ? '' : [],
    parentId: null,
    siteName: '',
    categoryCode: '',
    sort: 0,
    responsibleEmployeeId: undefined,
    addressDetail: '',
    longitude: null,
    latitude: null,
    coordinateSystem: 'gcj02',
    imageUrls: [],
    remark: ''
  })

  const categoryOptions = computed<FormItemOption[]>(() =>
    (getDictMap.value.smisSiteCategory ?? []).map(toDictionaryOption)
  )

  const form = reactive<{
    model: SiteForm
    items: ComputedRef<FormItem[]>
    rules: FormRules<SiteForm>
  }>({
    model: initialForm(),
    items: computed(() => [
      { label: '层级与归属', key: 'hierarchySection', type: 'tab', span: 24 },
      {
        label: isEditing.value ? '所属部门' : '所属部门（可多选）',
        key: 'organizationId',
        type: 'text'
      },
      { label: '上级场所', key: 'parentId', type: 'text' },
      {
        label: '场所名称',
        key: 'siteName',
        type: 'input',
        props: { maxlength: 120, placeholder: '请输入清晰、可识别的场所名称' }
      },
      {
        label: '属性类别',
        key: 'categoryCode',
        type: 'select',
        options: categoryOptions.value,
        props: { clearable: true, placeholder: '请选择属性类别' }
      },
      {
        label: '顺序号',
        key: 'sort',
        type: 'number',
        props: { min: 0, max: 999999, step: 1, controlsPosition: 'right', class: '!w-full' }
      },
      { label: '责任人', key: 'responsibleEmployeeId', type: 'text' },
      { label: '位置与图片', key: 'locationSection', type: 'tab', span: 24 },
      { label: '', key: 'addressPicker', type: 'input', span: 24, labelWidth: 0 },
      { label: '所属图片', key: 'imageUrls', type: 'text', span: 24 },
      {
        label: '备注',
        key: 'remark',
        type: 'input',
        span: 24,
        props: {
          type: 'textarea',
          rows: 3,
          maxlength: 500,
          showWordLimit: true,
          resize: 'none',
          placeholder: '可补充通行要求、区域边界或安全注意事项'
        }
      }
    ]),
    rules: {
      organizationId: [
        {
          validator: (_rule, value, callback) => {
            const organizationIds = Array.isArray(value) ? value : value ? [value] : []
            if (organizationIds.length === 0) {
              callback(new Error('请选择所属部门'))
              return
            }
            callback()
          },
          trigger: 'change'
        }
      ],
      siteName: [
        { required: true, message: '请输入场所名称', trigger: 'blur' },
        { max: 120, message: '场所名称不能超过 120 个字符', trigger: 'blur' }
      ],
      categoryCode: [{ required: true, message: '请选择属性类别', trigger: 'change' }],
      addressDetail: [{ max: 300, message: '场所地址不能超过 300 个字符', trigger: 'blur' }],
      remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }]
    }
  })

  const toEmployeeSelection = (row: SmisSite): EmployeeIntegrationItem[] => {
    if (!row.responsible) return []
    return [
      {
        id: row.responsible.id,
        tenantId: getUserInfo.value.tenantId || '',
        organizationId: row.organizationId,
        employeeNo: row.responsible.employeeNo,
        employeeName: row.responsible.employeeName,
        avatarUrl: null,
        jobTitle: row.responsible.jobTitle,
        employmentStatus: 'active',
        organization: {
          id: row.organization.id,
          organizationCode: row.organization.organizationCode,
          organizationName: row.organization.organizationName
        }
      }
    ]
  }

  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, initialForm())
    responsibleSelection.value = []
    await nextTick()
    formRef.value?.clearValidate()
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const { organizationId, ...rawModel } = toRaw(form.model)
      const sharedPayload = {
        ...rawModel,
        siteName: form.model.siteName.trim(),
        addressDetail: form.model.addressDetail?.trim(),
        remark: form.model.remark?.trim()
      }
      if (Array.isArray(organizationId)) {
        await saveSites({ ...sharedPayload, organizationIds: organizationId })
      } else {
        await saveSite({ ...sharedPayload, organizationId })
      }
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '场所档案保存失败，请检查内容后重试')
      return false
    }
  }

  const handleOpen = async (data: SiteDialogOpenData): Promise<void> => {
    isEditing.value = Boolean(data.row)
    await resetForm()
    organizationTree.value = data.organizations
    siteTree.value = data.sites
    if (data.row) {
      Object.assign(form.model, {
        id: data.row.id,
        organizationId: data.row.organizationId,
        parentId: data.row.parentId || null,
        siteName: data.row.siteName,
        categoryCode: data.row.categoryCode,
        sort: data.row.sort,
        responsibleEmployeeId: data.row.responsibleEmployeeId || undefined,
        addressDetail: data.row.addressDetail || '',
        longitude: data.row.longitude ?? null,
        latitude: data.row.latitude ?? null,
        coordinateSystem: data.row.coordinateSystem || 'gcj02',
        imageUrls: [...(data.row.imageUrls || [])],
        remark: data.row.remark || ''
      })
      responsibleSelection.value = toEmployeeSelection(data.row)
    } else if (data.parent) {
      form.model.parentId = data.parent.id || null
      form.model.organizationId = [data.parent.organizationId]
    } else if (data.initialOrganizationId) {
      form.model.organizationId = [data.initialOrganizationId]
    }

    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑场所' : data.parent ? '新增下级场所' : '新增场所',
      subtitle: data.row
        ? '维护组织归属、场所层级、责任人及地图位置'
        : '可选择多个所属部门，系统将为每个部门新增一条场所记录',
      confirmText: '保存',
      contentMaxHeight: 'calc(100vh - 176px)',
      onOpen: async (_openData, api) => {
        api.setLoading(true)
        try {
          await userStore.ensureDictLoaded('smisSiteCategory')
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .site-dialog {
    &__full-control {
      width: 100%;
    }
  }
</style>
