<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="training-record-dialog">
      <article v-if="readonly && detailRecord" class="training-record-dialog__detail">
        <header class="training-record-dialog__detail-hero">
          <span aria-hidden="true"><ArtSvgIcon icon="ri:file-list-3-line" /></span>
          <div>
            <small>{{ detailRecord.recordNo }}</small>
            <h3>{{ detailRecord.subject }}</h3>
            <p>
              {{ detailRecord.planNo }} · {{ detailRecord.organizerOrganizationName }} ·
              {{ formatDateRange(detailRecord.actualStartAt, detailRecord.actualEndAt) }}
            </p>
          </div>
          <ArtDictDisplay :item="trainingRecordStatusItem(detailRecord.status)" display="tag" />
        </header>

        <section class="training-record-dialog__metrics" aria-label="培训执行概览">
          <article>
            <span><ArtSvgIcon icon="ri:percent-line" /></span>
            <div
              ><small>签到率</small><strong>{{ attendanceRateText }}</strong></div
            >
          </article>
          <article>
            <span><ArtSvgIcon icon="ri:user-follow-line" /></span>
            <div
              ><small>实到人数</small
              ><strong>{{ presentCount }} / {{ form.participants.length }}</strong
              ><em>人</em></div
            >
          </article>
          <article>
            <span><ArtSvgIcon icon="ri:checkbox-circle-line" /></span>
            <div
              ><small>考核通过</small><strong>{{ passCount }}</strong
              ><em>人</em></div
            >
          </article>
          <article>
            <span><ArtSvgIcon icon="ri:bar-chart-box-line" /></span>
            <div
              ><small>平均成绩</small><strong>{{ averageScoreText }}</strong></div
            >
          </article>
        </section>

        <ArtSectionCard title="执行信息" subtitle="培训计划来源与实际实施情况">
          <ArtDescriptions
            :data="detailRecord"
            :items="detailItems"
            :columns="3"
            :tablet-columns="2"
            label-width="110"
          />
        </ArtSectionCard>

        <ArtSectionCard title="培训内容与评价" subtitle="实际授课内容、培训效果及补充说明">
          <div class="training-record-dialog__narratives">
            <article>
              <small>培训内容</small>
              <p>{{ detailRecord.trainingContent || '暂无培训内容记录' }}</p>
            </article>
            <article>
              <small>效果评价</small>
              <p>{{ detailRecord.effectEvaluation || '暂无培训效果评价' }}</p>
            </article>
            <article v-if="detailRecord.remark">
              <small>备注</small>
              <p>{{ detailRecord.remark }}</p>
            </article>
          </div>
        </ArtSectionCard>

        <ArtSectionCard
          title="人员签到与考核"
          :subtitle="`共 ${form.participants.length} 人，已签到 ${presentCount} 人`"
        >
          <ArtTable
            :data="form.participants"
            :columns="detailAttendanceColumns"
            :pagination="false"
            row-key="employeeId"
            table-layout="fixed"
            empty-text="暂无参训人员"
          />
        </ArtSectionCard>

        <ArtSectionCard title="归档材料" subtitle="培训资料与签到佐证材料">
          <div class="training-record-dialog__evidence-grid">
            <section>
              <strong>培训附件</strong>
              <div v-if="detailRecord.attachmentUrls.length" class="training-record-dialog__files">
                <a
                  v-for="(url, index) in detailRecord.attachmentUrls"
                  :key="url"
                  :href="safeAttachmentUrl(url)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ArtSvgIcon icon="ri:attachment-2" />
                  <span>{{ getAttachmentNameFromUrl(url, `培训附件 ${index + 1}`) }}</span>
                  <ArtSvgIcon icon="ri:external-link-line" />
                </a>
              </div>
              <ArtEmptyState
                v-else
                title="暂无培训附件"
                description="培训课件、考卷或成绩单归档后将在此展示。"
                size="compact"
                :visual-size="52"
              />
            </section>
            <section>
              <strong>签到附件</strong>
              <div
                v-if="detailRecord.signInAttachmentUrls.length"
                class="training-record-dialog__files"
              >
                <a
                  v-for="(url, index) in detailRecord.signInAttachmentUrls"
                  :key="url"
                  :href="safeAttachmentUrl(url)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ArtSvgIcon icon="ri:file-list-3-line" />
                  <span>{{ getAttachmentNameFromUrl(url, `签到附件 ${index + 1}`) }}</span>
                  <ArtSvgIcon icon="ri:external-link-line" />
                </a>
              </div>
              <ArtEmptyState
                v-else
                title="暂无签到附件"
                description="纸质签到表或现场照片归档后将在此展示。"
                size="compact"
                :visual-size="52"
              />
            </section>
          </div>
        </ArtSectionCard>
      </article>

      <template v-else>
        <div class="training-record-dialog__context">
          <span aria-hidden="true"><ArtSvgIcon icon="ri:file-list-3-line" /></span>
          <div>
            <strong>{{ form.recordNo || '新培训记录' }}</strong>
            <p>计划信息和参训名单自动带入；归档前须逐人确认签到状态。</p>
          </div>
          <ArtDictDisplay :item="trainingRecordStatusItem(form.status)" display="tag" />
        </div>

        <ArtForm
          ref="formRef"
          :model-value="form"
          @update:model-value="replaceReactiveModel(form, $event)"
          :items="items"
          :rules="rules"
          :span="12"
          :gutter="24"
          label-position="top"
          :show-reset="false"
          :show-submit="false"
        >
          <template #trainingPlanId>
            <ElSelect
              v-model="form.trainingPlanId"
              class="w-full"
              filterable
              :disabled="Boolean(form.id)"
              placeholder="按计划编号或培训主题选择已发布计划"
              @change="applyPlan"
            >
              <ElOption
                v-for="plan in planOptions"
                :key="plan.id"
                :label="`${plan.planNo} · ${plan.subject}`"
                :value="plan.id"
              />
            </ElSelect>
          </template>
          <template #planContext>
            <div v-if="selectedPlan" class="training-record-dialog__plan-context">
              <div
                ><small>计划编号</small><strong>{{ selectedPlan.planNo }}</strong></div
              >
              <div
                ><small>计划时间</small
                ><strong>{{
                  formatRange(selectedPlan.plannedStartAt, selectedPlan.plannedEndAt)
                }}</strong></div
              >
              <div
                ><small>计划讲师</small
                ><strong>{{ selectedPlan.instructorName || '待完善' }}</strong></div
              >
              <div
                ><small>计划人数</small
                ><strong>{{ selectedPlan.participants.length }} 人</strong></div
              >
            </div>
            <ArtEmptyState
              v-else
              title="尚未选择培训计划"
              :description="
                planOptions.length
                  ? '从上方选择已发布计划后，将自动带入执行时间、讲师和参训人员。'
                  : '当前没有可生成记录的已发布计划，请先发布计划后再维护签到与考核信息。'
              "
              size="compact"
              :visual-size="72"
            >
              <SmisDataSourceEmptyActions
                v-if="planOptions.length === 0"
                source="safety-training-plan"
              />
            </ArtEmptyState>
          </template>
          <template #participants>
            <section class="training-record-dialog__attendance" aria-label="签到记录">
              <header>
                <span>已签到 {{ presentCount }} / {{ form.participants.length }} 人</span>
                <ElButton type="primary" plain @click="markAllPresent">
                  <ArtSvgIcon icon="ri:user-follow-line" /> 全部签到
                </ElButton>
              </header>
              <ArtTable
                ref="attendanceTableRef"
                :data="form.participants"
                :columns="attendanceColumns"
                :pagination="false"
                row-key="employeeId"
                table-layout="fixed"
                max-height="360"
                empty-text="计划暂无参训人员"
              />
            </section>
          </template>
          <template #attachmentUrls>
            <ArtUploadFile
              v-model="form.attachmentUrls"
              multiple
              :limit="8"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,image/*"
              tip="培训课件、考卷、成绩单等归档材料"
            />
          </template>
          <template #signInAttachmentUrls>
            <ArtUploadFile
              v-model="form.signInAttachmentUrls"
              multiple
              :limit="8"
              accept=".pdf,.xls,.xlsx,image/*"
              tip="纸质签到表扫描件、现场签到照片等佐证材料"
            />
          </template>
        </ArtForm>
      </template>
    </div>

    <template #footer="{ api }">
      <div class="training-record-dialog__footer">
        <span>{{ numberDescription }}</span>
        <div>
          <ElButton @click="api.handleClose()">关闭</ElButton>
          <template v-if="!readonly">
            <ElButton :loading="submitting" @click="handleSave(false)">保存草稿</ElButton>
            <ElButton
              v-auth="'SmisSafetyTrainingRecord:Submit'"
              type="primary"
              :loading="submitting"
              @click="handleSave(true)"
              >确认归档</ElButton
            >
          </template>
        </div>
      </div>
    </template>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { resolveHttpUrl } from '@/utils/http-url'
  import { getAttachmentNameFromUrl } from '@/utils/file/attachment'
  import { toDictionaryOption } from '@/utils/form/option'

  import { replaceReactiveModel } from '@/utils/form/model'
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { normalizeNullableText } from '@/utils/form/normalize'
  import dayjs from 'dayjs'
  import {
    ElDatePicker,
    ElInputNumber,
    ElOption,
    ElSelect,
    ElMessage,
    type FormRules
  } from 'element-plus'
  import type { ColumnOption } from '@/types'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtTable, { type ArtTableExpose } from '@/components/core/tables/art-table/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import SmisDataSourceEmptyActions from '@smis/views/components/smis-data-source-empty-actions.vue'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useUserStore } from '@/store/modules/user'
  import {
    saveSafetyTrainingRecord,
    type SmisSafetyTrainingAssessmentResult,
    type SmisSafetyTrainingAttendance,
    type SmisSafetyTrainingAttendanceStatus,
    type SmisSafetyTrainingPlanOption,
    type SmisSafetyTrainingRecord,
    type SmisSafetyTrainingRecordSavePayload,
    type SmisSafetyTrainingSignMethod
  } from '@smis/api'
  import { trainingRecordStatusItem } from './training-record-status'

  export interface TrainingRecordDialogOpenData {
    row?: SmisSafetyTrainingRecord
    planOptions: SmisSafetyTrainingPlanOption[]
    presetPlanId?: string
    readonly?: boolean
  }

  interface FormModel {
    id?: string
    recordNo: string
    status: 'draft' | 'submitted'
    trainingPlanId: string
    actualStartAt: string
    actualEndAt: string
    location: string
    instructorName: string
    lecturerName: string
    trainingContent: string
    trainingHours: number
    effectEvaluation: string
    attachmentUrls: string[]
    signInAttachmentUrls: string[]
    remark: string
    participants: SmisSafetyTrainingAttendance[]
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { confirm } = useArtFeedback()
  const { getDictMap } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<TrainingRecordDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const attendanceTableRef = ref<ArtTableExpose>()
  const planOptions = shallowRef<SmisSafetyTrainingPlanOption[]>([])
  const detailRecord = shallowRef<SmisSafetyTrainingRecord | null>(null)
  const readonly = ref(false)
  const submitting = ref(false)
  const numberRule = useDocumentNumberRule('smis.safety_training_record')
  const numberDescription = numberRule.description

  const initial = (): FormModel => ({
    id: undefined,
    recordNo: '',
    status: 'draft',
    trainingPlanId: '',
    actualStartAt: '',
    actualEndAt: '',
    location: '',
    instructorName: '',
    lecturerName: '',
    trainingContent: '',
    trainingHours: 0,
    effectEvaluation: '',
    attachmentUrls: [],
    signInAttachmentUrls: [],
    remark: '',
    participants: []
  })
  const form = reactive<FormModel>(initial())
  const selectedPlan = computed(() =>
    planOptions.value.find((item) => item.id === form.trainingPlanId)
  )
  const presentCount = computed(
    () => form.participants.filter((item) => item.attendanceStatus === 'present').length
  )
  const passCount = computed(
    () => form.participants.filter((item) => item.assessmentResult === 'pass').length
  )
  const averageScoreText = computed(() => {
    const scores = form.participants
      .map((item) => item.score)
      .filter((score): score is number => typeof score === 'number')
    if (!scores.length) return '—'
    return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(1)
  })
  const attendanceRateText = computed(() => {
    if (!form.participants.length) return '0%'
    return `${Math.round((presentCount.value / form.participants.length) * 100)}%`
  })
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const attendanceOptions = computed(() => dictOptions('smisSafetyTrainingAttendanceStatus'))
  const signMethodOptions = computed(() => dictOptions('smisSafetyTrainingSignMethod'))
  const assessmentResultOptions = computed(() => dictOptions('smisSafetyTrainingAssessmentResult'))
  const detailItems: ArtDescriptionItem<SmisSafetyTrainingRecord>[] = [
    { key: 'recordNo', label: '培训记录单号', field: 'recordNo', copyable: true },
    { key: 'planNo', label: '培训计划编号', field: 'planNo', copyable: true },
    {
      key: 'trainingCategory',
      label: '培训类别',
      field: 'trainingCategory',
      dictCode: 'smisSafetyTrainingCategory',
      dictDisplay: 'tag'
    },
    {
      key: 'trainingType',
      label: '培训类型',
      field: 'trainingType',
      dictCode: 'smisSafetyTrainingType'
    },
    {
      key: 'trainingForm',
      label: '培训形式',
      field: 'trainingForm',
      dictCode: 'smisSafetyTrainingForm'
    },
    {
      key: 'trainingLevel',
      label: '培训级别',
      field: 'trainingLevel',
      dictCode: 'smisSafetyTrainingLevel'
    },
    { key: 'organizer', label: '组织单位', field: 'organizerOrganizationName' },
    {
      key: 'targetOrganization',
      label: '覆盖组织',
      field: 'targetOrganizationName'
    },
    { key: 'location', label: '培训地点', field: 'location' },
    {
      key: 'actualPeriod',
      label: '实际培训时间',
      value: (data: SmisSafetyTrainingRecord) =>
        formatDateRange(data.actualStartAt, data.actualEndAt),
      span: 2
    },
    {
      key: 'trainingHours',
      label: '实际学时',
      value: (data: SmisSafetyTrainingRecord) => `${data.trainingHours} 学时`
    },
    { key: 'instructorName', label: '培训讲师', field: 'instructorName' },
    { key: 'lecturerName', label: '授课人', field: 'lecturerName' },
    {
      key: 'assessmentMethod',
      label: '考核方式',
      field: 'assessmentMethod',
      dictCode: 'smisSafetyTrainingAssessmentMethod'
    },
    {
      key: 'submittedAt',
      label: '归档时间',
      value: (data: SmisSafetyTrainingRecord) => formatDateTime(data.submittedAt)
    }
  ]
  const detailAttendanceColumns = computed<ColumnOption<SmisSafetyTrainingAttendance>[]>(() => [
    { type: 'globalIndex', label: '序号', width: 64, align: 'center' },
    {
      prop: 'employeeName',
      label: '参训人员',
      minWidth: 170,
      formatter: (row) => (
        <div class="training-record-dialog__person">
          <strong>{row.employeeName}</strong>
          <small>工号：{row.employeeNo}</small>
        </div>
      )
    },
    {
      prop: 'organizationName',
      label: '组织与岗位',
      minWidth: 190,
      formatter: (row) => (
        <div class="training-record-dialog__person">
          <strong>{row.organizationName || '未分配组织'}</strong>
          <small>{row.jobTitle || '未维护岗位'}</small>
        </div>
      )
    },
    {
      prop: 'attendanceStatus',
      label: '签到情况',
      minWidth: 220,
      formatter: (row) => (
        <div class="training-record-dialog__detail-stack">
          <ArtDictDisplay
            dictCode="smisSafetyTrainingAttendanceStatus"
            value={row.attendanceStatus}
            display="tag"
          />
          <small>{row.checkInAt ? formatDateTime(row.checkInAt) : '无签到时间'}</small>
          <small>
            方式：
            <ArtDictDisplay
              dictCode="smisSafetyTrainingSignMethod"
              value={row.signMethod}
              display="text"
            />
          </small>
        </div>
      )
    },
    {
      prop: 'assessmentResult',
      label: '考核情况',
      minWidth: 150,
      formatter: (row) => (
        <div class="training-record-dialog__detail-stack">
          <ArtDictDisplay
            dictCode="smisSafetyTrainingAssessmentResult"
            value={row.assessmentResult}
            display="tag"
          />
          <small>成绩：{typeof row.score === 'number' ? row.score.toFixed(1) : '—'}</small>
        </div>
      )
    },
    {
      prop: 'remark',
      label: '人员备注',
      minWidth: 150,
      formatter: (row) => <span class="training-record-dialog__cell-text">{row.remark || '—'}</span>
    }
  ])
  const attendanceColumns = computed<ColumnOption<SmisSafetyTrainingAttendance>[]>(() => [
    { type: 'globalIndex', label: '序号', width: 64, align: 'center' },
    {
      prop: 'employeeName',
      label: '参训人员',
      minWidth: 230,
      formatter: (row) => (
        <div class="training-record-dialog__person">
          <strong>{row.employeeName}</strong>
          <small>工号：{row.employeeNo}</small>
          <small>{row.organizationName || '未分配组织'}</small>
          <small>岗位：{row.jobTitle || '未维护岗位'}</small>
        </div>
      )
    },
    {
      prop: 'attendanceStatus',
      label: '签到信息',
      minWidth: 340,
      required: true,
      requiredMessage: ({ rowIndex }) => `第 ${rowIndex + 1} 行参训人员尚未完成签到状态`,
      rules: [
        {
          validator: ({ value }) => value !== 'pending',
          message: ({ rowIndex }) => `第 ${rowIndex + 1} 行参训人员尚未完成签到状态`
        }
      ],
      formatter: (row) => (
        <div class="training-record-dialog__field-stack">
          <label class="training-record-dialog__inline-field">
            <small>状态</small>
            <ElSelect v-model={row.attendanceStatus} onChange={() => updateAttendance(row)}>
              {attendanceOptions.value.map((item) => (
                <ElOption key={item.value} label={item.label} value={item.value} />
              ))}
            </ElSelect>
          </label>
          <label class="training-record-dialog__inline-field">
            <small>时间</small>
            <ElDatePicker
              v-model={row.checkInAt}
              disabled={row.attendanceStatus !== 'present'}
              type="datetime"
              valueFormat="YYYY-MM-DD HH:mm:ss"
              class="!w-full"
              placeholder="请选择签到时间"
            />
          </label>
          <label class="training-record-dialog__inline-field">
            <small>方式</small>
            <ElSelect
              v-model={row.signMethod}
              disabled={row.attendanceStatus !== 'present'}
              clearable
              placeholder="请选择签到方式"
            >
              {signMethodOptions.value.map((item) => (
                <ElOption key={item.value} label={item.label} value={item.value} />
              ))}
            </ElSelect>
          </label>
        </div>
      )
    },
    {
      prop: 'assessmentResult',
      label: '考核情况',
      minWidth: 280,
      formatter: (row) => (
        <div class="training-record-dialog__assessment-fields">
          <label class="training-record-dialog__inline-field">
            <small>成绩</small>
            <ElInputNumber
              v-model={row.score}
              min={0}
              max={100}
              precision={1}
              controlsPosition="right"
              class="!w-full"
              placeholder="请输入成绩"
            />
          </label>
          <label class="training-record-dialog__inline-field">
            <small>结果</small>
            <ElSelect v-model={row.assessmentResult} placeholder="请选择考核结果">
              {assessmentResultOptions.value.map((item) => (
                <ElOption key={item.value} label={item.label} value={item.value} />
              ))}
            </ElSelect>
          </label>
        </div>
      )
    }
  ])
  const formatRange = (start: string, end: string) =>
    `${dayjs(start).format('MM-DD HH:mm')} 至 ${dayjs(end).format('MM-DD HH:mm')}`
  const formatDateTime = createDateTimeFormatter({ format: 'YYYY-MM-DD HH:mm', emptyText: '—' })
  const formatDateRange = (start?: string | null, end?: string | null): string => {
    if (!start && !end) return '—'
    if (!start) return `截至 ${formatDateTime(end)}`
    if (!end) return `${formatDateTime(start)} 起`
    return `${formatDateTime(start)} 至 ${formatDateTime(end)}`
  }
  const safeAttachmentUrl = (value: string): string =>
    resolveHttpUrl(value, window.location.origin) ?? '#'
  const textArea = (placeholder: string, rows = 3, maxlength = 2000) => ({
    rows,
    maxlength,
    showWordLimit: true,
    resize: 'none',
    placeholder
  })
  const items = computed<FormItem[]>(() => [
    { label: '计划来源', key: 'sourceSection', type: 'divider', span: 24 },
    { label: '关联培训计划', key: 'trainingPlanId', span: 24 },
    { label: '计划自动带入信息', key: 'planContext', span: 24 },
    { label: '实际执行', key: 'executionSection', type: 'divider', span: 24 },
    {
      label: '实际开始时间',
      key: 'actualStartAt',
      type: 'date',
      props: { type: 'datetime', valueFormat: 'YYYY-MM-DD HH:mm:ss', class: '!w-full' }
    },
    {
      label: '实际结束时间',
      key: 'actualEndAt',
      type: 'date',
      props: { type: 'datetime', valueFormat: 'YYYY-MM-DD HH:mm:ss', class: '!w-full' }
    },
    { label: '培训地点', key: 'location', type: 'input', props: { maxlength: 200 } },
    { label: '培训讲师', key: 'instructorName', type: 'input', props: { maxlength: 100 } },
    { label: '授课人', key: 'lecturerName', type: 'input', props: { maxlength: 100 } },
    {
      label: '实际学时',
      key: 'trainingHours',
      type: 'inputNumber',
      props: { min: 0, max: 9999, precision: 1, class: '!w-full' }
    },
    {
      label: '培训内容',
      key: 'trainingContent',
      type: 'textarea',
      span: 24,
      props: textArea('记录实际培训内容', 4, 4000)
    },
    {
      label: '培训效果评价',
      key: 'effectEvaluation',
      type: 'textarea',
      span: 24,
      props: textArea('记录培训效果、考核情况及改进建议', 4, 3000)
    },
    { label: '人员签到与考核', key: 'attendanceSection', type: 'divider', span: 24 },
    { label: '签到明细', key: 'participants', span: 24 },
    { label: '归档材料', key: 'evidenceSection', type: 'divider', span: 24 },
    { label: '培训附件', key: 'attachmentUrls', span: 24 },
    { label: '签到附件', key: 'signInAttachmentUrls', span: 24 },
    {
      label: '备注',
      key: 'remark',
      type: 'textarea',
      span: 24,
      props: textArea('补充其他需要归档的信息', 2, 1000)
    }
  ])
  const rules: FormRules<FormModel> = {
    trainingPlanId: [{ required: true, message: '请选择关联培训计划', trigger: 'change' }]
  }

  const participantFromPlan = (
    item: SmisSafetyTrainingPlanOption['participants'][number]
  ): SmisSafetyTrainingAttendance => ({
    ...item,
    attendanceStatus: 'pending',
    checkInAt: null,
    signMethod: null,
    score: null,
    assessmentResult: 'not_assessed',
    remark: null
  })
  const applyPlan = (id: string): void => {
    const plan = planOptions.value.find((item) => item.id === id)
    if (!plan) return
    form.actualStartAt = dayjs(plan.plannedStartAt).format('YYYY-MM-DD HH:mm:ss')
    form.actualEndAt = dayjs(plan.plannedEndAt).format('YYYY-MM-DD HH:mm:ss')
    form.location = plan.location || ''
    form.instructorName = plan.instructorName || ''
    form.trainingContent = plan.content
    form.trainingHours = Number(plan.trainingHours || 0)
    form.participants = plan.participants.map(participantFromPlan)
  }
  const updateAttendance = (row: SmisSafetyTrainingAttendance): void => {
    if (row.attendanceStatus === 'present') {
      row.checkInAt ||= dayjs().format('YYYY-MM-DD HH:mm:ss')
      row.signMethod ||= 'manual'
    } else {
      row.checkInAt = null
      row.signMethod = null
    }
  }
  const markAllPresent = (): void =>
    form.participants.forEach((row) => {
      row.attendanceStatus = 'present'
      updateAttendance(row)
    })
  const payload = (): SmisSafetyTrainingRecordSavePayload => ({
    id: form.id,
    trainingPlanId: form.trainingPlanId,
    actualStartAt: form.actualStartAt ? dayjs(form.actualStartAt).toISOString() : null,
    actualEndAt: form.actualEndAt ? dayjs(form.actualEndAt).toISOString() : null,
    location: normalizeNullableText(form.location),
    instructorName: normalizeNullableText(form.instructorName),
    lecturerName: normalizeNullableText(form.lecturerName),
    trainingContent: normalizeNullableText(form.trainingContent),
    trainingHours: Number(form.trainingHours || 0),
    effectEvaluation: normalizeNullableText(form.effectEvaluation),
    attachmentUrls: [...form.attachmentUrls],
    signInAttachmentUrls: [...form.signInAttachmentUrls],
    remark: normalizeNullableText(form.remark),
    participants: form.participants.map((item) => ({
      employeeId: item.employeeId,
      attendanceStatus: item.attendanceStatus as SmisSafetyTrainingAttendanceStatus,
      checkInAt: item.checkInAt ? dayjs(item.checkInAt).toISOString() : null,
      signMethod: item.signMethod as SmisSafetyTrainingSignMethod | null,
      score: item.score,
      assessmentResult: item.assessmentResult as SmisSafetyTrainingAssessmentResult,
      remark: item.remark
    }))
  })
  const handleSave = async (submit: boolean): Promise<void> => {
    if (submitting.value) return
    try {
      await formRef.value?.validate()
      if (
        form.actualStartAt &&
        form.actualEndAt &&
        dayjs(form.actualEndAt).isBefore(dayjs(form.actualStartAt))
      ) {
        ElMessage.warning('实际结束时间不能早于开始时间')
        return
      }
      if (submit) {
        const attendanceValidation = await attendanceTableRef.value?.validate()
        if (attendanceValidation && !attendanceValidation.valid) {
          return
        }
      }
      if (submit) {
        await confirm('归档后记录将锁定，不能再编辑签到、成绩和归档材料。请确认内容已核对完整。', {
          title: '确认归档培训记录',
          confirmButtonText: '确认归档'
        })
      }
      submitting.value = true
      const type = form.id ? 'edit' : 'add'
      await saveSafetyTrainingRecord(payload(), submit)
      emit('success', type)
      await dialogRef.value?.handleClose(true)
    } catch {
      // 表单校验或 API 层已提供明确反馈。
    } finally {
      submitting.value = false
    }
  }
  const initialize = (data: TrainingRecordDialogOpenData): void => {
    Object.assign(form, initial())
    readonly.value = Boolean(data.readonly)
    detailRecord.value = data.readonly && data.row ? data.row : null
    planOptions.value = data.planOptions
    if (data.row) {
      const row = data.row
      Object.assign(form, {
        id: row.id,
        recordNo: row.recordNo,
        status: row.status,
        trainingPlanId: row.trainingPlanId,
        actualStartAt: row.actualStartAt
          ? dayjs(row.actualStartAt).format('YYYY-MM-DD HH:mm:ss')
          : '',
        actualEndAt: row.actualEndAt ? dayjs(row.actualEndAt).format('YYYY-MM-DD HH:mm:ss') : '',
        location: row.location || '',
        instructorName: row.instructorName || '',
        lecturerName: row.lecturerName || '',
        trainingContent: row.trainingContent || '',
        trainingHours: Number(row.trainingHours || 0),
        effectEvaluation: row.effectEvaluation || '',
        attachmentUrls: [...row.attachmentUrls],
        signInAttachmentUrls: [...row.signInAttachmentUrls],
        remark: row.remark || '',
        participants: row.participants.map((item) => ({ ...item }))
      })
    } else if (data.presetPlanId) {
      form.trainingPlanId = data.presetPlanId
      applyPlan(data.presetPlanId)
    }
  }
  const handleOpen = async (data: TrainingRecordDialogOpenData): Promise<void> => {
    attendanceTableRef.value?.clearValidate()
    initialize(data)
    await dialogRef.value?.handleOpen(data, {
      title: data.readonly ? '查看培训记录与签到' : data.row ? '编辑培训记录' : '新增培训记录',
      subtitle: '关联培训计划，记录实际执行、逐人签到、考核结果与归档证据',
      contentMaxHeight: 'calc(100vh - 140px)',
      onOpen: async () => {
        await Promise.all([
          numberRule.loadRule(),
          ...[
            'smisSafetyTrainingAttendanceStatus',
            'smisSafetyTrainingSignMethod',
            'smisSafetyTrainingAssessmentResult',
            'commonDraftSubmittedStatus',
            'smisSafetyTrainingCategory',
            'smisSafetyTrainingType',
            'smisSafetyTrainingForm',
            'smisSafetyTrainingLevel',
            'smisSafetyTrainingAssessmentMethod'
          ].map((code) => userStore.ensureDictLoaded(code))
        ])
      }
    })
    await nextTick()
    formRef.value?.clearValidate()
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .training-record-dialog {
    display: grid;
    gap: var(--art-space-5);

    &__context {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr) auto;
      gap: var(--art-space-3);
      align-items: center;
      padding: var(--art-space-4);
      background: var(--el-fill-color-lighter);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);

      > span {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        color: var(--theme-color);
        background: var(--el-bg-color);
        border-radius: var(--el-border-radius-base);
      }

      p {
        margin: 3px 0 0;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    &__detail {
      display: grid;
      gap: var(--art-space-4);
    }

    &__detail-hero {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr) auto;
      gap: var(--art-space-4);
      align-items: center;
      padding: var(--art-space-5);
      background: color-mix(in srgb, var(--theme-color) 6%, var(--default-box-color));
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-base);
    }

    &__detail-hero > span {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      font-size: 24px;
      color: var(--theme-color);
      background: var(--default-box-color);
      border-radius: var(--el-border-radius-base);
      box-shadow: var(--el-box-shadow-lighter);
    }

    &__detail-hero > div {
      min-width: 0;
    }

    &__detail-hero small {
      color: var(--theme-color);
    }

    &__detail-hero h3 {
      margin: var(--art-space-1) 0;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 20px;
      line-height: 1.4;
      color: var(--el-text-color-primary);
      white-space: nowrap;
    }

    &__detail-hero p {
      margin: 0;
      color: var(--el-text-color-secondary);
      overflow-wrap: anywhere;
    }

    &__metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--art-space-3);
    }

    &__metrics > article {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr);
      gap: var(--art-space-3);
      align-items: center;
      min-width: 0;
      padding: var(--art-space-4);
      background: var(--default-box-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__metrics > article > span {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      font-size: 18px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 10%, transparent);
      border-radius: var(--el-border-radius-base);
    }

    &__metrics > article > div {
      min-width: 0;
    }

    &__metrics small {
      display: block;
      margin-bottom: 2px;
      color: var(--el-text-color-secondary);
    }

    &__metrics strong {
      font-size: 20px;
      line-height: 1.2;
      color: var(--el-text-color-primary);
    }

    &__metrics em {
      margin-left: var(--art-space-1);
      font-size: 12px;
      font-style: normal;
      color: var(--el-text-color-secondary);
    }

    &__narratives {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--art-space-3);
    }

    &__narratives > article {
      min-width: 0;
      padding: var(--art-space-4);
      background: var(--el-fill-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__narratives > article:last-child:nth-child(odd) {
      grid-column: 1 / -1;
    }

    &__narratives small {
      font-weight: 600;
      color: var(--el-text-color-secondary);
    }

    &__narratives p {
      margin: var(--art-space-2) 0 0;
      line-height: 1.75;
      color: var(--el-text-color-regular);
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    :deep(.training-record-dialog__detail-stack) {
      display: grid;
      gap: var(--art-space-2);
      justify-items: start;
      min-width: 0;
      line-height: 1.4;
    }

    :deep(.training-record-dialog__detail-stack small),
    :deep(.training-record-dialog__cell-text) {
      color: var(--el-text-color-secondary);
      overflow-wrap: anywhere;
      white-space: normal;
    }

    &__evidence-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--art-space-4);
    }

    &__evidence-grid > section {
      min-width: 0;
      padding: var(--art-space-4);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__files {
      display: grid;
      gap: var(--art-space-2);
      margin-top: var(--art-space-3);
    }

    &__files a {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: var(--art-space-2);
      align-items: center;
      min-height: 42px;
      padding: var(--art-space-2) var(--art-space-3);
      color: var(--el-text-color-regular);
      background: var(--el-fill-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__files a:hover,
    &__files a:focus-visible {
      color: var(--theme-color);
      outline: 2px solid color-mix(in srgb, var(--theme-color) 45%, transparent);
      outline-offset: 2px;
    }

    &__files a span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__detail :deep(.el-table__cell) {
      padding-top: var(--art-space-3);
      padding-bottom: var(--art-space-3);
    }

    &__detail :deep(.el-table__body .cell) {
      overflow: visible;
    }

    &__plan-context {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--art-space-3);
      padding: var(--art-space-4);
      background: var(--el-fill-color-lighter);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__plan-context > div {
      display: grid;
      gap: var(--art-space-2);
      min-width: 0;
    }

    &__plan-context small {
      color: var(--el-text-color-secondary);
    }

    &__plan-context strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.training-record-dialog__person),
    :deep(.training-record-dialog__field-stack),
    :deep(.training-record-dialog__assessment-fields) {
      display: grid;
      gap: var(--art-space-2);
      min-width: 0;
    }

    :deep(.training-record-dialog__person strong),
    :deep(.training-record-dialog__person small) {
      line-height: 1.45;
      overflow-wrap: anywhere;
      white-space: normal;
    }

    :deep(.training-record-dialog__person small),
    :deep(.training-record-dialog__inline-field > small) {
      color: var(--el-text-color-secondary);
    }

    :deep(.training-record-dialog__inline-field) {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr);
      gap: var(--art-space-2);
      align-items: center;
      min-width: 0;
    }

    :deep(.training-record-dialog__inline-field > small) {
      font-size: 12px;
      text-align: right;
    }

    &__attendance {
      overflow: hidden;
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__attendance > header {
      display: flex;
      gap: var(--art-space-3);
      align-items: center;
      justify-content: space-between;
      padding: var(--art-space-3) var(--art-space-4);
      background: var(--el-fill-color-lighter);
    }

    &__attendance > header span {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__attendance :deep(.el-table__cell) {
      padding-top: var(--art-space-3);
      padding-bottom: var(--art-space-3);
    }

    &__attendance :deep(.el-table__body .cell) {
      overflow: visible;
    }

    &__footer {
      display: flex;
      gap: var(--art-space-4);
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    &__footer > span {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__footer > div {
      display: flex;
      gap: var(--art-space-2);
    }

    @media (width <= 900px) {
      &__metrics,
      &__evidence-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      &__plan-context {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      &__footer {
        flex-direction: column;
        align-items: flex-end;
      }

      &__narratives {
        grid-template-columns: 1fr;
      }

      &__narratives > article:last-child:nth-child(odd) {
        grid-column: auto;
      }
    }

    @media (width <= 640px) {
      &__detail-hero {
        grid-template-columns: 48px minmax(0, 1fr);
      }

      &__detail-hero > span {
        width: 48px;
        height: 48px;
      }

      &__detail-hero > .art-dict-display {
        grid-column: 1 / -1;
      }

      &__detail-hero h3 {
        white-space: normal;
      }

      &__metrics,
      &__evidence-grid {
        grid-template-columns: 1fr;
      }
    }
  }
</style>
