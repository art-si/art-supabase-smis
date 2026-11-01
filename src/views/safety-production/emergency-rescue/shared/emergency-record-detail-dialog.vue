<template>
  <ArtDialog
    @open="
      () => {
        activeDetailTab = 'section-0'
      }
    "
    ref="dialogRef"
    size="xl"
  >
    <div v-if="detail" class="emergency-record-detail">
      <header class="emergency-record-detail__hero">
        <span aria-hidden="true">
          <ArtSvgIcon :icon="heroIcon" />
        </span>
        <div>
          <strong>{{ recordName }}</strong>
          <small
            >{{ recordNo }}<template v-if="recordVersion"> · {{ recordVersion }}</template></small
          >
        </div>
        <div class="emergency-record-detail__status">
          <ArtDictDisplay
            v-if="isRescuePlan"
            dict-code="commonDraftSubmittedStatus"
            :value="rescuePlan?.recordStatus"
            display="tag"
          />
          <ArtDictDisplay
            v-else-if="drillPlan"
            dict-code="smisEmergencyDrillPlanStatus"
            :value="drillPlan?.status"
            display="tag"
          />
          <ElTag
            v-else
            :type="drillRecord?.status === 'submitted' ? 'success' : 'info'"
            effect="light"
            >{{ drillRecord?.status === 'submitted' ? '已提交' : '草稿' }}</ElTag
          >
          <ArtDictDisplay dict-code="commonWarningStatus" :value="warningStatus" display="tag" />
          <ElTag v-if="rescuePlan?.isPublicScope" type="success" effect="plain">公共</ElTag>
        </div>
      </header>

      <template v-if="rescuePlan">
        <ElTabs v-model="activeDetailTab"
          ><ElTabPane name="section-0" label="预案与范围"
            ><div class="min-w-0 space-y-4"
              ><ArtSectionCard title="预案信息" subtitle="版本、适用范围与状态">
                <ArtDescriptions :data="rescuePlan" :items="rescueBasicItems" :columns="3" />
              </ArtSectionCard>
              <ArtSectionCard title="预案说明" subtitle="适用场景、响应范围与演练要点">
                <p class="emergency-record-detail__description">{{
                  rescuePlan.description || '—'
                }}</p>
              </ArtSectionCard></div
            ></ElTabPane
          >
          <ElTabPane name="section-1" label="评审与预警"
            ><div class="min-w-0 space-y-4"
              ><ArtSectionCard title="评审与预警" subtitle="按最新评审时间和周期提前 7 天预警">
                <ArtDescriptions :data="rescuePlan" :items="rescueReviewItems" :columns="3" />
                <ElAlert
                  v-if="rescuePlan.reviewRequiredAfterDrill"
                  class="emergency-record-detail__alert"
                  type="warning"
                  show-icon
                  :closable="false"
                  title="最新演练晚于当前评审时间，请完成本次演练后的预案评审。"
                /> </ArtSectionCard></div
          ></ElTabPane>
          <ElTabPane name="section-2" label="预案与备案附件"
            ><div class="min-w-0 space-y-4"
              ><ArtSectionCard
                title="预案附件"
                :empty="!rescuePlan.planAttachmentUrls.length"
                empty-title="暂无预案附件"
                empty-description="上传预案文件后可在此查看。"
              >
                <ArtUploadFile
                  :model-value="rescuePlan.planAttachmentUrls"
                  multiple
                  readonly
                  :show-tip="false"
                />
              </ArtSectionCard>
              <ArtSectionCard
                title="备案表附件"
                :empty="!rescuePlan.filingAttachmentUrls.length"
                empty-title="暂无备案表附件"
                empty-description="上传备案表后可在此查看。"
              >
                <ArtUploadFile
                  :model-value="rescuePlan.filingAttachmentUrls"
                  multiple
                  readonly
                  :show-tip="false"
                /> </ArtSectionCard></div></ElTabPane
        ></ElTabs>
      </template>

      <template v-else-if="drillPlan">
        <ElTabs v-model="activeDetailTab"
          ><ElTabPane name="section-0" label="计划与内容"
            ><div class="min-w-0 space-y-4"
              ><ArtSectionCard title="计划信息" subtitle="计划来源、演练单位与执行安排">
                <ArtDescriptions :data="drillPlan" :items="drillBasicItems" :columns="3" />
              </ArtSectionCard>
              <ArtSectionCard title="演练内容" subtitle="科目、目的与参训范围">
                <ArtDescriptions
                  :data="drillPlan"
                  :items="drillContentItems"
                  :columns="2"
                /> </ArtSectionCard></div
          ></ElTabPane>
          <ElTabPane name="section-1" label="兑现与资料"
            ><div class="min-w-0 space-y-4"
              ><ArtSectionCard title="兑现与预警" subtitle="完成日前 3 天开始检查正式演练记录">
                <ArtDescriptions :data="drillPlan" :items="drillDeliveryItems" :columns="3" />
                <ElAlert
                  v-if="drillPlan.warningStatus === 'warning'"
                  class="emergency-record-detail__alert"
                  type="warning"
                  show-icon
                  :closable="false"
                  :title="drillWarningMessage"
                />
              </ArtSectionCard>
              <ArtSectionCard
                title="计划附件"
                :empty="!drillPlan.attachmentUrls.length"
                empty-title="暂无计划附件"
                empty-description="上传演练计划文件后可在此查看。"
              >
                <ArtUploadFile
                  :model-value="drillPlan.attachmentUrls"
                  multiple
                  readonly
                  :show-tip="false"
                /> </ArtSectionCard></div></ElTabPane
        ></ElTabs>
      </template>

      <template v-else-if="drillRecord">
        <ElTabs v-model="activeDetailTab"
          ><ElTabPane name="section-0" label="演练与内容"
            ><div class="min-w-0 space-y-4"
              ><ArtSectionCard title="演练信息" subtitle="计划来源、演练单位与实际执行时间">
                <ArtDescriptions :data="drillRecord" :items="recordBasicItems" :columns="3" />
              </ArtSectionCard>
              <ArtSectionCard title="演练内容" subtitle="科目、目的、队伍与投入物资">
                <ArtDescriptions
                  :data="drillRecord"
                  :items="recordContentItems"
                  :columns="2"
                /> </ArtSectionCard></div
          ></ElTabPane>
          <ElTabPane name="section-1" label="过程与评价"
            ><div class="min-w-0 space-y-4"
              ><ArtSectionCard title="过程与评价" subtitle="演练过程、总结、效果评价与改进留痕">
                <ArtDescriptions
                  :data="drillRecord"
                  :items="recordReviewItems"
                  :columns="1"
                /> </ArtSectionCard></div
          ></ElTabPane>
          <ElTabPane name="section-2" label="影像与附件"
            ><div class="min-w-0 space-y-4"
              ><ArtSectionCard
                title="演练照片"
                :empty="!drillRecord.imageUrls.length"
                empty-title="暂无演练照片"
                empty-description="上传现场照片后可在此查看演练影像。"
              >
                <ArtUploadImage
                  :model-value="drillRecord.imageUrls"
                  multiple
                  readonly
                  :size="104"
                />
              </ArtSectionCard>
              <ArtSectionCard
                title="记录附件"
                :empty="!drillRecord.attachmentUrls.length"
                empty-title="暂无记录附件"
                empty-description="上传演练记录文件后可在此查看。"
              >
                <ArtUploadFile
                  :model-value="drillRecord.attachmentUrls"
                  multiple
                  readonly
                  :show-tip="false"
                /> </ArtSectionCard></div></ElTabPane
        ></ElTabs>
      </template>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import dayjs from 'dayjs'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type {
    SmisEmergencyDrillPlan,
    SmisEmergencyDrillRecord,
    SmisEmergencyEmployeeSnapshot,
    SmisEmergencyPosition,
    SmisEmergencyRescuePlan
  } from '@smis/api'

  export type EmergencyRecordDetailOpenData =
    | { kind: 'rescue'; row: SmisEmergencyRescuePlan }
    | { kind: 'drill'; row: SmisEmergencyDrillPlan }
    | { kind: 'record'; row: SmisEmergencyDrillRecord }

  const activeDetailTab = ref('section-0')
  const dialogRef = ref<ArtDialogExpose<EmergencyRecordDetailOpenData>>()
  const detail = shallowRef<
    SmisEmergencyRescuePlan | SmisEmergencyDrillPlan | SmisEmergencyDrillRecord
  >()
  const kind = ref<EmergencyRecordDetailOpenData['kind']>('rescue')
  const isRescuePlan = computed(() => kind.value === 'rescue')
  const rescuePlan = computed(() =>
    kind.value === 'rescue' ? (detail.value as SmisEmergencyRescuePlan) : undefined
  )
  const drillPlan = computed(() =>
    kind.value === 'drill' ? (detail.value as SmisEmergencyDrillPlan) : undefined
  )
  const drillRecord = computed(() =>
    kind.value === 'record' ? (detail.value as SmisEmergencyDrillRecord) : undefined
  )
  const recordName = computed(
    () =>
      rescuePlan.value?.planName || drillPlan.value?.drillName || drillRecord.value?.drillName || ''
  )
  const recordNo = computed(
    () => rescuePlan.value?.planNo || drillPlan.value?.planNo || drillRecord.value?.planNo || ''
  )
  const recordVersion = computed(() => rescuePlan.value?.planVersion || '')
  const heroIcon = computed(() => {
    if (isRescuePlan.value) return 'ri:file-shield-2-line'
    return drillRecord.value ? 'ri:file-check-line' : 'ri:calendar-check-line'
  })
  const warningStatus = computed(() => {
    if (rescuePlan.value) return rescuePlan.value.warningStatus
    if (drillPlan.value) return drillPlan.value.warningStatus
    const record = drillRecord.value
    return record?.actualStartDate &&
      record.planEndDate &&
      dayjs(record.actualStartDate).isAfter(record.planEndDate)
      ? 'warning'
      : 'normal'
  })
  const formatDateTime = createDateTimeFormatter({ format: 'YYYY-MM-DD HH:mm', emptyText: '—' })
  const formatDate = createDateTimeFormatter({ format: 'YYYY-MM-DD', emptyText: '—' })

  const rescueBasicItems: ArtDescriptionItem<SmisEmergencyRescuePlan>[] = [
    { key: 'planNo', label: '预案编码', field: 'planNo', copyable: true },
    { key: 'planVersion', label: '预案版本号', field: 'planVersion' },
    {
      key: 'planCategory',
      label: '预案类别',
      field: 'planCategory',
      dictCode: 'smisEmergencyPlanCategory',
      dictDisplay: 'tag'
    },
    { key: 'organization', label: '适用单位', field: 'applicableOrganizationName' },
    {
      key: 'positions',
      label: '适用岗位',
      value: (data: SmisEmergencyRescuePlan) =>
        data.applicablePositions.length
          ? data.applicablePositions
              .map((item: SmisEmergencyPosition) => item.positionName)
              .join('、')
          : '全部岗位',
      span: 2
    },
    {
      key: 'planLevel',
      label: '预案级别',
      field: 'planLevel',
      dictCode: 'smisEmergencyPlanLevel',
      dictDisplay: 'tag'
    },
    {
      key: 'frequency',
      label: '周期频次',
      field: 'frequency',
      dictCode: 'smisEmergencyPlanFrequency'
    },
    {
      key: 'special',
      label: '特种设备演练',
      value: (data: SmisEmergencyRescuePlan) => (data.isSpecialEquipmentDrill ? '是' : '否')
    },
    {
      key: 'valid',
      label: '是否有效',
      value: (data: SmisEmergencyRescuePlan) => (data.isValid ? '有效' : '已置废')
    },
    {
      key: 'updateTime',
      label: '更新时间',
      value: (data: SmisEmergencyRescuePlan) => formatDateTime(data.updateTime)
    }
  ]
  const rescueReviewItems: ArtDescriptionItem<SmisEmergencyRescuePlan>[] = [
    {
      key: 'reviewDate',
      label: '评审时间',
      value: (data: SmisEmergencyRescuePlan) => formatDate(data.reviewDate)
    },
    { key: 'reviewExperts', label: '评审专家', field: 'reviewExperts', span: 2 },
    {
      key: 'nextReviewDate',
      label: '下次评审日期',
      value: (data: SmisEmergencyRescuePlan) => formatDate(data.nextReviewDate)
    },
    {
      key: 'lastDrillDate',
      label: '最近演练日期',
      value: (data: SmisEmergencyRescuePlan) => formatDate(data.lastDrillDate)
    },
    {
      key: 'warningStatus',
      label: '预警状态',
      field: 'warningStatus',
      dictCode: 'commonWarningStatus',
      dictDisplay: 'tag'
    }
  ]
  const drillBasicItems: ArtDescriptionItem<SmisEmergencyDrillPlan>[] = [
    { key: 'planNo', label: '计划编号', field: 'planNo', copyable: true },
    { key: 'sourcePlanName', label: '应急救援预案', field: 'sourcePlanName', span: 2 },
    { key: 'compilationOrganizationName', label: '编制单位', field: 'compilationOrganizationName' },
    { key: 'organization', label: '演练单位', field: 'applicableOrganizationName' },
    { key: 'responsible', label: '演练负责人', field: 'responsibleEmployeeName' },
    {
      key: 'drillForm',
      label: '演练形式',
      field: 'drillForm',
      dictCode: 'smisEmergencyDrillForm',
      dictDisplay: 'tag'
    },
    {
      key: 'planCategory',
      label: '计划类别',
      field: 'planCategory',
      dictCode: 'smisEmergencyPlanCategory'
    },
    {
      key: 'planLevel',
      label: '演练级别',
      field: 'planLevel',
      dictCode: 'smisEmergencyPlanLevel',
      dictDisplay: 'tag'
    },
    {
      key: 'planStartDate',
      label: '计划开始日期',
      value: (data: SmisEmergencyDrillPlan) => formatDate(data.planStartDate)
    },
    {
      key: 'planEndDate',
      label: '计划完成日期',
      value: (data: SmisEmergencyDrillPlan) => formatDate(data.planEndDate)
    },
    { key: 'drillLocation', label: '演练地点', field: 'drillLocation' }
  ]
  const drillContentItems: ArtDescriptionItem<SmisEmergencyDrillPlan>[] = [
    { key: 'drillSubject', label: '演练科目', field: 'drillSubject', span: 2 },
    { key: 'drillPurpose', label: '演练目的', field: 'drillPurpose', span: 2 },
    {
      key: 'trainees',
      label: '参训人员',
      value: (data: SmisEmergencyDrillPlan) =>
        data.trainees.length
          ? data.trainees
              .map(
                (item: SmisEmergencyEmployeeSnapshot) => `${item.employeeName} · ${item.employeeNo}`
              )
              .join('、')
          : '—',
      span: 2
    },
    { key: 'remark', label: '备注', field: 'remark', span: 2 }
  ]
  const drillDeliveryItems: ArtDescriptionItem<SmisEmergencyDrillPlan>[] = [
    {
      key: 'recordStatus',
      label: '演练记录',
      value: (data: SmisEmergencyDrillPlan) =>
        data.recordId ? (data.recordStatus === 'submitted' ? '已提交' : '草稿') : '未录入'
    },
    {
      key: 'actualStartDate',
      label: '实际演练日期',
      value: (data: SmisEmergencyDrillPlan) => formatDate(data.actualStartDate)
    },
    {
      key: 'warningStatus',
      label: '预警状态',
      field: 'warningStatus',
      dictCode: 'commonWarningStatus',
      dictDisplay: 'tag'
    }
  ]
  const recordBasicItems: ArtDescriptionItem<SmisEmergencyDrillRecord>[] = [
    { key: 'planNo', label: '计划编号', field: 'planNo', copyable: true },
    { key: 'sourcePlanName', label: '应急救援预案', field: 'sourcePlanName', span: 2 },
    { key: 'organization', label: '演练单位', field: 'applicableOrganizationName' },
    { key: 'responsible', label: '演练负责人', field: 'responsibleEmployeeName' },
    {
      key: 'status',
      label: '记录状态',
      value: (data: SmisEmergencyDrillRecord) => (data.status === 'submitted' ? '已提交' : '草稿')
    },
    {
      key: 'actualStartDate',
      label: '实际开始日期',
      value: (data: SmisEmergencyDrillRecord) => formatDate(data.actualStartDate)
    },
    {
      key: 'actualEndDate',
      label: '实际结束日期',
      value: (data: SmisEmergencyDrillRecord) => formatDate(data.actualEndDate)
    },
    { key: 'drillLocation', label: '演练地点', field: 'drillLocation' },
    {
      key: 'drillForm',
      label: '演练形式',
      field: 'drillForm',
      dictCode: 'smisEmergencyDrillForm',
      dictDisplay: 'tag'
    },
    {
      key: 'planCategory',
      label: '计划类别',
      field: 'planCategory',
      dictCode: 'smisEmergencyPlanCategory'
    },
    {
      key: 'planLevel',
      label: '演练级别',
      field: 'planLevel',
      dictCode: 'smisEmergencyPlanLevel',
      dictDisplay: 'tag'
    }
  ]
  const recordContentItems: ArtDescriptionItem<SmisEmergencyDrillRecord>[] = [
    { key: 'drillSubject', label: '演练科目', field: 'drillSubject', span: 2 },
    { key: 'drillPurpose', label: '演练目的', field: 'drillPurpose', span: 2 },
    { key: 'drillTeam', label: '演练队伍', field: 'drillTeam' },
    { key: 'equipmentMaterials', label: '应急设备及器材', field: 'equipmentMaterials' },
    {
      key: 'participants',
      label: '参演人员',
      value: (data: SmisEmergencyDrillRecord) =>
        data.participants.length
          ? data.participants.map((item) => `${item.employeeName} · ${item.employeeNo}`).join('、')
          : '—',
      span: 2
    }
  ]
  const recordReviewItems: ArtDescriptionItem<SmisEmergencyDrillRecord>[] = [
    { key: 'drillProcess', label: '过程记录', field: 'drillProcess' },
    { key: 'drillSummary', label: '演练总结', field: 'drillSummary' },
    { key: 'drillEvaluation', label: '效果评价', field: 'drillEvaluation' },
    { key: 'remark', label: '备注', field: 'remark' }
  ]
  const drillWarningMessage = computed(() => {
    const plan = drillPlan.value
    if (!plan) return ''
    if (plan.recordStatus === 'submitted' && plan.actualStartDate && plan.planEndDate)
      return dayjs(plan.actualStartDate).isAfter(plan.planEndDate)
        ? '实际演练日期晚于计划完成日期，该计划已计入预警值。'
        : '该计划存在需要关注的兑现风险。'
    return '计划已进入完成日前 3 天预警期，尚未录入并提交演练记录。'
  })

  const handleOpen = async (data: EmergencyRecordDetailOpenData): Promise<void> => {
    kind.value = data.kind
    detail.value = data.row
    await dialogRef.value?.handleOpen(data, {
      title:
        data.kind === 'rescue'
          ? '应急救援预案详情'
          : data.kind === 'drill'
            ? '应急演练计划详情'
            : '应急演练记录详情',
      subtitle:
        data.kind === 'rescue'
          ? '查看预案版本、评审与适用范围'
          : data.kind === 'drill'
            ? '查看计划安排与兑现预警'
            : '查看实际执行、参演人员、过程评价与现场证据',
      showFooter: false,
      contentMaxHeight: 'calc(100vh - 132px)'
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .emergency-record-detail {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    min-width: 0;

    &__hero {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 16px;
      background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-base);

      > span {
        display: grid;
        place-items: center;
        width: 56px;
        height: 56px;
        font-size: 24px;
        color: var(--theme-color);
        background: var(--default-box-color);
        border-radius: var(--el-border-radius-base);
      }

      > div:nth-child(2) {
        display: grid;
        min-width: 0;
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        font-size: 18px;
        color: var(--el-text-color-primary);
      }

      small {
        margin-top: 5px;
        color: var(--el-text-color-secondary);
      }
    }

    &__status {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }

    &__alert {
      margin-top: 14px;
    }

    &__description {
      margin: 0;
      line-height: 1.8;
      color: var(--el-text-color-regular);
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    @media (width <= 720px) {
      &__hero {
        grid-template-columns: 48px minmax(0, 1fr);

        > span {
          width: 48px;
          height: 48px;
        }
      }

      &__status {
        grid-column: 1 / -1;
        justify-content: flex-start;
      }
    }
  }
</style>
