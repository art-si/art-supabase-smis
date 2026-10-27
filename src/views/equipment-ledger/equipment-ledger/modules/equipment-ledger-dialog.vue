<template>
  <ArtDialog ref="dialogRef" size="xl" @closed="emit('closed')">
    <div class="equipment-ledger-dialog">
      <ElAlert v-if="loadError" type="error" :closable="false" show-icon>
        <template #title>设备资料加载失败</template>
        <p>{{ loadError }}</p>
        <ElButton link type="primary" @click="loadInitialData">重新加载</ElButton>
      </ElAlert>
      <div class="equipment-ledger-dialog__context">
        <span><ArtSvgIcon icon="ri:qr-code-line" /></span>
        <div
          ><strong>一物一码，贯穿设备全生命周期</strong
          ><p>主档、锅炉扩展、安全附件和责任组织统一按当前租户维护。</p></div
        >
      </div>
      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="8"
        :gutter="22"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      >
        <template #responsibleEmployeeId>
          <ArtEmployeeSelect
            v-model="form.model.responsibleEmployeeId"
            :tenant-id="getUserInfo.tenantId"
            title="选择设备责任人"
            subtitle="数据来自当前租户员工花名册"
            placeholder="从员工花名册选择"
          />
        </template>
        <template #supplierId>
          <ArtTableSingleSelect
            v-model="form.model.supplierId"
            :selected-data="supplierSelection"
            :api-fn="fetchSupplierOptions"
            :columns="supplierColumns"
            title="选择供应商"
            subtitle="数据来自租户级供应商主数据"
            label-key="supplierName"
            description-key="supplierCode"
            placeholder="选择设备供应商"
            empty-text="暂无可选供应商"
            empty-description="请先维护当前租户的供应商主数据。"
            show-pagination
          >
            <template #empty>
              <SmisDataSourceEmptyActions source="supplier" />
            </template>
          </ArtTableSingleSelect>
        </template>
        <template #pressureGaugeIds>
          <ArtTableMultipleSelect
            ref="pressureGaugeSelectRef"
            v-model="form.model.pressureGaugeIds"
            :selected-data="pressureGaugeSelection"
            :api-fn="(params) => fetchAccessoryOptions('pressure_gauge', params)"
            :columns="accessoryColumns"
            title="选择压力表"
            subtitle="仅展示当前租户档案模板为压力表的设备"
            label-key="equipmentName"
            description-key="equipmentCode"
            placeholder="选择一台或多台压力表"
            empty-text="暂无可选压力表"
            empty-description="请先新增设备，并将设备分类选择为压力表对应分类。"
          >
            <template #empty>
              <div class="equipment-ledger-dialog__accessory-empty">
                <ElButton
                  v-if="canAddEquipment"
                  type="primary"
                  @click="handleCreateAccessory('pressure_gauge')"
                >
                  <ArtSvgIcon icon="ri:add-line" />
                  新增压力表设备
                </ElButton>
                <p v-else>当前账号暂无新增设备权限，请联系管理员维护压力表设备。</p>
              </div>
            </template>
          </ArtTableMultipleSelect>
        </template>
        <template #safetyValveIds>
          <ArtTableMultipleSelect
            ref="safetyValveSelectRef"
            v-model="form.model.safetyValveIds"
            :selected-data="safetyValveSelection"
            :api-fn="(params) => fetchAccessoryOptions('safety_valve', params)"
            :columns="accessoryColumns"
            title="选择安全阀"
            subtitle="仅展示当前租户档案模板为安全阀的设备"
            label-key="equipmentName"
            description-key="equipmentCode"
            placeholder="选择一台或多台安全阀"
            empty-text="暂无可选安全阀"
            empty-description="请先新增设备，并将设备分类选择为安全阀对应分类。"
          >
            <template #empty>
              <div class="equipment-ledger-dialog__accessory-empty">
                <ElButton
                  v-if="canAddEquipment"
                  type="primary"
                  @click="handleCreateAccessory('safety_valve')"
                >
                  <ArtSvgIcon icon="ri:add-line" />
                  新增安全阀设备
                </ElButton>
                <p v-else>当前账号暂无新增设备权限，请联系管理员维护安全阀设备。</p>
              </div>
            </template>
          </ArtTableMultipleSelect>
        </template>
        <template #maintenanceQualificationUrl>
          <ArtUploadFile
            v-model="form.model.maintenanceQualificationUrl"
            accept=".pdf,.doc,.docx,image/*"
            title="上传维保单位资质证书"
            tip="支持 PDF、Word 或图片，单个文件不超过 20 MB"
          />
        </template>
        <template #useRegistrationCertificateUrl>
          <ArtUploadFile
            v-model="form.model.useRegistrationCertificateUrl"
            accept=".pdf,image/*"
            title="上传使用登记证"
            tip="支持 PDF 或图片，单个文件不超过 20 MB"
          />
        </template>
        <template #nameplateUrl>
          <ArtUploadImage
            v-model="form.model.nameplateUrl"
            title="上传设备铭牌"
            :size="112"
            :limit="1"
          />
        </template>
        <template #photoUrl>
          <ArtUploadImage
            v-model="form.model.photoUrl"
            title="上传设备照片"
            :size="112"
            :limit="1"
          />
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { toDictionaryOption } from '@/utils/form/option'

  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { ElButton, type FormRules } from 'element-plus'
  import { uniq, uniqBy } from 'lodash-es'
  import { mapWithConcurrency } from '@/utils/async'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase/error'
  import type {
    ArtDataSelectExpose,
    DataSelectColumn,
    DataSelectFetchParams,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import { fetchEnabledOrganizationTree } from '@/api/system-manage'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import ArtTableMultipleSelect from '@/components/core/forms/art-data-select/table-multiple.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import SmisDataSourceEmptyActions from '@smis/views/components/smis-data-source-empty-actions.vue'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import { useAuth } from '@/hooks/core/useAuth'
  import { useUserStore } from '@/store/modules/user'
  import { resolveSupplierDictionaryLabel } from '@smis/domain/supplier-dictionary'
  import { getEquipmentProfileDefinition } from '@smis/domain/equipment-profile'
  import {
    fetchEquipmentLedgerDetail,
    fetchEquipmentLedgerList,
    fetchSupplierList,
    saveEquipmentLedger,
    type SmisEquipment,
    type SmisEquipmentAssetStatus,
    type SmisEquipmentBoiler,
    type SmisEquipmentCategory,
    type SmisEquipmentImportanceLevel,
    type SmisEquipmentKind,
    type SmisEquipmentOperationStatus,
    type SmisEquipmentSavePayload,
    type SmisEquipmentStatus,
    type SmisEquipmentUseStatus,
    type SmisStorageLocation
  } from '@smis/api'

  export interface EquipmentLedgerDialogOpenData {
    row?: SmisEquipment
    loadDetail?: () => Promise<SmisEquipment | undefined>
    categoryTree: SmisEquipmentCategory[]
    locationTree: SmisStorageLocation[]
    presetCategoryId?: string
    presetLocationId?: string
    presetKind?: SmisEquipmentKind
  }
  export type EquipmentAccessoryKind = 'pressure_gauge' | 'safety_valve'
  interface EquipmentForm {
    id?: string
    sort: number
    categoryId: string
    locationId?: string
    usingOrganizationId: string
    managingOrganizationId: string
    responsibleEmployeeId?: string
    supplierId?: string
    equipmentCode: string
    equipmentName: string
    equipmentShortName: string
    equipmentKind: SmisEquipmentKind
    specification: string
    model: string
    manufacturer: string
    factoryNo: string
    registrationCode: string
    internalNo: string
    useCertificateNo: string
    detailLocation: string
    maintenanceOrganization: string
    installationOrganization: string
    designOrganization: string
    maintenanceQualificationUrl: string
    useRegistrationCertificateUrl: string
    nameplateUrl: string
    photoUrl: string
    specialParameters: Record<string, string | number | boolean | null>
    manufactureDate: string
    installationDate: string
    commissioningDate: string
    enableDate: string
    useStatus: SmisEquipmentUseStatus
    operationStatus: SmisEquipmentOperationStatus
    assetStatus: SmisEquipmentAssetStatus
    importanceLevel: SmisEquipmentImportanceLevel
    assetOriginalValue?: number
    serviceLifeYears?: number
    netValue?: number
    fixedAssetNo: string
    erpCode: string
    electronicTagCode: string
    isMajorHazardSource: boolean
    isSpecialEquipment: boolean
    remark: string
    status: SmisEquipmentStatus
    boiler: SmisEquipmentBoiler
    pressureGaugeIds: string[]
    safetyValveIds: string[]
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
    reloadOptions: (key: string) => Promise<void>
  }

  const emit = defineEmits<{
    success: [type: 'add' | 'edit']
    closed: []
    createAccessory: [kind: EquipmentAccessoryKind]
  }>()
  const { hasAuth } = useAuth()
  const userStore = useUserStore()
  const { getDictMap, getUserInfo } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<EquipmentLedgerDialogOpenData>>()
  const loadError = ref<string | null>(null)
  const currentOpenData = shallowRef<EquipmentLedgerDialogOpenData>()
  const formRef = ref<FormExpose>()
  const pressureGaugeSelectRef = ref<ArtDataSelectExpose>()
  const safetyValveSelectRef = ref<ArtDataSelectExpose>()
  const source = reactive<{
    categoryTree: SmisEquipmentCategory[]
    locationTree: SmisStorageLocation[]
  }>({ categoryTree: [], locationTree: [] })
  const supplierSelection = shallowRef<DataSelectRecord[]>([])
  const pressureGaugeSelection = shallowRef<DataSelectRecord[]>([])
  const safetyValveSelection = shallowRef<DataSelectRecord[]>([])
  const numberRule = useDocumentNumberRule('smis.equipment')
  const canAddEquipment = computed(() => hasAuth('SmisEquipmentLedger:Add'))

  const initialForm = (): EquipmentForm => ({
    sort: 10,
    categoryId: '',
    locationId: undefined,
    usingOrganizationId: '',
    managingOrganizationId: '',
    responsibleEmployeeId: undefined,
    supplierId: undefined,
    equipmentCode: '',
    equipmentName: '',
    equipmentShortName: '',
    equipmentKind: 'general',
    specification: '',
    model: '',
    manufacturer: '',
    factoryNo: '',
    registrationCode: '',
    internalNo: '',
    useCertificateNo: '',
    detailLocation: '',
    maintenanceOrganization: '',
    installationOrganization: '',
    designOrganization: '',
    maintenanceQualificationUrl: '',
    useRegistrationCertificateUrl: '',
    nameplateUrl: '',
    photoUrl: '',
    specialParameters: {},
    manufactureDate: '',
    installationDate: '',
    commissioningDate: '',
    enableDate: '',
    useStatus: 'in_use',
    operationStatus: 'normal',
    assetStatus: 'active',
    importanceLevel: 'general',
    assetOriginalValue: undefined,
    serviceLifeYears: undefined,
    netValue: undefined,
    fixedAssetNo: '',
    erpCode: '',
    electronicTagCode: '',
    isMajorHazardSource: false,
    isSpecialEquipment: false,
    remark: '',
    status: 'enabled',
    boiler: {
      boilerType: 'water',
      registrationCode: '',
      useCertificateNo: '',
      internalNo: '',
      ratedEvaporation: null,
      designPressure: null,
      workingPressure: null,
      workingTemperature: null,
      fuelType: '',
      purpose: '',
      maintenanceOrganization: '',
      installationOrganization: ''
    },
    pressureGaugeIds: [],
    safetyValveIds: []
  })
  const formModel = reactive<EquipmentForm>(initialForm())
  const dictOptions = (code: string): FormItemOption[] =>
    (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const mapCategory = (items: SmisEquipmentCategory[]): FormItemOption[] =>
    items.map((item) => ({
      label: `${item.categoryName} · ${item.categoryCode}`,
      value: item.id,
      disabled: item.status === 'disabled',
      children: item.children ? mapCategory(item.children) : undefined
    }))
  const mapLocation = (items: SmisStorageLocation[]): FormItemOption[] =>
    items.map((item) => ({
      label: `${item.locationName} · ${item.locationCode}`,
      value: item.id,
      disabled: item.status === 'disabled',
      children: item.children ? mapLocation(item.children) : undefined
    }))
  const categoryOptions = computed(() => mapCategory(source.categoryTree))
  const locationOptions = computed(() => mapLocation(source.locationTree))
  const findCategory = (
    items: SmisEquipmentCategory[],
    categoryId: string
  ): SmisEquipmentCategory | undefined => {
    for (const item of items) {
      if (item.id === categoryId) return item
      const child = item.children ? findCategory(item.children, categoryId) : undefined
      if (child) return child
    }
    return undefined
  }
  const selectedCategory = computed(() => findCategory(source.categoryTree, formModel.categoryId))
  const profileType = computed(() => selectedCategory.value?.profileType || 'general')
  const profileDefinition = computed(() => getEquipmentProfileDefinition(profileType.value))
  const equipmentCodeProps = computed<Record<string, unknown>>(() =>
    numberRule.inputProps(Boolean(formModel.id), '请输入设备编码', true)
  )
  watch(
    profileType,
    (nextProfile, previousProfile) => {
      formModel.equipmentKind =
        nextProfile === 'boiler' ||
        nextProfile === 'pressure_gauge' ||
        nextProfile === 'safety_valve'
          ? nextProfile
          : 'general'
      formModel.isSpecialEquipment = nextProfile !== 'general'
      if (previousProfile && previousProfile !== nextProfile) formModel.specialParameters = {}
    },
    { flush: 'sync' }
  )

  const commonInput = (placeholder: string, maxlength = 120) => ({
    clearable: true,
    maxlength,
    placeholder
  })
  const profileFormItems = computed<FormItem[]>(() =>
    profileDefinition.value.fields.map((field) => ({
      label: field.unit ? `${field.label}（${field.unit}）` : field.label,
      key: `specialParameters.${field.key}`,
      type: field.type,
      options: field.dictCode ? dictOptions(field.dictCode) : field.options,
      props:
        field.type === 'number'
          ? {
              min: 0,
              precision: field.precision ?? 2,
              controlsPosition: 'right',
              class: '!w-full'
            }
          : field.type === 'date'
            ? { valueFormat: 'YYYY-MM-DD', clearable: true, class: '!w-full' }
            : {
                clearable: true,
                placeholder: field.placeholder || `请输入${field.label}`,
                maxlength: 160
              }
    }))
  )
  const form = reactive<{
    model: EquipmentForm
    items: ComputedRef<FormItem[]>
    rules: FormRules<EquipmentForm>
  }>({
    model: formModel,
    items: computed(() => [
      { label: '基本信息', key: 'basicSection', type: 'divider', span: 24 },
      {
        label: '设备编码',
        key: 'equipmentCode',
        type: 'input',
        description: numberRule.description.value,
        props: equipmentCodeProps.value
      },
      {
        label: '设备名称',
        key: 'equipmentName',
        type: 'input',
        props: commonInput('请输入设备名称')
      },
      {
        label: '设备简称',
        key: 'equipmentShortName',
        type: 'input',
        props: commonInput('用于列表紧凑展示', 60)
      },
      {
        label: '排序',
        key: 'sort',
        type: 'number',
        props: {
          min: 0,
          max: 999999,
          step: 10,
          stepStrictly: true,
          controlsPosition: 'right',
          class: '!w-full'
        }
      },
      {
        label: '设备分类',
        key: 'categoryId',
        type: 'treeSelect',
        options: categoryOptions.value,
        props: {
          clearable: true,
          checkStrictly: true,
          defaultExpandAll: true,
          renderAfterExpand: false,
          placeholder: '选择设备分类'
        }
      },
      {
        label: '安装位置',
        key: 'locationId',
        type: 'treeSelect',
        options: locationOptions.value,
        props: {
          clearable: true,
          checkStrictly: true,
          defaultExpandAll: true,
          renderAfterExpand: false,
          placeholder: '从存放位置中选择安装位置'
        }
      },
      { label: '规格', key: 'specification', type: 'input', props: commonInput('请输入规格') },
      { label: '型号', key: 'model', type: 'input', props: commonInput('请输入设备型号') },
      { label: '制造商', key: 'manufacturer', type: 'input', props: commonInput('请输入制造商') },
      { label: '出厂编号', key: 'factoryNo', type: 'input', props: commonInput('请输入出厂编号') },
      {
        label: '注册代码',
        key: 'registrationCode',
        type: 'input',
        props: commonInput('请输入注册代码')
      },
      { label: '内部编号', key: 'internalNo', type: 'input', props: commonInput('请输入内部编号') },
      {
        label: '使用证号',
        key: 'useCertificateNo',
        type: 'input',
        props: commonInput('请输入使用证号')
      },
      {
        label: '详细地点',
        key: 'detailLocation',
        type: 'input',
        props: commonInput('补充楼层、区域或具体点位', 200)
      },
      { label: '组织与责任', key: 'ownerSection', type: 'divider', span: 24 },
      {
        label: '使用部门',
        key: 'usingOrganizationId',
        type: 'treeSelect',
        api: fetchEnabledOrganizationTree,
        immediate: false,
        beforeFetch: () => ({ tenantId: getUserInfo.value.tenantId }),
        resultField: 'data',
        labelField: 'organizationName',
        valueField: 'id',
        labelFn: (item) => `${item.organizationName}（${item.organizationCode}）`,
        childrenField: 'children',
        props: {
          clearable: true,
          checkStrictly: true,
          defaultExpandAll: true,
          renderAfterExpand: false
        }
      },
      {
        label: '管理部门',
        key: 'managingOrganizationId',
        type: 'treeSelect',
        api: fetchEnabledOrganizationTree,
        immediate: false,
        beforeFetch: () => ({ tenantId: getUserInfo.value.tenantId }),
        resultField: 'data',
        labelField: 'organizationName',
        valueField: 'id',
        labelFn: (item) => `${item.organizationName}（${item.organizationCode}）`,
        childrenField: 'children',
        props: {
          clearable: true,
          checkStrictly: true,
          defaultExpandAll: true,
          renderAfterExpand: false
        }
      },
      { label: '设备责任人', key: 'responsibleEmployeeId', type: 'text' },
      { label: '供应商', key: 'supplierId', type: 'text' },
      {
        label: '维保单位',
        key: 'maintenanceOrganization',
        type: 'input',
        props: commonInput('请输入维保单位')
      },
      {
        label: '安装单位',
        key: 'installationOrganization',
        type: 'input',
        props: commonInput('请输入安装单位')
      },
      {
        label: '设计单位',
        key: 'designOrganization',
        type: 'input',
        props: commonInput('请输入设计单位')
      },
      { label: '状态与资产', key: 'statusSection', type: 'divider', span: 24 },
      {
        label: '使用状态',
        key: 'useStatus',
        type: 'select',
        options: dictOptions('smisEquipmentUseStatus')
      },
      {
        label: '运行状态',
        key: 'operationStatus',
        type: 'select',
        options: dictOptions('smisEquipmentOperationStatus')
      },
      {
        label: '资产状态',
        key: 'assetStatus',
        type: 'select',
        options: dictOptions('smisEquipmentAssetStatus')
      },
      {
        label: '重要级别',
        key: 'importanceLevel',
        type: 'select',
        options: dictOptions('smisEquipmentImportanceLevel')
      },
      {
        label: '启用状态',
        key: 'status',
        type: 'select',
        options: dictOptions('commonEnabledStatus')
      },
      {
        label: '启用日期',
        key: 'enableDate',
        type: 'date',
        props: { valueFormat: 'YYYY-MM-DD', clearable: true }
      },
      {
        label: '制造日期',
        key: 'manufactureDate',
        type: 'date',
        props: { valueFormat: 'YYYY-MM-DD', clearable: true }
      },
      {
        label: '安装日期',
        key: 'installationDate',
        type: 'date',
        props: { valueFormat: 'YYYY-MM-DD', clearable: true }
      },
      {
        label: '投运日期',
        key: 'commissioningDate',
        type: 'date',
        props: { valueFormat: 'YYYY-MM-DD', clearable: true }
      },
      {
        label: '资产原值（元）',
        key: 'assetOriginalValue',
        type: 'number',
        props: { min: 0, precision: 2, controlsPosition: 'right' }
      },
      {
        label: '预计寿命（年）',
        key: 'serviceLifeYears',
        type: 'number',
        props: { min: 0.01, precision: 2, controlsPosition: 'right' }
      },
      {
        label: '当前净值（元）',
        key: 'netValue',
        type: 'number',
        props: { min: 0, precision: 2, controlsPosition: 'right' }
      },
      {
        label: '固定资产编号',
        key: 'fixedAssetNo',
        type: 'input',
        props: commonInput('请输入固定资产编号')
      },
      { label: 'ERP 编码', key: 'erpCode', type: 'input', props: commonInput('请输入 ERP 编码') },
      {
        label: '电子标签编码',
        key: 'electronicTagCode',
        type: 'input',
        props: commonInput('请输入电子标签编码')
      },
      {
        label: '重大危险源',
        key: 'isMajorHazardSource',
        type: 'switch',
        description: '开启后可配置到期提醒责任人和推送渠道'
      },
      {
        label: '特种设备',
        key: 'isSpecialEquipment',
        type: 'switch',
        description: '纳入特种设备检验与到期提醒范围'
      },
      { label: '档案资料', key: 'documentSection', type: 'divider', span: 24 },
      { label: '维保单位资质证书', key: 'maintenanceQualificationUrl', type: 'text', span: 12 },
      { label: '使用登记证', key: 'useRegistrationCertificateUrl', type: 'text', span: 12 },
      { label: '设备铭牌', key: 'nameplateUrl', type: 'text', span: 12 },
      { label: '设备照片', key: 'photoUrl', type: 'text', span: 12 },
      ...(profileDefinition.value.fields.length
        ? [
            {
              label: `${profileDefinition.value.label}专用信息`,
              key: 'specialProfileSection',
              type: 'divider' as const,
              span: 24,
              description: profileDefinition.value.description
            },
            ...profileFormItems.value
          ]
        : []),
      {
        label: '压力表',
        key: 'pressureGaugeIds',
        type: 'text',
        span: 12
      },
      {
        label: '安全阀',
        key: 'safetyValveIds',
        type: 'text',
        span: 12
      },
      {
        label: '备注',
        key: 'remark',
        type: 'input',
        span: 24,
        props: {
          type: 'textarea',
          rows: 4,
          maxlength: 1000,
          showWordLimit: true,
          resize: 'none',
          placeholder: '补充设备技术参数、运行边界或管理要求'
        }
      }
    ]),
    rules: {
      equipmentCode: [
        {
          validator: (_rule, value, callback) => {
            if (numberRule.manualRequired(Boolean(formModel.id)) && !String(value || '').trim())
              callback(new Error('请输入设备编码'))
            else callback()
          },
          trigger: 'blur'
        }
      ],
      equipmentName: [
        { required: true, message: '请输入设备名称', trigger: 'blur' },
        { max: 120, message: '设备名称不能超过 120 个字符', trigger: 'blur' }
      ],
      sort: [{ required: true, message: '请输入排序', trigger: 'change' }],
      categoryId: [{ required: true, message: '请选择设备分类', trigger: 'change' }],
      usingOrganizationId: [{ required: true, message: '请选择使用部门', trigger: 'change' }],
      managingOrganizationId: [{ required: true, message: '请选择管理部门', trigger: 'change' }]
    }
  })

  const supplierColumns: DataSelectColumn[] = [
    { prop: 'supplierCode', label: '供应商编码', minWidth: 150 },
    { prop: 'supplierName', label: '供应商名称', minWidth: 220 },
    {
      prop: 'supplierCategory',
      label: '分类',
      width: 132,
      formatter: (row) =>
        resolveSupplierDictionaryLabel(
          'supplierCategory',
          String(row.supplierCategory || ''),
          getDictMap.value.supplierCategory
        ),
      tagType: 'primary'
    }
  ]
  const accessoryColumns: DataSelectColumn[] = [
    { prop: 'equipmentCode', label: '设备编码', minWidth: 150 },
    { prop: 'equipmentName', label: '设备名称', minWidth: 200 },
    { prop: 'model', label: '型号', minWidth: 130 },
    { prop: 'locationName', label: '安装位置', minWidth: 150 }
  ]
  const fetchSupplierOptions = async (params: DataSelectFetchParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.page, size: params.pageSize })
    const result = await fetchSupplierList({
      keyword: params.keyword,
      from,
      to
    })
    return { data: result.data as DataSelectRecord[], total: result.total }
  }
  const findAccessoryCategories = (
    items: SmisEquipmentCategory[],
    kind: EquipmentAccessoryKind
  ): SmisEquipmentCategory[] =>
    items.flatMap((item) => [
      ...(item.profileType === kind ? [item] : []),
      ...findAccessoryCategories(item.children || [], kind)
    ])
  const fetchAccessoryRows = async (
    kind: EquipmentAccessoryKind,
    keyword = ''
  ): Promise<DataSelectRecord[]> => {
    const categories = findAccessoryCategories(source.categoryTree, kind)
    const results = await Promise.all(
      categories.map((category) =>
        fetchEquipmentLedgerList({ categoryId: category.id, keyword, from: 0, to: 9999 })
      )
    )
    return uniqBy(
      results.flatMap((result) => result.data),
      (row) => row.id
    )
      .sort(
        (left, right) =>
          left.sort - right.sort || left.equipmentName.localeCompare(right.equipmentName, 'zh-CN')
      )
      .map((row) => ({
        ...row,
        locationName: row.location?.locationName || '未设置位置'
      })) as DataSelectRecord[]
  }
  const fetchAccessoryOptions = async (
    kind: EquipmentAccessoryKind,
    params: DataSelectFetchParams
  ) => {
    const rows = await fetchAccessoryRows(kind, params.keyword)
    const from = (params.page - 1) * params.pageSize
    return {
      data: rows.slice(from, from + params.pageSize),
      total: rows.length
    }
  }
  const selectedRows = async (
    ids: string[],
    kind: EquipmentAccessoryKind
  ): Promise<DataSelectRecord[]> => {
    return mapWithConcurrency(uniq(ids), 3, async (id) => {
      const result = await fetchEquipmentLedgerDetail(id)
      if (result.error) {
        throw new Error('关联设备加载失败，请重新加载设备资料', { cause: result.error })
      }
      const row = result.data
      if (!row || row.id !== id) {
        throw new Error('关联设备已不存在或当前账号无权查看，请核对设备关联后重试')
      }
      if (row.profileType !== kind) {
        throw new Error('关联设备的档案模板已变更，请核对压力表或安全阀分类后重试')
      }
      return { ...row, locationName: row.location?.locationName || '未设置位置' }
    })
  }
  const handleCreateAccessory = (kind: EquipmentAccessoryKind): void => {
    if (kind === 'pressure_gauge') pressureGaugeSelectRef.value?.close()
    else safetyValveSelectRef.value?.close()
    emit('createAccessory', kind)
  }
  const openAccessorySelector = async (kind: EquipmentAccessoryKind): Promise<void> => {
    await nextTick()
    if (kind === 'pressure_gauge') await pressureGaugeSelectRef.value?.open()
    else await safetyValveSelectRef.value?.open()
  }
  const numericParameter = (value: string | number | boolean | null | undefined) =>
    typeof value === 'boolean' ? null : (value ?? null)
  const buildPayload = (): SmisEquipmentSavePayload => {
    const specialParameters = { ...toRaw(form.model.specialParameters) }
    const isBoiler = profileType.value === 'boiler'
    return {
      ...toRaw(form.model),
      locationId: form.model.locationId || null,
      responsibleEmployeeId: form.model.responsibleEmployeeId || null,
      supplierId: form.model.supplierId || null,
      equipmentCode: form.model.equipmentCode.trim(),
      equipmentName: form.model.equipmentName.trim(),
      equipmentShortName: form.model.equipmentShortName.trim(),
      specification: form.model.specification.trim(),
      model: form.model.model.trim(),
      manufacturer: form.model.manufacturer.trim(),
      factoryNo: form.model.factoryNo.trim(),
      registrationCode: form.model.registrationCode.trim(),
      internalNo: form.model.internalNo.trim(),
      useCertificateNo: form.model.useCertificateNo.trim(),
      detailLocation: form.model.detailLocation.trim(),
      maintenanceOrganization: form.model.maintenanceOrganization.trim(),
      installationOrganization: form.model.installationOrganization.trim(),
      designOrganization: form.model.designOrganization.trim(),
      fixedAssetNo: form.model.fixedAssetNo.trim(),
      erpCode: form.model.erpCode.trim(),
      electronicTagCode: form.model.electronicTagCode.trim(),
      remark: form.model.remark.trim(),
      specialParameters,
      boiler: isBoiler
        ? {
            boilerType: String(specialParameters.boilerType || 'water') as 'water' | 'steam',
            registrationCode: form.model.registrationCode,
            useCertificateNo: form.model.useCertificateNo,
            internalNo: form.model.internalNo,
            ratedEvaporation: numericParameter(specialParameters.evaporationCapacity),
            designPressure: numericParameter(specialParameters.designPressure),
            workingPressure: numericParameter(specialParameters.workingPressure),
            workingTemperature: numericParameter(specialParameters.workingTemperature),
            fuelType: String(specialParameters.combustionMethod || ''),
            purpose: String(specialParameters.purpose || ''),
            maintenanceOrganization: form.model.maintenanceOrganization,
            installationOrganization: form.model.installationOrganization
          }
        : null,
      pressureGaugeIds: [...form.model.pressureGaugeIds],
      safetyValveIds: [...form.model.safetyValveIds]
    }
  }
  const resetForm = async () => {
    Object.assign(form.model, initialForm())
    supplierSelection.value = []
    pressureGaugeSelection.value = []
    safetyValveSelection.value = []
    await nextTick()
    formRef.value?.clearValidate()
  }
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await saveEquipmentLedger(buildPayload())
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '设备台账保存失败，请检查内容后重试')
      return false
    }
  }
  const prepareForm = async (data: EquipmentLedgerDialogOpenData): Promise<void> => {
    await resetForm()
    source.categoryTree = data.categoryTree
    source.locationTree = data.locationTree
    if (data.loadDetail) data.row = await data.loadDetail()
    if (data.row) {
      Object.assign(form.model, {
        ...data.row,
        locationId: data.row.locationId || undefined,
        responsibleEmployeeId: data.row.responsibleEmployeeId || undefined,
        supplierId: data.row.supplierId || undefined,
        equipmentShortName: data.row.equipmentShortName || '',
        specification: data.row.specification || '',
        model: data.row.model || '',
        manufacturer: data.row.manufacturer || '',
        factoryNo: data.row.factoryNo || '',
        registrationCode: data.row.registrationCode || data.row.boiler?.registrationCode || '',
        internalNo: data.row.internalNo || data.row.boiler?.internalNo || '',
        useCertificateNo: data.row.useCertificateNo || data.row.boiler?.useCertificateNo || '',
        detailLocation: data.row.detailLocation || '',
        maintenanceOrganization:
          data.row.maintenanceOrganization || data.row.boiler?.maintenanceOrganization || '',
        installationOrganization:
          data.row.installationOrganization || data.row.boiler?.installationOrganization || '',
        designOrganization: data.row.designOrganization || '',
        maintenanceQualificationUrl: data.row.maintenanceQualificationUrl || '',
        useRegistrationCertificateUrl: data.row.useRegistrationCertificateUrl || '',
        nameplateUrl: data.row.nameplateUrl || '',
        photoUrl: data.row.photoUrl || '',
        specialParameters: {
          ...(data.row.boiler
            ? {
                boilerType: data.row.boiler.boilerType,
                evaporationCapacity: data.row.boiler.ratedEvaporation,
                designPressure: data.row.boiler.designPressure,
                workingPressure: data.row.boiler.workingPressure,
                workingTemperature: data.row.boiler.workingTemperature,
                combustionMethod: data.row.boiler.fuelType,
                purpose: data.row.boiler.purpose
              }
            : {}),
          ...(data.row.specialParameters || {})
        },
        manufactureDate: data.row.manufactureDate || '',
        installationDate: data.row.installationDate || '',
        commissioningDate: data.row.commissioningDate || '',
        enableDate: data.row.enableDate || '',
        fixedAssetNo: data.row.fixedAssetNo || '',
        erpCode: data.row.erpCode || '',
        electronicTagCode: data.row.electronicTagCode || '',
        remark: data.row.remark || '',
        boiler: data.row.boiler
          ? { ...initialForm().boiler, ...data.row.boiler }
          : initialForm().boiler
      })
      supplierSelection.value = data.row.supplier ? [{ ...data.row.supplier }] : []
      ;[pressureGaugeSelection.value, safetyValveSelection.value] = await Promise.all([
        selectedRows(data.row.pressureGaugeIds, 'pressure_gauge'),
        selectedRows(data.row.safetyValveIds, 'safety_valve')
      ])
    } else {
      form.model.categoryId = data.presetCategoryId || ''
      form.model.locationId = data.presetLocationId
      form.model.equipmentKind = data.presetKind || form.model.equipmentKind
    }
  }
  const loadInitialData = async (): Promise<void> => {
    const data = currentOpenData.value
    if (!data) return
    loadError.value = null
    dialogRef.value?.setLoading(true)
    try {
      await prepareForm(data)
      await Promise.all([
        numberRule.loadRule(),
        ...[
          'smisEquipmentKind',
          'smisEquipmentUseStatus',
          'smisEquipmentOperationStatus',
          'smisEquipmentAssetStatus',
          'smisEquipmentImportanceLevel',
          'commonEnabledStatus',
          'smisBoilerType',
          'supplierCategory'
        ].map((code) => userStore.ensureDictLoaded(code)),
        formRef.value?.reloadOptions('usingOrganizationId'),
        formRef.value?.reloadOptions('managingOrganizationId')
      ])
    } catch (error) {
      loadError.value = getFriendlySupabaseErrorMessage(error, '设备资料加载失败，请重新加载后重试')
    } finally {
      dialogRef.value?.setLoading(false)
    }
  }
  const handleOpen = async (data: EquipmentLedgerDialogOpenData): Promise<void> => {
    currentOpenData.value = data
    loadError.value = null
    await dialogRef.value?.handleOpen(data, {
      title: data.row
        ? '编辑设备台账'
        : data.presetKind === 'pressure_gauge'
          ? '新增压力表设备'
          : data.presetKind === 'safety_valve'
            ? '新增安全阀设备'
            : '新增设备台账',
      subtitle: '维护设备主档、责任关系与专用设备扩展信息',
      confirmText: '保存设备台账',
      contentMaxHeight: 'calc(100vh - 168px)',
      loading: true,
      onOpen: loadInitialData,
      onConfirm: async () => (loadError.value ? false : handleSubmit()),
      onReset: () => {
        currentOpenData.value = undefined
        void resetForm()
      }
    })
  }
  defineExpose({ handleOpen, openAccessorySelector })
</script>

<style scoped lang="scss">
  .equipment-ledger-dialog {
    &__context {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr);
      gap: 13px;
      align-items: center;
      padding: 13px 15px;
      margin-bottom: 18px;
      background: linear-gradient(
        115deg,
        color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color)),
        color-mix(in srgb, #14b8a6 6%, var(--default-box-color))
      );
      border: 1px solid color-mix(in srgb, var(--theme-color) 16%, transparent);
      border-radius: var(--art-surface-radius);
    }

    &__context > span {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      color: var(--theme-color);
      background: var(--default-box-color);
      border-radius: var(--art-surface-radius);
      box-shadow: 0 8px 20px rgb(15 23 42 / 8%);
    }

    &__context strong {
      color: var(--el-text-color-primary);
    }

    &__context p {
      margin: 3px 0 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__accessory-empty {
      display: grid;
      gap: var(--art-space-2);
      justify-items: center;

      p {
        max-width: 420px;
        margin: 0;
        font-size: 13px;
        line-height: 1.6;
        color: var(--el-text-color-secondary);
        text-align: center;
      }
    }
  }
</style>
