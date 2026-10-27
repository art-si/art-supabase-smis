<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="equipment-reminder-dialog">
      <div class="equipment-reminder-dialog__summary">
        <span><ArtSvgIcon icon="ri:notification-3-line" /></span>
        <div>
          <strong>{{ equipment?.equipmentName }}</strong>
          <p>{{ equipment?.equipmentCode }} · 检验到期后将按所选提前天数生成多渠道发送任务。</p>
        </div>
      </div>
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
      >
        <template #responsibleEmployeeId>
          <ArtEmployeeSelect
            v-model="form.model.responsibleEmployeeId"
            :tenant-id="getUserInfo.tenantId"
            title="选择提醒责任人"
            subtitle="消息将直接发送给当前租户员工花名册中的责任人"
            placeholder="从员工花名册选择责任人"
          />
        </template>
      </ArtForm>
      <div class="equipment-reminder-dialog__tokens">
        <strong>可用模板变量</strong>
        <span v-for="token in templateTokens" :key="token">{{ token }}</span>
      </div>
      <ArtSectionCard
        v-if="deliveries.length"
        title="最近发送记录"
        subtitle="保留渠道、计划时间、状态与失败原因审计快照"
        :min-height="140"
      >
        <div class="equipment-reminder-dialog__deliveries">
          <article v-for="item in deliveries" :key="item.id">
            <ArtDictDisplay dict-code="smisEquipmentReminderChannel" :value="item.channel" />
            <span>{{ item.dueDate }} · 提前 {{ item.leadDays }} 天</span>
            <ElTag :type="deliveryTag(item.status)" size="small">{{
              deliveryLabel(item.status)
            }}</ElTag>
          </article>
        </div>
      </ArtSectionCard>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { toDictionaryOption } from '@/utils/form/option'

  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchEquipmentReminder,
    saveEquipmentReminder,
    type SmisEquipment,
    type SmisEquipmentReminderChannel,
    type SmisEquipmentReminderDelivery
  } from '@smis/api'

  export interface EquipmentReminderDialogOpenData {
    equipment: SmisEquipment
  }
  interface ReminderForm {
    responsibleEmployeeId: string
    reminderDays: number[]
    channels: SmisEquipmentReminderChannel[]
    messageTemplate: string
    enabled: boolean
  }
  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }
  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getDictMap, getUserInfo } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<EquipmentReminderDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const equipment = shallowRef<SmisEquipment>()
  const deliveries = ref<SmisEquipmentReminderDelivery[]>([])
  const defaultTemplate =
    '设备【{equipmentName}】（{equipmentCode}）的{inspectionCategory}将于{dueDate}到期，剩余{daysRemaining}天，请及时处理。'
  const templateTokens = [
    '{equipmentName}',
    '{equipmentCode}',
    '{inspectionCategory}',
    '{dueDate}',
    '{daysRemaining}',
    '{responsibleName}'
  ]
  const initialForm = (): ReminderForm => ({
    responsibleEmployeeId: '',
    reminderDays: [30, 7, 1],
    channels: ['mobile_push'],
    messageTemplate: defaultTemplate,
    enabled: true
  })
  const formModel = reactive<ReminderForm>(initialForm())
  const channelOptions = computed(() =>
    (getDictMap.value.smisEquipmentReminderChannel ?? []).map(toDictionaryOption)
  )
  const reminderDayOptions = [0, 1, 3, 5, 7, 10, 15, 30, 45, 60, 90, 180, 365].map((value) => ({
    label: value === 0 ? '到期当天' : `提前 ${value} 天`,
    value
  }))
  const form = reactive<{
    model: ReminderForm
    items: ComputedRef<FormItem[]>
    rules: FormRules<ReminderForm>
  }>({
    model: formModel,
    items: computed(() => [
      { label: '提醒责任人', key: 'responsibleEmployeeId', type: 'text', span: 12 },
      {
        label: '启用提醒',
        key: 'enabled',
        type: 'switch',
        span: 12,
        description: '停用后保留配置与历史发送审计，但不再生成新任务。'
      },
      {
        label: '提前提醒天数',
        key: 'reminderDays',
        type: 'select',
        span: 24,
        options: reminderDayOptions,
        props: {
          multiple: true,
          clearable: true,
          collapseTags: true,
          collapseTagsTooltip: true,
          placeholder: '选择一个或多个提醒节点'
        }
      },
      {
        label: '推送渠道',
        key: 'channels',
        type: 'checkboxGroup',
        span: 24,
        options: channelOptions.value,
        props: { optionType: 'button' },
        description: '企微、钉钉和短信由渠道适配器消费发送队列；移动端由站内消息服务处理。'
      },
      {
        label: '提醒消息模板',
        key: 'messageTemplate',
        type: 'input',
        span: 24,
        props: {
          type: 'textarea',
          rows: 5,
          maxlength: 1000,
          showWordLimit: true,
          resize: 'none',
          placeholder: '请输入自定义提醒内容'
        }
      }
    ]),
    rules: {
      responsibleEmployeeId: [{ required: true, message: '请选择提醒责任人', trigger: 'change' }],
      reminderDays: [
        {
          type: 'array',
          required: true,
          min: 1,
          message: '请至少选择一个提醒天数',
          trigger: 'change'
        }
      ],
      channels: [
        {
          type: 'array',
          required: true,
          min: 1,
          message: '请至少选择一个推送渠道',
          trigger: 'change'
        }
      ],
      messageTemplate: [
        { required: true, message: '请输入提醒消息模板', trigger: 'blur' },
        { max: 1000, message: '消息模板不能超过 1000 个字符', trigger: 'blur' }
      ]
    }
  })
  const deliveryTag = (status: SmisEquipmentReminderDelivery['status']) =>
    (
      ({
        pending: 'primary',
        processing: 'warning',
        sent: 'success',
        failed: 'danger',
        cancelled: 'info'
      }) as const
    )[status]
  const deliveryLabel = (status: SmisEquipmentReminderDelivery['status']) =>
    ({
      pending: '待发送',
      processing: '发送中',
      sent: '已发送',
      failed: '失败',
      cancelled: '已取消'
    })[status]
  const resetForm = async () => {
    Object.assign(form.model, initialForm())
    deliveries.value = []
    await nextTick()
    formRef.value?.clearValidate()
  }
  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (!equipment.value) return false
      await saveEquipmentReminder(equipment.value.id, toRaw(form.model))
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '设备提醒保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: EquipmentReminderDialogOpenData): Promise<void> => {
    await resetForm()
    equipment.value = data.equipment
    await dialogRef.value?.handleOpen(data, {
      title: '配置设备到期提醒',
      subtitle: '责任人、提醒节点、推送渠道与消息内容均按租户隔离',
      confirmText: '保存提醒配置',
      contentMaxHeight: 'calc(100vh - 176px)',
      loading: true,
      onOpen: async (_data, api) => {
        try {
          await userStore.ensureDictLoaded('smisEquipmentReminderChannel')
          const result = await fetchEquipmentReminder(data.equipment.id)
          if (result.data?.config)
            Object.assign(form.model, {
              responsibleEmployeeId: result.data.config.responsibleEmployeeId,
              reminderDays: result.data.config.reminderDays,
              channels: result.data.config.channels,
              messageTemplate: result.data.config.messageTemplate,
              enabled: result.data.config.enabled
            })
          else if (data.equipment.responsibleEmployeeId)
            form.model.responsibleEmployeeId = data.equipment.responsibleEmployeeId
          deliveries.value = result.data?.recentDeliveries ?? []
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
  .equipment-reminder-dialog {
    display: grid;
    gap: 16px;

    &__summary {
      display: grid;
      grid-template-columns: 44px 1fr;
      gap: 12px;
      align-items: center;
      padding: 13px 15px;
      background: color-mix(in srgb, #f59e0b 8%, var(--default-box-color));
      border-left: 3px solid #f59e0b;
      border-radius: var(--art-surface-radius);
    }

    &__summary > span {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      color: #d97706;
      background: var(--default-box-color);
      border-radius: var(--art-surface-radius);
    }

    &__summary p {
      margin: 3px 0 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__tokens {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      align-items: center;
      padding: 0 16px;
    }

    &__tokens strong {
      margin-right: 4px;
      font-size: 12px;
    }

    &__tokens span {
      padding: 4px 7px;
      font-family: monospace;
      font-size: 11px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, var(--default-box-color));
      border-radius: var(--art-surface-radius);
    }

    &__deliveries {
      display: grid;
      gap: 8px;
    }

    &__deliveries article {
      display: grid;
      grid-template-columns: 110px 1fr auto;
      gap: 10px;
      align-items: center;
      padding: 9px 10px;
      background: var(--art-gray-100);
      border-radius: var(--art-surface-radius);
    }

    &__deliveries article > span {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
</style>
