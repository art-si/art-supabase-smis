<template>
  <ArtPermissionGuard permission="SmisCourseManagement:View">
    <div class="course-page business-workspace-page art-full-height min-w-0 gap-3">
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="LEARNING OPERATIONS"
        title="课程管理"
        description="将课程资源、学习任务、进度与关联考试组织成可追踪的培训闭环。"
        icon="ri:graduation-cap-line"
        :tags="[
          { label: '员工定向分配', type: 'primary', effect: 'plain' },
          { label: '学习进度留痕', type: 'success', effect: 'plain' },
          { label: '课程关联考试', type: 'warning', effect: 'light' }
        ]"
        :metrics="metrics"
      >
        <template #actions
          ><BusinessTableWorkspaceActions
            :table="activeTab === 'course' ? courseTableRef : recordTableRef"
        /></template>
      </BusinessWorkspaceHeader>

      <div class="course-page__body art-card-xs flex min-h-0 flex-1 flex-col px-[14px] pb-[14px]">
        <ElTabs v-model="activeTab" class="course-page__tabs">
          <ElTabPane label="课程库" name="course" />
          <ElTabPane
            v-if="hasAuth('SmisCourseManagement:ViewLearningRecord')"
            label="学习记录"
            name="record"
          />
        </ElTabs>
        <ArtTableQuery
          v-show="activeTab === 'course'"
          ref="courseTableRef"
          v-model="courseQuery"
          class="course-page__table min-h-0 min-w-0 flex-1"
          :api-fn="fetchCourses"
          :search-items="courseSearchItems"
          :columns-factory="courseColumns"
          :header-actions="courseActions"
          header-actions-placement="workspace"
          :search-bar-props="{ span: 8, labelWidth: 72 }"
          :table-props="{
            rowKey: 'id',
            tableLayout: 'fixed',
            emptyText: '暂无课程',
            emptyDescription: '新增课程、分配学习人员并发布后即可开始学习。'
          }"
          focus-scope-selector=".course-page__body"
          focusable
        />
        <ArtTableQuery
          v-if="hasAuth('SmisCourseManagement:ViewLearningRecord')"
          v-show="activeTab === 'record'"
          ref="recordTableRef"
          v-model="recordQuery"
          class="course-page__table min-h-0 min-w-0 flex-1"
          :api-fn="fetchRecords"
          :search-items="recordSearchItems"
          :columns-factory="recordColumns"
          :header-actions="recordActions"
          header-actions-placement="workspace"
          :search-bar-props="{ span: 8, labelWidth: 72 }"
          :table-props="{
            rowKey: 'id',
            tableLayout: 'fixed',
            emptyText: '暂无学习记录',
            emptyDescription: '课程分配给员工后，学习任务会自动出现在这里。'
          }"
          focus-scope-selector=".course-page__body"
          focusable
        />
      </div>

      <ArtDialog
        @open="
          () => {
            activeFormTab = 'basicSection'
          }
        "
        ref="courseDialogRef"
        size="xl"
      >
        <ArtForm
          v-model:active-tab="activeFormTab"
          ref="courseFormRef"
          v-model="courseForm"
          :items="courseItems"
          :rules="courseRules"
          :span="12"
          :gutter="24"
          label-position="top"
          ><template #assignmentNotice
            ><ElAlert
              title="当前账号可维护课程内容，但没有分配学习人员的权限。"
              type="info"
              :closable="false"
              show-icon
          /></template>
        </ArtForm>
        <template #footer="{ api }"
          ><ElButton @click="api.handleClose()">取消</ElButton
          ><ElButton type="primary" :loading="submitting" @click="submitCourse"
            >保存课程</ElButton
          ></template
        >
      </ArtDialog>

      <ArtDialog ref="learningDialogRef" size="lg">
        <div v-if="learningCourse" class="grid gap-4">
          <div class="course-page__learning-cover"
            ><ElImage
              v-if="learningCourse.coverUrl"
              :src="learningCourse.coverUrl"
              fit="cover" /><ArtSvgIcon v-else icon="ri:book-open-line"
          /></div>
          <div class="course-page__learning-summary"
            ><ArtDictDisplay
              dict-code="smisCourseType"
              :value="learningCourse.courseType"
              display="tag"
            />
            <h3>{{ learningCourse.courseName }}</h3
            ><p>{{ learningCourse.introduction || '暂无课程简介' }}</p
            ><div
              ><span>最低学习 {{ learningCourse.minimumLearningMinutes }} 分钟</span
              ><span>{{ learningCourse.creditHours }} 学时</span
              ><span v-if="learningCourse.dueDate">截止 {{ learningCourse.dueDate }}</span></div
            ></div
          >
          <ElProgress :percentage="learningProgress" :stroke-width="12" />
          <ElAlert
            title="学习时长和进度由服务端递增记录，不能倒退；达到最低时长后方可完成。"
            type="info"
            :closable="false"
            show-icon
          />
          <ElButton v-if="learningCourse.resourceUrl" type="primary" plain @click="openResource"
            ><ArtSvgIcon icon="ri:external-link-line" />打开课程资源</ElButton
          >
        </div>
        <template #footer="{ api }"
          ><ElButton @click="api.handleClose()">稍后学习</ElButton
          ><ElButton type="primary" :loading="submitting" @click="saveLearning(false)"
            >保存进度</ElButton
          ><ElButton type="success" :loading="submitting" @click="saveLearning(true)"
            >完成学习</ElButton
          ></template
        >
      </ArtDialog>
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { toDictionaryOption } from '@/utils/form/option'

  import type { FormRules } from 'element-plus'
  import { ElProgress } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'

  import { useAuth } from '@/hooks/core/useAuth'
  import { useUserStore } from '@/store/modules/user'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import {
    deleteCourses,
    fetchCourseLearningRecordList,
    fetchCourseList,
    fetchExamPaperList,
    saveCourse,
    transitionCourse,
    updateCourseLearning,
    type SmisCourseLearningOverview,
    type SmisCourseLearningRecord,
    type SmisCourseLearningSearchParams,
    type SmisCourseOverview,
    type SmisCoursePayload,
    type SmisCourseSearchParams,
    type SmisExamPaper,
    type SmisExamPaperSearchParams,
    type SmisLearningCourse
  } from '@smis/api'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard('smis_learning_course', '课程')

  defineOptions({ name: 'SmisCourseManagement' })
  type CourseParams = SmisCourseSearchParams & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  type RecordParams = SmisCourseLearningSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  const userStore = useUserStore()
  const { hasAuth } = useAuth()
  const { getDictMap } = storeToRefs(userStore)
  const activeTab = ref<'course' | 'record'>('course')
  const courseTableRef = ref<ArtTableQueryExpose>()
  const recordTableRef = ref<ArtTableQueryExpose>()
  const activeFormTab = ref('basicSection')
  const courseDialogRef = ref<ArtDialogExpose>()
  const learningDialogRef = ref<ArtDialogExpose>()
  const courseFormRef = ref<InstanceType<typeof ArtForm>>()
  const submitting = ref(false)
  const courseQuery = ref<SmisCourseSearchParams>({})
  const recordQuery = ref<SmisCourseLearningSearchParams>({})
  const courseOverview = reactive<SmisCourseOverview>({
    total: 0,
    draft: 0,
    published: 0,
    learning: 0,
    completed: 0
  })
  const recordOverview = reactive<SmisCourseLearningOverview>({
    total: 0,
    assigned: 0,
    inProgress: 0,
    completed: 0
  })
  const paperOptions = ref<Array<{ label: string; value: string }>>([])
  const employeeSelection = ref<EmployeeIntegrationItem[]>([])
  const learningCourse = ref<SmisLearningCourse>()
  const learningOpenedAt = ref(0)
  const learningProgress = ref(0)
  const createCourse = (): SmisCoursePayload => ({
    courseName: '',
    courseCategory: 'safety_production',
    courseType: 'video',
    resourceUrl: '',
    coverUrl: '',
    introduction: '',
    minimumLearningMinutes: 30,
    creditHours: 1,
    dueDate: null,
    examPaperId: null,
    employeeIds: []
  })
  const courseForm = ref<SmisCoursePayload>(createCourse())
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const exportDictLabel = (code: string, value: unknown) =>
    dictOptions(code).find((item) => item.value === String(value))?.label ?? String(value ?? '')
  const metrics = computed<BusinessWorkspaceMetric[]>(() =>
    activeTab.value === 'course'
      ? [
          {
            label: '课程总数',
            value: courseOverview.total,
            description: '当前租户课程库',
            icon: 'ri:book-shelf-line'
          },
          {
            label: '待发布',
            value: courseOverview.draft,
            description: '可继续完善内容',
            icon: 'ri:draft-line'
          },
          {
            label: '已发布',
            value: courseOverview.published,
            description: '员工可开始学习',
            icon: 'ri:send-plane-line',
            tone: 'success'
          },
          {
            label: '完成学习',
            value: courseOverview.completed,
            description: '当前账号完成任务',
            icon: 'ri:verified-badge-line',
            tone: 'success'
          }
        ]
      : [
          {
            label: '学习任务',
            value: recordOverview.total,
            description: '已分配员工人次',
            icon: 'ri:user-follow-line'
          },
          {
            label: '待学习',
            value: recordOverview.assigned,
            description: '尚未开始',
            icon: 'ri:time-line'
          },
          {
            label: '学习中',
            value: recordOverview.inProgress,
            description: '已有进度',
            icon: 'ri:progress-3-line',
            tone: 'warning'
          },
          {
            label: '已完成',
            value: recordOverview.completed,
            description: '满足完成要求',
            icon: 'ri:checkbox-circle-line',
            tone: 'success'
          }
        ]
  )
  const courseSearchItems = computed<SearchFormItem[]>(() => [
    {
      label: '课程',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '课程编号或名称' }
    },
    {
      label: '分类',
      key: 'category',
      type: 'select',
      props: {
        options: dictOptions('smisCourseCategory'),
        clearable: true,
        placeholder: '全部分类'
      }
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: {
        options: dictOptions('commonDraftPublishedClosedStatus'),
        clearable: true,
        placeholder: '全部状态'
      }
    }
  ])
  const recordSearchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '课程、员工姓名或工号' }
    },
    {
      label: '学习状态',
      key: 'status',
      type: 'select',
      props: {
        options: dictOptions('smisCourseLearningStatus'),
        clearable: true,
        placeholder: '全部状态'
      }
    }
  ])
  const courseItems = computed<FormItem[]>(() => [
    { label: '课程与考核', key: 'basicSection', type: 'tab', span: 24 },
    {
      label: '课程名称',
      key: 'courseName',
      type: 'input',
      props: { maxlength: 200, showWordLimit: true }
    },
    { label: '课程编号', key: 'courseNo', type: 'input', props: { placeholder: '留空自动生成' } },
    {
      label: '课程分类',
      key: 'courseCategory',
      type: 'select',
      props: { options: dictOptions('smisCourseCategory') }
    },
    {
      label: '课程类型',
      key: 'courseType',
      type: 'radioGroup',
      options: dictOptions('smisCourseType'),
      props: { optionType: 'button' }
    },
    {
      label: '课程资源地址',
      key: 'resourceUrl',
      type: 'input',
      span: 24,
      props: { placeholder: '视频、PDF 或学习链接地址' }
    },
    {
      label: '课程封面',
      key: 'coverUrl',
      span: 24,
      type: 'uploadImage',
      get props(): FormItem['props'] {
        return { title: '上传课程封面', limit: 1, size: 112 }
      }
    },

    {
      label: '最低学习时长（分钟）',
      key: 'minimumLearningMinutes',
      type: 'number',
      props: { min: 0, max: 100000, class: '!w-full' }
    },
    {
      label: '课程学时',
      key: 'creditHours',
      type: 'number',
      props: { min: 0, max: 9999, precision: 1, class: '!w-full' }
    },
    {
      label: '到期日期',
      key: 'dueDate',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', clearable: true, class: '!w-full' }
    },
    {
      label: '关联考试',
      key: 'examPaperId',
      type: 'selectV2',
      props: {
        options: paperOptions.value,
        clearable: true,
        filterable: true,
        placeholder: '可选已创建试卷'
      }
    },
    { label: '说明与学员', key: 'assignmentSection', type: 'tab', span: 24 },
    {
      label: '课程简介',
      key: 'introduction',
      type: 'textarea',
      span: 24,
      props: { rows: 4, maxlength: 8000, showWordLimit: true }
    },
    {
      label: '学习人员',
      key: 'employeeIds',
      span: 24,
      type: 'employeeSelect',
      hidden: !hasAuth('SmisCourseManagement:Assign'),
      description:
        '已选择 ' + courseForm.value.employeeIds.length + ' 人，保存后生成个人学习任务。',
      props: {
        multiple: true,
        modelValues: courseForm.value.employeeIds,
        'onUpdate:modelValues': (value: string[]) => {
          courseForm.value.employeeIds = value
        },
        selectedData: employeeSelection.value,
        'onUpdate:selectedData': (value: EmployeeIntegrationItem[]) => {
          employeeSelection.value = value
        },
        title: '选择学习人员',
        placeholder: '批量选择学习人员'
      }
    },
    {
      key: 'assignmentNotice',
      label: '',
      type: 'custom',
      span: 24,
      hidden: hasAuth('SmisCourseManagement:Assign')
    }
  ])
  const courseRules: FormRules = {
    courseName: [{ required: true, message: '请输入课程名称', trigger: 'blur' }],
    courseCategory: [{ required: true, message: '请选择课程分类', trigger: 'change' }],
    courseType: [{ required: true, message: '请选择课程类型', trigger: 'change' }]
  }
  const openCourse = async (row?: SmisLearningCourse, copy = false) => {
    paperOptions.value = []
    Object.assign(
      courseForm.value,
      createCourse(),
      row
        ? {
            ...row,
            id: copy ? undefined : row.id,
            courseNo: copy ? '' : row.courseNo,
            courseName: copy ? `${row.courseName}（复制）` : row.courseName,
            employeeIds: []
          }
        : {}
    )
    employeeSelection.value = []
    await courseDialogRef.value?.handleOpen(undefined, {
      title: copy ? '复制并新增课程' : row ? '编辑课程' : '新增课程',
      contentMaxHeight: '74vh',
      loading: true,
      loadingText: '正在加载可关联试卷…',
      onOpen: async (_data, api) => {
        try {
          const papers = await loadAllDocumentPages<SmisExamPaper, SmisExamPaperSearchParams>(
            fetchExamPaperList,
            {}
          )
          paperOptions.value = papers.map((paper: SmisExamPaper) => ({
            label: `${paper.paperNo} · ${paper.paperTitle}`,
            value: paper.id
          }))
        } finally {
          api.setLoading(false)
        }
      }
    })
  }
  const submitCourse = async () => {
    try {
      await courseFormRef.value?.validate()
      submitting.value = true
      await saveCourse({ ...courseForm.value })
      await courseDialogRef.value?.handleClose(true)
      await courseTableRef.value?.refreshUpdate()
    } catch {
      /* 保留表单 */
    } finally {
      submitting.value = false
    }
  }
  const removeCourse = async (row: SmisLearningCourse) => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.courseName ?? '课程')
        }
      ],
      permission: 'SmisCourseManagement:Delete',
      confirmMessage: `确定删除草稿课程“${row.courseName}”吗？`,
      remove: async () => {
        await deleteCourses([row.id ?? ''])
      },
      onDeleted: async () => {
        await courseTableRef.value?.refreshRemove()
      }
    })
  }
  const openLearning = async (row: SmisLearningCourse) => {
    if (!row.assignmentId) return
    learningCourse.value = row
    learningProgress.value = Number(row.progressPercent ?? 0)
    learningOpenedAt.value = Date.now()
    await learningDialogRef.value?.handleOpen(undefined, {
      title: row.learningStatus === 'in_progress' ? '继续学习' : '开始学习'
    })
  }
  const openResource = () => {
    if (learningCourse.value?.resourceUrl)
      window.open(learningCourse.value.resourceUrl, '_blank', 'noopener,noreferrer')
  }
  const saveLearning = async (complete: boolean) => {
    const row = learningCourse.value
    if (!row?.assignmentId) return
    try {
      submitting.value = true
      const elapsed = Math.max(Math.floor((Date.now() - learningOpenedAt.value) / 1000), 0)
      await updateCourseLearning(
        row.assignmentId,
        complete ? 100 : Math.max(learningProgress.value, 10),
        elapsed,
        complete
      )
      await learningDialogRef.value?.handleClose(true)
      await Promise.all([
        courseTableRef.value?.refreshUpdate(),
        recordTableRef.value?.refreshUpdate()
      ])
    } finally {
      submitting.value = false
    }
  }
  const courseMore = (row: SmisLearningCourse): ButtonMoreItem[] => [
    {
      auth: 'SmisCourseManagement:Add',
      key: 'copy',
      label: '复制并新增',
      icon: 'ri:file-copy-2-line'
    },
    {
      auth: 'SmisCourseManagement:Publish',
      key: row.status === 'published' ? 'close' : 'publish',
      label: row.status === 'published' ? '关闭课程' : '发布课程',
      icon: row.status === 'published' ? 'ri:stop-circle-line' : 'ri:send-plane-line',
      disabled: row.status === 'closed'
    },
    {
      auth: 'SmisCourseManagement:Learn',
      key: 'learn',
      label: row.learningStatus === 'in_progress' ? '继续学习' : '开始学习',
      icon: 'ri:play-circle-line',
      disabled:
        !row.assignmentId || row.status !== 'published' || row.learningStatus === 'completed'
    },
    {
      auth: 'SmisCourseManagement:Delete',
      key: 'delete',
      label: '删除',
      icon: 'ri:delete-bin-line',
      color: 'var(--el-color-danger)',
      disabled: row.status !== 'draft'
    }
  ]
  const handleCourseMore = async (item: ButtonMoreItem, row: SmisLearningCourse) => {
    if (item.key === 'copy') await openCourse(row, true)
    else if (item.key === 'learn') await openLearning(row)
    else if (item.key === 'delete') await removeCourse(row)
    else {
      await transitionCourse(row.id, item.key as 'publish' | 'close')
      await courseTableRef.value?.refreshUpdate()
    }
  }
  const courseColumns = (): ColumnOption<SmisLearningCourse>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'courseName',
      label: '课程',
      minWidth: 260,
      fixed: 'left',
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.courseName}
          secondary={row.courseNo}
          icon="ri:book-open-line"
        />
      )
    },
    {
      prop: 'courseCategory',
      label: '分类',
      width: 110,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisCourseCategory" value={row.courseCategory} />
      )
    },
    {
      prop: 'courseType',
      label: '类型',
      width: 92,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisCourseType" value={row.courseType} display="tag" />
      )
    },
    {
      prop: 'minimumLearningMinutes',
      label: '最低时长',
      width: 100,
      align: 'center',
      formatter: (row) => `${row.minimumLearningMinutes} 分钟`
    },
    { prop: 'creditHours', label: '学时', width: 72, align: 'center' },
    {
      prop: 'learnerCount',
      label: '学习人数',
      width: 92,
      align: 'center',
      formatter: (row) => `${row.completedCount}/${row.learnerCount}`
    },
    {
      prop: 'dueDate',
      label: '到期日期',
      width: 112,
      formatter: (row) => row.dueDate || '长期有效'
    },
    {
      prop: 'status',
      label: '状态',
      width: 90,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="commonDraftPublishedClosedStatus"
          value={row.status}
          display="tag"
        />
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 124,
      fixed: 'right',
      formatter: (row) => (
        <div class="flex">
          <ArtButtonTable
            type="edit"
            permission="SmisCourseManagement:Edit"
            disabled={row.status !== 'draft'}
            onClick={() => openCourse(row)}
          />
          <ArtButtonMore
            list={courseMore(row)}
            onClick={(item: ButtonMoreItem) => handleCourseMore(item, row)}
          />
        </div>
      )
    }
  ]
  const recordColumns = (): ColumnOption<SmisCourseLearningRecord>[] => [
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'courseName',
      label: '课程',
      minWidth: 230,
      fixed: 'left',
      formatter: (row) => (
        <div>
          <strong>{row.courseName}</strong>
          <div class="text-xs text-gray-400">{row.courseNo}</div>
        </div>
      )
    },
    {
      prop: 'employeeName',
      label: '学员',
      width: 130,
      formatter: (row) => (
        <div>
          <strong>{row.employeeName}</strong>
          <div class="text-xs text-gray-400">{row.employeeNo}</div>
        </div>
      )
    },
    {
      prop: 'organizationName',
      label: '部门 / 岗位',
      minWidth: 180,
      formatter: (row) => [row.organizationName, row.jobTitle].filter(Boolean).join(' · ') || '—'
    },
    {
      prop: 'learningStatus',
      label: '学习状态',
      width: 100,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="smisCourseLearningStatus"
          value={row.learningStatus}
          display="tag"
        />
      )
    },
    {
      prop: 'progressPercent',
      label: '学习进度',
      width: 170,
      formatter: (row) => <ElProgress percentage={Number(row.progressPercent)} stroke-width={8} />
    },
    {
      prop: 'totalLearningSeconds',
      label: '累计时长',
      width: 110,
      formatter: (row) => `${Math.floor(row.totalLearningSeconds / 60)} 分钟`
    },
    {
      prop: 'completedAt',
      label: '完成时间',
      width: 168,
      formatter: (row) => row.completedAt || '—'
    }
  ]
  const courseActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisCourseManagement:Add',
      type: 'add',
      label: '新增课程',
      onClick: () => openCourse()
    },
    {
      permission: 'SmisCourseManagement:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 门草稿课程吗？`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.courseName ?? '课程')
          })),
          permission: 'SmisCourseManagement:Delete',
          remove: async () => {
            await deleteCourses(selectedRows.map((row) => row.id as string))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    },
    {
      permission: 'SmisCourseManagement:Export',
      type: 'export',
      label: '导出课程',
      exportFilename: '课程管理',
      exportSheetName: '课程',
      exportColumns: [
        { key: 'courseNo', title: '课程编号' },
        { key: 'courseName', title: '课程名称' },
        {
          key: 'courseCategory',
          title: '课程分类',
          formatter: (value) => exportDictLabel('smisCourseCategory', value)
        },
        {
          key: 'courseType',
          title: '课程类型',
          formatter: (value) => exportDictLabel('smisCourseType', value)
        },
        { key: 'learnerCount', title: '学习人数' },
        {
          key: 'status',
          title: '状态',
          formatter: (value) => exportDictLabel('commonDraftPublishedClosedStatus', value)
        }
      ],
      exportApi: async () => ({
        data: await loadAllDocumentPages<SmisLearningCourse, SmisCourseSearchParams>(
          fetchCourseList,
          { ...courseQuery.value }
        )
      })
    }
  ])
  const recordActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisCourseManagement:Export',
      type: 'export',
      label: '导出学习记录',
      exportFilename: '课程学习记录',
      exportSheetName: '学习记录',
      exportColumns: [
        { key: 'courseName', title: '课程名称' },
        { key: 'employeeName', title: '学员姓名' },
        { key: 'organizationName', title: '所属部门' },
        {
          key: 'learningStatus',
          title: '学习状态',
          formatter: (value) => exportDictLabel('smisCourseLearningStatus', value)
        },
        { key: 'progressPercent', title: '学习进度', formatter: (value) => `${value ?? 0}%` },
        { key: 'totalLearningSeconds', title: '累计学习秒数' },
        { key: 'completedAt', title: '完成时间' }
      ],
      exportApi: async () => ({
        data: await loadAllDocumentPages<SmisCourseLearningRecord, SmisCourseLearningSearchParams>(
          fetchCourseLearningRecordList,
          { ...recordQuery.value }
        )
      })
    }
  ])
  const fetchCourses = async (params: CourseParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const result = await fetchCourseList({ ...params, from, to })
    Object.assign(courseOverview, result.overview)
    return result
  }
  const fetchRecords = async (params: RecordParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const result = await fetchCourseLearningRecordList({ ...params, from, to })
    Object.assign(recordOverview, result.overview)
    return result
  }
  onMounted(async () => {
    await Promise.all(
      [
        'commonDraftPublishedClosedStatus',
        'smisCourseCategory',
        'smisCourseType',
        'smisCourseLearningStatus'
      ].map((code) => userStore.ensureDictLoaded(code))
    )
  })
</script>

<style scoped lang="scss">
  .course-page__tabs {
    flex: none;

    :deep(.el-tabs__header) {
      margin-bottom: 10px;
    }
  }

  .course-page__learning-cover {
    display: grid;
    place-items: center;
    height: 210px;
    overflow: hidden;
    font-size: 64px;
    color: var(--theme-color);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-color) 13%, var(--el-bg-color)),
      var(--el-fill-color-lighter)
    );
    border-radius: var(--custom-radius);

    .el-image {
      width: 100%;
      height: 100%;
    }
  }

  .course-page__learning-summary {
    h3 {
      margin: 10px 0 6px;
      font-size: 20px;
    }

    p {
      color: var(--el-text-color-secondary);
    }

    div {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
  }
</style>
