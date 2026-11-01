<template>
  <ArtDialog
    @open="
      () => {
        activeFormTab = 'section-0'
      }
    "
    ref="dialogRef"
    size="xl"
  >
    <div class="risk-point-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:map-pin-user-line" /></template>
        <strong>以场所为主线建立风险点</strong>
        <p>编号保存时自动生成 5 位流水码；风险等级由关联危害因素的定量评价自动汇总。</p>
      </ArtEntitySummary>

      <ArtForm
        v-model:active-tab="activeFormTab"
        custom-layout
        ref="formRef"
        v-model="form"
        :rules="rules"
        label-position="top"
      >
        <ElTabs v-model="activeFormTab"
          ><ElTabPane name="section-0" label="风险点与设备" data-art-form-tab="section-0"
            ><div class="min-w-0 space-y-4"
              ><ArtSectionTitle title="基本信息" subtitle="明确风险点身份、场所和风险类型" />
              <div class="risk-point-dialog__grid">
                <ElFormItem label="风险点编号">
                  <ElInput
                    :model-value="row?.pointNo || ''"
                    disabled
                    placeholder="保存后自动生成"
                  />
                </ElFormItem>
                <ElFormItem label="风险点名称" prop="pointName">
                  <ElInput
                    v-model="form.pointName"
                    maxlength="200"
                    placeholder="请输入风险点名称"
                  />
                </ElFormItem>
                <ElFormItem label="风险类型" prop="riskType">
                  <ElSelect v-model="form.riskType" class="w-full">
                    <ElOption v-for="item in riskTypeOptions" :key="item.value" v-bind="item" />
                  </ElSelect>
                </ElFormItem>
                <ElFormItem label="场所" prop="siteId">
                  <RiskSiteSelect v-model="form.siteId" :sites="options.sites" />
                </ElFormItem>
              </div>

              <ArtSectionTitle
                title="设备设施与辨识单位"
                subtitle="普通设备可从台账选择或手工填写；特种设备必须从特种设备台账选择"
              />
              <div class="risk-point-dialog__grid">
                <ElFormItem label="是否特种设备">
                  <ElSwitch
                    v-model="form.isSpecialEquipment"
                    inline-prompt
                    active-text="是"
                    inactive-text="否"
                    @change="handleSpecialEquipmentChange"
                  />
                </ElFormItem>
                <ElFormItem label="设备设施" prop="equipmentValue">
                  <ElSelect
                    v-model="form.equipmentValue"
                    class="w-full"
                    filterable
                    :allow-create="!form.isSpecialEquipment"
                    default-first-option
                    clearable
                    placeholder="从设备台账选择或输入设备名称"
                    @change="handleEquipmentChange"
                  >
                    <ElOption
                      v-for="item in availableEquipment"
                      :key="item.id"
                      :label="`${item.equipmentName} · ${item.equipmentCode}`"
                      :value="item.id"
                    >
                      <div class="risk-point-dialog__equipment-option">
                        <span>{{ item.equipmentName }}</span>
                        <small>{{ item.equipmentCode }}</small>
                        <ElTag v-if="item.isSpecialEquipment" size="small" type="warning"
                          >特种设备</ElTag
                        >
                      </div>
                    </ElOption>
                  </ElSelect>
                </ElFormItem>
                <ElFormItem class="risk-point-dialog__wide" label="辨识单位" prop="organizationIds">
                  <ElTreeSelect
                    v-model="form.organizationIds"
                    :data="organizationTree"
                    :props="organizationProps"
                    node-key="id"
                    value-key="id"
                    multiple
                    check-strictly
                    show-checkbox
                    filterable
                    collapse-tags
                    collapse-tags-tooltip
                    default-expand-all
                    placeholder="选择一个或多个辨识单位"
                    class="w-full"
                  />
                  <small class="risk-point-dialog__help"
                    >选择后自动关联组织编码，列表统一展示单位名称与编码。</small
                  >
                </ElFormItem>
              </div>
            </div></ElTabPane
          >
          <ElTabPane name="section-1" label="方案与证据" data-art-form-tab="section-1"
            ><div class="min-w-0 space-y-4"
              ><ArtSectionTitle
                title="方案与证据"
                subtitle="集中维护管控方案、现场照片和业务附件" />
              <div class="risk-point-dialog__grid">
                <ElFormItem label="风险管控方案">
                  <ElInput
                    v-model="form.controlPlanName"
                    maxlength="300"
                    placeholder="请输入或粘贴风险管控方案名称"
                  />
                </ElFormItem>
                <ElFormItem label="排序">
                  <ElInputNumber v-model="form.sort" :min="0" :max="9999" class="w-full" />
                </ElFormItem>
                <ElFormItem class="risk-point-dialog__wide" label="管控方案附件">
                  <ArtUploadFile
                    v-model="form.controlPlanAttachmentUrls"
                    multiple
                    :limit="8"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,image/*"
                    tip="上传管控方案正文或支撑材料，单个文件不超过 20 MB"
                  />
                </ElFormItem>
                <ElFormItem label="风险点照片">
                  <ArtUploadImage
                    v-model="form.photoUrls"
                    multiple
                    :limit="6"
                    :size="104"
                    title="上传现场照片"
                  />
                </ElFormItem>
                <ElFormItem label="其他附件">
                  <ArtUploadFile
                    v-model="form.attachmentUrls"
                    multiple
                    :limit="8"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,image/*"
                    tip="支持文档、表格、压缩包和图片"
                  />
                </ElFormItem> </div></div></ElTabPane
        ></ElTabs>
      </ArtForm>
    </div>

    <template #footer="{ api }">
      <ElButton @click="api.handleClose()">取消</ElButton>
      <ElButton
        v-auth="
          row ? 'SmisDualControlRiskIdentification:Edit' : 'SmisDualControlRiskIdentification:Add'
        "
        type="primary"
        :loading="submitting"
        @click="handleSubmit"
        >保存风险点</ElButton
      >
    </template>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { computed, onDeactivated, ref, shallowRef } from 'vue'
  import { storeToRefs } from 'pinia'
  import ArtForm from '@/components/core/forms/art-form/index.vue'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import TreeUtils from '@/utils/tree'
  import {
    saveRiskPoint,
    type SmisRiskIdentificationOptions,
    type SmisRiskPoint,
    type SmisRiskPointSavePayload,
    type SmisRiskPointType
  } from '@smis/api'
  import RiskSiteSelect from './risk-site-select.vue'

  export interface RiskPointDialogOpenData {
    row?: SmisRiskPoint
    options: SmisRiskIdentificationOptions
    loadOptions?: () => Promise<SmisRiskIdentificationOptions>
  }
  interface RiskPointForm extends Omit<SmisRiskPointSavePayload, 'equipmentName' | 'equipmentId'> {
    equipmentValue: string
    equipmentId?: string
    equipmentName: string
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const activeFormTab = ref('section-0')
  const dialogRef = ref<ArtDialogExpose<RiskPointDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const submitting = ref(false)
  const row = shallowRef<SmisRiskPoint>()
  const options = shallowRef<SmisRiskIdentificationOptions>({
    sites: [],
    organizations: [],
    equipment: [],
    hazardCategories: []
  })
  const tree = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const organizationProps = { label: 'organizationName', children: 'children' }
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const defaultRiskTypeOptions: Array<{ label: string; value: SmisRiskPointType }> = [
    { label: '未选择', value: 'unset' },
    { label: '部位场所', value: 'location' },
    { label: '设备设施', value: 'equipment' },
    { label: '作业活动', value: 'activity' }
  ]
  const riskTypeOptions = computed<Array<{ label: string; value: SmisRiskPointType }>>(() => {
    const dictionary = getDictMap.value.smisRiskPointType ?? []
    return dictionary.length
      ? dictionary.map((item) => ({
          label: item.label || item.name,
          value: item.value as SmisRiskPointType
        }))
      : defaultRiskTypeOptions
  })
  const initial = (): RiskPointForm => ({
    pointName: '',
    riskType: 'unset',
    siteId: '',
    equipmentValue: '',
    equipmentId: undefined,
    equipmentName: '',
    isSpecialEquipment: false,
    controlPlanName: '',
    controlPlanAttachmentUrls: [],
    photoUrls: [],
    attachmentUrls: [],
    organizationIds: [],
    sort: 0
  })
  const form = ref<RiskPointForm>(initial())
  const organizationTree = computed(() => tree.listToTree(options.value.organizations))
  const availableEquipment = computed(() =>
    form.value.isSpecialEquipment
      ? options.value.equipment.filter((item) => item.isSpecialEquipment)
      : options.value.equipment
  )
  const rules: FormRules<RiskPointForm> = {
    pointName: [{ required: true, message: '请输入风险点名称', trigger: 'blur' }],
    siteId: [{ required: true, message: '请选择场所', trigger: 'change' }],
    equipmentValue: [
      {
        validator: (_rule, value, callback) => {
          if (!String(value || '').trim()) callback(new Error('请选择或输入设备设施名称'))
          else if (form.value.isSpecialEquipment && !form.value.equipmentId)
            callback(new Error('特种设备必须从特种设备台账选择'))
          else callback()
        },
        trigger: 'change'
      }
    ],
    organizationIds: [
      {
        type: 'array',
        required: true,
        min: 1,
        message: '请至少选择一个辨识单位',
        trigger: 'change'
      }
    ]
  }

  const handleEquipmentChange = (value: string): void => {
    const equipment = options.value.equipment.find((item) => item.id === value)
    form.value.equipmentId = equipment?.id
    form.value.equipmentName = equipment?.equipmentName ?? value?.trim() ?? ''
  }
  const handleSpecialEquipmentChange = (): void => {
    const current = options.value.equipment.find((item) => item.id === form.value.equipmentId)
    if (form.value.isSpecialEquipment && !current?.isSpecialEquipment) {
      form.value.equipmentValue = ''
      form.value.equipmentId = undefined
      form.value.equipmentName = ''
    }
    void formRef.value?.validateField('equipmentValue')
  }
  const handleSubmit = async (): Promise<void> => {
    if (submitting.value) return
    try {
      await formRef.value?.validate()
      submitting.value = true
      await saveRiskPoint({
        id: row.value?.id,
        pointName: form.value.pointName.trim(),
        riskType: form.value.riskType,
        siteId: form.value.siteId,
        equipmentId: form.value.equipmentId || null,
        equipmentName: form.value.equipmentName.trim(),
        isSpecialEquipment: form.value.isSpecialEquipment,
        controlPlanName: normalizeNullableText(form.value.controlPlanName),
        controlPlanAttachmentUrls: [...form.value.controlPlanAttachmentUrls],
        photoUrls: [...form.value.photoUrls],
        attachmentUrls: [...form.value.attachmentUrls],
        organizationIds: [...form.value.organizationIds],
        sort: form.value.sort
      })
      emit('success', row.value ? 'edit' : 'add')
      dialogRef.value?.handleClose(true)
    } catch {
      /* 表单与响应层负责给出业务提示 */
    } finally {
      submitting.value = false
    }
  }
  const handleOpen = async (data: RiskPointDialogOpenData): Promise<void> => {
    row.value = data.row
    options.value = data.options
    Object.assign(form.value, initial())
    if (data.row) {
      Object.assign(form.value, {
        pointName: data.row.pointName,
        riskType: data.row.riskType,
        siteId: data.row.siteId,
        equipmentValue: data.row.equipmentId || data.row.equipmentName,
        equipmentId: data.row.equipmentId || undefined,
        equipmentName: data.row.equipmentName,
        isSpecialEquipment: data.row.isSpecialEquipment,
        controlPlanName: data.row.controlPlanName || '',
        controlPlanAttachmentUrls: [...data.row.controlPlanAttachmentUrls],
        photoUrls: [...data.row.photoUrls],
        attachmentUrls: [...data.row.attachmentUrls],
        organizationIds: data.row.organizations.map((item) => item.id),
        sort: data.row.sort
      })
    }
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑风险点' : '新增风险点',
      subtitle: data.row
        ? `${data.row.pointNo} · ${data.row.pointName}`
        : '完善场所、设备和辨识单位信息',
      contentMaxHeight: 'calc(100vh - 150px)',
      loading: true,
      loadingText: '正在加载风险点选项…',
      onOpen: async (_openData, api) => {
        formRef.value?.clearValidate()
        try {
          await Promise.all([
            userStore.ensureDictLoaded('smisRiskPointType'),
            userStore.ensureDictLoaded('smisSiteCategory'),
            ...(!data.options.sites.length && data.loadOptions
              ? [data.loadOptions().then((loaded) => (options.value = loaded))]
              : [])
          ])
        } finally {
          api.setLoading(false)
        }
      }
    })
  }
  onDeactivated(() => dialogRef.value?.handleClose())
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .risk-point-dialog {
    &__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0 24px;
      min-width: 0;
      margin-top: 12px;
      margin-bottom: 20px;
    }

    &__wide {
      grid-column: 1 / -1;
    }

    &__help {
      display: block;
      margin-top: 6px;
      color: var(--el-text-color-secondary);
    }

    &__equipment-option {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 10px;
      align-items: center;

      small {
        color: var(--el-text-color-secondary);
      }
    }
  }

  @media (width <= 760px) {
    .risk-point-dialog__grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .risk-point-dialog__wide {
      grid-column: auto;
    }
  }
</style>
