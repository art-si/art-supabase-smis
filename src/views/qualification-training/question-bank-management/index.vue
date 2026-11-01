<template>
  <ArtPermissionGuard permission="SmisQuestionBankManagement:View">
    <div class="question-bank business-workspace-page art-full-height min-w-0 gap-3">
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="ASSESSMENT CONTENT"
        title="题库管理"
        description="集中维护培训题目、标准答案与解析，为固定组卷和随机组卷提供可信题源。"
        icon="ri:questionnaire-line"
        :tags="[
          { label: '客观题自动评分', type: 'primary', effect: 'plain' },
          { label: '发布试卷使用快照', type: 'success', effect: 'plain' },
          { label: '停用题目保留历史', type: 'warning', effect: 'light' }
        ]"
        :metrics="metrics"
        ><template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template
      ></BusinessWorkspaceHeader>

      <div class="question-bank__workspace min-h-0 flex-1">
        <ArtWorkspaceSplitter
          primary-size="320px"
          primary-min="280px"
          primary-max="420px"
          :breakpoint="900"
          stacked-primary-size="38vh"
        >
          <template #primary>
            <QuestionCategoryNavigator
              :data="categoryTree"
              :loading="categoryLoading"
              :error="categoryError"
              :selected-key="selectedCategoryKey"
              :total-questions="overview.total"
              @select="selectCategory"
              @refresh="refreshCategories"
              @add="openCategory(undefined, $event)"
              @edit="openCategory"
              @delete="removeCategory"
            />
          </template>

          <ArtTableQuery
            ref="tableRef"
            v-model="searchQuery"
            class="question-bank__table min-h-0 min-w-0"
            :api-fn="fetchTableData"
            :search-items="searchItems"
            :columns-factory="columnsFactory"
            :header-actions="headerActions"
            header-actions-placement="workspace"
            :search-bar-props="{ span: 8, labelWidth: 72 }"
            :table-props="{
              rowKey: 'id',
              tableLayout: 'fixed',
              emptyText: searchQuery.categoryId ? '当前分类暂无题目' : '暂无题目',
              emptyDescription: searchQuery.categoryId
                ? '可在当前分类新增题目，或切换左侧分类查看其他内容。'
                : '新增题目后即可用于固定或随机组卷。'
            }"
            focus-scope-selector=".question-bank__workspace"
            focusable
          />
        </ArtWorkspaceSplitter>
      </div>

      <ArtDialog ref="categoryDialogRef" size="sm">
        <ElAlert
          class="mb-[18px]"
          :title="
            categoryForm.id
              ? '调整上级分类会同步改变左侧树位置；停用分类后不再用于新增题目。'
              : '可选择当前分类作为父级，形成清晰的培训主题层级。'
          "
          type="info"
          :closable="false"
          show-icon
        />
        <ArtForm
          ref="categoryFormRef"
          v-model="categoryForm"
          :items="categoryItems"
          :rules="categoryRules"
          :span="24"
          label-position="top"
        />
        <template #footer="{ api }"
          ><ElButton @click="api.handleClose()">取消</ElButton
          ><ElButton type="primary" :loading="submitting" @click="submitCategory"
            >确定</ElButton
          ></template
        >
      </ArtDialog>

      <ArtDialog
        @open="
          () => {
            activeFormTab = 'settingSection'
          }
        "
        ref="questionDialogRef"
        size="xl"
      >
        <ArtForm
          v-model:active-tab="activeFormTab"
          ref="questionFormRef"
          v-model="questionForm"
          :items="questionItems"
          :rules="questionRules"
          :span="12"
          :gutter="24"
          label-position="top"
        >
          <template #options>
            <div class="grid gap-[10px]">
              <div
                v-for="(option, index) in questionForm.options"
                :key="option.key"
                class="question-bank__option"
              >
                <ElCheckbox
                  v-if="questionForm.questionType === 'multiple'"
                  :model-value="questionForm.correctAnswers.includes(option.key)"
                  @change="setCorrect(option.key, Boolean($event))"
                  >正确</ElCheckbox
                >
                <ElRadio v-else v-model="singleAnswer" :value="option.key">正确</ElRadio>
                <ElTag effect="plain">{{ option.key }}</ElTag
                ><ElInput
                  v-model="option.content"
                  :placeholder="`请输入选项 ${option.key}`"
                  maxlength="1000"
                />
                <ArtIconButton
                  v-if="
                    questionForm.questionType !== 'judgement' && questionForm.options.length > 2
                  "
                  class="size-6.5! text-base!"
                  icon="ri:close-line"
                  tone="danger"
                  label="删除选项"
                  @click="removeOption(index)"
                />
              </div>
              <ElButton
                v-if="questionForm.questionType !== 'judgement' && questionForm.options.length < 8"
                plain
                @click="addOption"
                ><ArtSvgIcon icon="ri:add-line" />添加选项</ElButton
              >
            </div>
          </template>
        </ArtForm>
        <template #footer="{ api }"
          ><ElButton @click="api.handleClose()">取消</ElButton
          ><ElButton type="primary" :loading="submitting" @click="submitQuestion"
            >保存题目</ElButton
          ></template
        >
      </ArtDialog>
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
    <MasterDataDeleteGuard ref="deleteCategoryGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { toDictionaryOption } from '@/utils/form/option'

  import { uniq } from 'lodash-es'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import type { FormRules } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import TreeUtils from '@/utils/tree'

  import { useUserStore } from '@/store/modules/user'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import {
    deleteQuestionCategory,
    deleteQuestions,
    fetchQuestionBankList,
    saveQuestion,
    saveQuestionCategory,
    toggleQuestions,
    type SmisQuestion,
    type SmisQuestionBankOverview,
    type SmisQuestionBankSearchParams,
    type SmisQuestionCategory,
    type SmisQuestionPayload
  } from '@smis/api'
  import QuestionCategoryNavigator, {
    type QuestionCategoryTreeNode
  } from './modules/question-category-navigator.vue'

  const { deleteGuardRef: deleteCategoryGuardRef, deleteRecords: deleteCategoryRecords } =
    useRecordDeleteGuard('smis_question_category', '题库分类')

  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard('smis_question', '题目')

  defineOptions({ name: 'SmisQuestionBankManagement' })
  type TableParams = SmisQuestionBankSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const ALL_KEY = 'all'
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const tableRef = ref<ArtTableQueryExpose>()
  const categoryDialogRef = ref<ArtDialogExpose>()
  const activeFormTab = ref('settingSection')
  const questionDialogRef = ref<ArtDialogExpose>()
  const categoryFormRef = ref<InstanceType<typeof ArtForm>>()
  const questionFormRef = ref<InstanceType<typeof ArtForm>>()
  const submitting = ref(false)
  const categoryLoading = ref(true)
  const categoryError = ref<string | null>(null)
  const searchQuery = ref<SmisQuestionBankSearchParams>({})
  const categories = ref<SmisQuestionCategory[]>([])
  const overview = reactive<SmisQuestionBankOverview>({
    total: 0,
    enabled: 0,
    single: 0,
    multiple: 0,
    judgement: 0
  })
  const categoryForm = ref({
    id: '',
    parentId: null as string | null,
    categoryName: '',
    status: 'enabled' as 'enabled' | 'disabled',
    sort: 10,
    remark: ''
  })
  const createQuestion = (): SmisQuestionPayload => ({
    categoryId: '',
    questionType: 'single',
    stem: '',
    options: [
      { key: 'A', content: '' },
      { key: 'B', content: '' }
    ],
    correctAnswers: [],
    analysis: '',
    defaultScore: 2,
    status: 'enabled'
  })
  const questionForm = ref<SmisQuestionPayload>(createQuestion())
  const singleAnswer = computed({
    get: () => questionForm.value.correctAnswers[0] ?? '',
    set: (value: string) => {
      questionForm.value.correctAnswers = value ? [value] : []
    }
  })
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const exportDictLabel = (code: string, value: unknown) =>
    dictOptions(code).find((item) => item.value === String(value))?.label ?? String(value ?? '')
  const categoryTree = computed<QuestionCategoryTreeNode[]>(() =>
    treeUtils.listToTree<QuestionCategoryTreeNode>(categories.value, (left, right) =>
      left.sort === right.sort
        ? left.categoryName.localeCompare(right.categoryName, 'zh-CN')
        : left.sort - right.sort
    )
  )
  const categoryOptions = computed(() =>
    treeUtils.mapTree(categoryTree.value, (item) => ({
      label: item.categoryName,
      value: item.id,
      disabled: item.status !== 'enabled'
    }))
  )
  const categoryParentOptions = computed(() =>
    treeUtils.mapTree(
      treeUtils.removeNode(categoryTree.value, categoryForm.value.id).tree,
      (item) => ({
        label: item.categoryName,
        value: item.id
      })
    )
  )
  const selectedCategoryKey = computed(() => searchQuery.value.categoryId ?? ALL_KEY)
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '题目总数',
      value: overview.total,
      description: '当前租户题库规模',
      icon: 'ri:questionnaire-line'
    },
    {
      label: '已启用',
      value: overview.enabled,
      description: '可用于组卷',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '单选 / 多选',
      value: `${overview.single} / ${overview.multiple}`,
      description: '主要客观题型',
      icon: 'ri:list-check-3'
    },
    {
      label: '判断题',
      value: overview.judgement,
      description: '快速知识校验',
      icon: 'ri:toggle-line'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '题目',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '搜索题干或解析' }
    },
    {
      label: '题型',
      key: 'questionType',
      type: 'select',
      props: { options: dictOptions('smisQuestionType'), clearable: true, placeholder: '全部题型' }
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: {
        options: dictOptions('commonEnabledStatus'),
        clearable: true,
        placeholder: '全部状态'
      }
    }
  ])
  const categoryItems = computed<FormItem[]>(() => [
    {
      label: '分类名称',
      key: 'categoryName',
      type: 'input',
      props: { maxlength: 100, showWordLimit: true }
    },
    {
      label: '上级分类',
      key: 'parentId',
      type: 'treeSelect',
      options: categoryParentOptions.value,
      props: {
        clearable: true,
        filterable: true,
        checkStrictly: true,
        placeholder: '不选择则作为一级分类'
      }
    },
    {
      label: '启用状态',
      key: 'status',
      type: 'segment',
      options: dictOptions('commonEnabledStatus')
    },
    {
      label: '排序',
      key: 'sort',
      type: 'inputNumber',
      props: { min: 0, max: 9999, class: '!w-full' }
    },
    {
      label: '备注',
      key: 'remark',
      type: 'textarea',
      props: { rows: 3, maxlength: 500, showWordLimit: true }
    }
  ])
  const categoryRules: FormRules = {
    categoryName: [{ required: true, message: '请输入分类名称', trigger: 'blur' }]
  }
  const questionItems = computed<FormItem[]>(() => [
    { label: '题目设置', key: 'settingSection', type: 'tab', span: 24 },
    {
      label: '所属分类',
      key: 'categoryId',
      type: 'treeSelect',
      options: categoryOptions.value,
      props: { filterable: true, checkStrictly: true, placeholder: '选择题库分类' }
    },
    {
      label: '题目类型',
      key: 'questionType',
      type: 'radioGroup',
      options: dictOptions('smisQuestionType'),
      props: { optionType: 'button' }
    },
    {
      label: '默认分值',
      key: 'defaultScore',
      type: 'inputNumber',
      props: { min: 0.01, max: 999, precision: 2, class: '!w-full' }
    },
    {
      label: '启用状态',
      key: 'status',
      type: 'segment',
      options: dictOptions('commonEnabledStatus')
    },
    { label: '题目与答案', key: 'contentSection', type: 'tab', span: 24 },
    {
      label: '题目内容',
      key: 'stem',
      type: 'textarea',
      span: 24,
      props: { rows: 5, maxlength: 8000, showWordLimit: true }
    },

    { label: '答案选项与正确答案', key: 'options', span: 24 },
    {
      label: '答案解析',
      key: 'analysis',
      type: 'textarea',
      span: 24,
      props: { rows: 4, maxlength: 8000, showWordLimit: true }
    }
  ])
  const questionRules: FormRules = {
    categoryId: [{ required: true, message: '请选择所属分类', trigger: 'change' }],
    questionType: [{ required: true, message: '请选择题目类型', trigger: 'change' }],
    stem: [{ required: true, message: '请输入题目内容', trigger: 'blur' }]
  }
  watch(
    () => questionForm.value.questionType,
    (type) => {
      if (type === 'judgement') {
        questionForm.value.options = [
          { key: 'A', content: '正确' },
          { key: 'B', content: '错误' }
        ]
        questionForm.value.correctAnswers = []
      }
    }
  )
  const selectCategory = (key: string) => {
    searchQuery.value.categoryId = key === ALL_KEY ? undefined : key
    void tableRef.value?.refreshUpdate()
  }
  const refreshCategories = async () => {
    categoryLoading.value = true
    await tableRef.value?.refreshUpdate()
  }
  const openCategory = async (row?: SmisQuestionCategory, parentId?: string) => {
    Object.assign(categoryForm.value, {
      id: row?.id ?? '',
      parentId: row?.parentId ?? parentId ?? null,
      categoryName: row?.categoryName ?? '',
      status: row?.status ?? 'enabled',
      sort: row?.sort ?? 10,
      remark: row?.remark ?? ''
    })
    await categoryDialogRef.value?.handleOpen(undefined, {
      title: row ? '编辑题库分类' : parentId ? '新增下级分类' : '新增题库分类'
    })
  }
  const submitCategory = async () => {
    try {
      await categoryFormRef.value?.validate()
      submitting.value = true
      await saveQuestionCategory({ ...categoryForm.value, id: categoryForm.value.id || undefined })
      await categoryDialogRef.value?.handleClose(true)
      await tableRef.value?.refreshUpdate()
    } catch {
      /* 保留表单 */
    } finally {
      submitting.value = false
    }
  }
  const removeCategory = async (row: SmisQuestionCategory) => {
    await deleteCategoryRecords({
      resources: [{ id: row.id, label: row.categoryName }],
      permission: 'SmisQuestionBankManagement:ManageCategory',
      remove: () => deleteQuestionCategory(row.id),
      onDeleted: async () => {
        if (searchQuery.value.categoryId === row.id) searchQuery.value.categoryId = undefined
        await tableRef.value?.refreshRemove()
      }
    })
  }
  const openQuestion = async (row?: SmisQuestion, copy = false) => {
    Object.assign(
      questionForm.value,
      createQuestion(),
      row
        ? {
            ...row,
            id: copy ? undefined : row.id,
            stem: copy ? `${row.stem}（复制）` : row.stem,
            options: row.options.map((item) => ({ ...item })),
            correctAnswers: [...row.correctAnswers]
          }
        : {}
    )
    await questionDialogRef.value?.handleOpen(undefined, {
      title: copy ? '复制并新增题目' : row ? '编辑题目' : '新增题目',
      contentMaxHeight: '76vh'
    })
  }
  const addOption = () =>
    questionForm.value.options.push({
      key: String.fromCharCode(65 + questionForm.value.options.length),
      content: ''
    })
  const removeOption = (index: number) => {
    const removed = questionForm.value.options[index]?.key
    questionForm.value.options.splice(index, 1)
    questionForm.value.options.forEach((item, i) => {
      item.key = String.fromCharCode(65 + i)
    })
    questionForm.value.correctAnswers = questionForm.value.correctAnswers.filter(
      (key) => key !== removed
    )
  }
  const setCorrect = (key: string, checked: boolean) => {
    questionForm.value.correctAnswers = checked
      ? uniq([...questionForm.value.correctAnswers, key])
      : questionForm.value.correctAnswers.filter((item) => item !== key)
  }
  const submitQuestion = async () => {
    try {
      await questionFormRef.value?.validate()
      if (questionForm.value.options.some((item) => !item.content.trim())) {
        ElMessage.warning('请完整填写全部答案选项')
        return
      }
      if (!questionForm.value.correctAnswers.length) {
        ElMessage.warning('请至少设置一个正确答案')
        return
      }
      submitting.value = true
      await saveQuestion({
        ...questionForm.value,
        options: questionForm.value.options.map((item) => ({
          ...item,
          content: item.content.trim()
        }))
      })
      await questionDialogRef.value?.handleClose(true)
      await tableRef.value?.refreshUpdate()
    } catch {
      /* 保留表单 */
    } finally {
      submitting.value = false
    }
  }
  const removeQuestion = async (row: SmisQuestion) => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.stem ?? '题目')
        }
      ],
      permission: 'SmisQuestionBankManagement:Delete',
      confirmMessage: '确定删除该题目吗？',
      remove: async () => {
        await deleteQuestions([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableRef.value?.refreshRemove()
      }
    })
  }
  const moreActions = (row: SmisQuestion): ButtonMoreItem[] => [
    {
      auth: 'SmisQuestionBankManagement:Add',
      key: 'copy',
      label: '复制并新增',
      icon: 'ri:file-copy-2-line'
    },
    {
      auth: 'SmisQuestionBankManagement:ToggleStatus',
      key: 'toggle',
      label: row.status === 'enabled' ? '停用题目' : '启用题目',
      icon: 'ri:toggle-line'
    },
    {
      auth: 'SmisQuestionBankManagement:Delete',
      key: 'delete',
      label: '删除',
      icon: 'ri:delete-bin-line',
      color: 'var(--el-color-danger)'
    }
  ]
  const columnsFactory = (): ColumnOption<SmisQuestion>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'stem',
      label: '题目内容',
      minWidth: 360,
      fixed: 'left',
      formatter: (row) => (
        <div class="question-bank__stem">
          <ArtSvgIcon icon="ri:question-answer-line" />
          <span>
            <strong>{row.stem}</strong>
            <small>{row.categoryName}</small>
          </span>
        </div>
      )
    },
    {
      prop: 'questionType',
      label: '题型',
      width: 100,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisQuestionType" value={row.questionType} display="tag" />
      )
    },
    {
      prop: 'defaultScore',
      label: '默认分值',
      width: 92,
      align: 'center',
      formatter: (row) => `${row.defaultScore} 分`
    },
    {
      prop: 'options',
      label: '选项数',
      width: 82,
      align: 'center',
      formatter: (row) => `${row.options.length} 项`
    },
    {
      prop: 'status',
      label: '状态',
      width: 88,
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonEnabledStatus" value={row.status} display="tag" />
      )
    },
    { prop: 'updateTime', label: '最近更新', width: 168 },
    {
      prop: 'operation',
      label: '操作',
      width: 124,
      fixed: 'right',
      formatter: (row) => (
        <div class="flex">
          <ArtButtonTable
            type="edit"
            permission="SmisQuestionBankManagement:Edit"
            onClick={() => openQuestion(row)}
          />
          <ArtButtonMore
            list={moreActions(row)}
            onClick={(item: ButtonMoreItem) =>
              item.key === 'copy'
                ? openQuestion(row, true)
                : item.key === 'toggle'
                  ? toggleQuestions(
                      [row.id ?? ''],
                      row.status === 'enabled' ? 'disabled' : 'enabled'
                    ).then(() => tableRef.value?.refreshUpdate())
                  : removeQuestion(row)
            }
          />
        </div>
      )
    }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisQuestionBankManagement:Add',
      type: 'add',
      label: '新增题目',
      onClick: () => openQuestion()
    },
    {
      permission: 'SmisQuestionBankManagement:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 道题目吗？`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.stem ?? '题目')
          })),
          permission: 'SmisQuestionBankManagement:Delete',
          remove: async () => {
            await deleteQuestions(selectedRows.map((row) => row.id as string))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    },
    {
      permission: 'SmisQuestionBankManagement:Export',
      type: 'export',
      label: '导出题库',
      exportFilename: '安全培训题库',
      exportSheetName: '题目',
      exportColumns: [
        { key: 'categoryName', title: '题库分类' },
        {
          key: 'questionType',
          title: '题型',
          formatter: (value) => exportDictLabel('smisQuestionType', value)
        },
        { key: 'stem', title: '题目' },
        { key: 'defaultScore', title: '默认分值' },
        {
          key: 'status',
          title: '状态',
          formatter: (value) => exportDictLabel('commonEnabledStatus', value)
        }
      ],
      exportApi: async () => ({
        data: await loadAllDocumentPages<SmisQuestion, SmisQuestionBankSearchParams>(
          fetchQuestionBankList,
          { ...searchQuery.value }
        )
      })
    }
  ])
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    categoryLoading.value = true
    categoryError.value = null
    try {
      const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
      const result = await fetchQuestionBankList(
        { ...params, from, to },
        { showErrorMessage: false }
      )
      if (options?.signal?.aborted) return result
      if (result.error) {
        throw new Error('题库加载失败，请重新加载', { cause: result.error })
      }
      categories.value = result.categories
      Object.assign(overview, result.overview)
      return result
    } catch (error) {
      if (!options?.signal?.aborted) categoryError.value = '分类加载失败，请重新加载。'
      throw error
    } finally {
      if (!options?.signal?.aborted) categoryLoading.value = false
    }
  }
  onMounted(async () => {
    await Promise.all(
      ['smisQuestionType', 'commonEnabledStatus'].map((code) => userStore.ensureDictLoaded(code))
    )
  })
</script>

<style scoped lang="scss">
  :deep(.question-bank__stem) {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    min-width: 0;

    > svg {
      color: var(--theme-color);
    }

    span {
      display: grid;
      min-width: 0;
    }

    strong,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      margin-top: 3px;
      color: var(--el-text-color-secondary);
    }
  }

  .question-bank__option {
    display: grid;
    grid-template-columns: 62px 40px minmax(0, 1fr) 32px;
    gap: 8px;
    align-items: center;
    padding: 10px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--el-border-radius-base);
  }

  @media (width <= 900px) {
    .question-bank__option {
      grid-template-columns: 56px 36px minmax(0, 1fr) 32px;
    }
  }
</style>
