import { normalizeNullableText } from '@/utils/form/normalize'
import { useSupabase } from '@/hooks/core/useSupabase'
import type { ApiFeedbackOptions } from '@/types/api/request'
import type {
  SmisCourseLearningListResult,
  SmisCourseLearningSearchParams,
  SmisCourseListResult,
  SmisCoursePayload,
  SmisCourseSearchParams,
  SmisExamDetail,
  SmisExamPaperListResult,
  SmisExamPaperPayload,
  SmisExamPaperSearchParams,
  SmisExamRecordListResult,
  SmisExamRecordSearchParams,
  SmisQuestionBankListResult,
  SmisQuestionBankSearchParams,
  SmisQuestionCategoryPayload,
  SmisQuestionPayload,
  SmisRandomRule
} from '@smis/api/types'

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()
const pageBounds = (from?: number, to?: number) => {
  const safeFrom = Math.max(from ?? 0, 0)
  return { from: safeFrom, to: Math.max(to ?? safeFrom + 19, safeFrom) }
}

export async function fetchQuestionBankList(
  params: SmisQuestionBankSearchParams = {},
  options: ApiFeedbackOptions = {}
) {
  const { from, to } = pageBounds(params.from, params.to)
  const result = await responseHandle<Partial<SmisQuestionBankListResult>>(
    () =>
      supabase.rpc('smis_list_question_bank_secure', {
        p_from: from,
        p_to: to,
        p_keyword: normalizeNullableText(params.keyword),
        p_category_id: params.categoryId || null,
        p_question_type: params.questionType || null,
        p_status: params.status || null
      }),
    { showErrorMessage: options.showErrorMessage ?? true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? {
      total: 0,
      enabled: 0,
      single: 0,
      multiple: 0,
      judgement: 0
    },
    categories: result.data?.categories ?? [],
    error: result.error
  }
}

export async function saveQuestionCategory(payload: SmisQuestionCategoryPayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_manage_question_category_secure', {
        p_action: 'save',
        p_payload: keysToSnakeDeep(payload)
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: payload.id ? '题库分类已更新' : '题库分类已新增'
    }
  )
}

export async function deleteQuestionCategory(id: string) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_manage_question_category_secure', {
        p_action: 'delete',
        p_payload: { id }
      }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '题库分类已删除'
    }
  )
}

export async function saveQuestion(payload: SmisQuestionPayload) {
  return await responseHandle<{ id: string }>(
    () =>
      supabase.rpc('smis_manage_question_secure', {
        p_action: 'save',
        p_payload: keysToSnakeDeep(payload)
      }),
    { showMessage: true, breakReturn: true, message: payload.id ? '题目已更新' : '题目已新增' }
  )
}

export async function deleteQuestions(ids: string[]) {
  return await responseHandle<{ affected: number }>(
    () => supabase.rpc('smis_manage_question_secure', { p_action: 'delete', p_payload: { ids } }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '题目已删除'
    }
  )
}

export async function toggleQuestions(ids: string[], status: 'enabled' | 'disabled') {
  return await responseHandle<{ affected: number }>(
    () =>
      supabase.rpc('smis_manage_question_secure', {
        p_action: 'toggle',
        p_payload: { ids, status }
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: status === 'enabled' ? '题目已启用' : '题目已停用'
    }
  )
}

export async function generateExamQuestions(rules: SmisRandomRule[]) {
  const result = await responseHandle<
    Array<{
      questionId: string
      categoryId: string
      questionType: string
      stem: string
      score: number
    }>
  >(
    () => supabase.rpc('smis_generate_exam_questions_secure', { p_rules: keysToSnakeDeep(rules) }),
    { showMessage: true, breakReturn: true, message: '已按规则随机生成试题' }
  )
  return result.data ?? []
}

export async function fetchExamPaperList(params: SmisExamPaperSearchParams = {}) {
  const { from, to } = pageBounds(params.from, params.to)
  const result = await responseHandle<Partial<SmisExamPaperListResult>>(
    () =>
      supabase.rpc('smis_list_exam_papers_secure', {
        p_from: from,
        p_to: to,
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_scope: params.scope ?? 'manage'
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? {
      total: 0,
      draft: 0,
      published: 0,
      inProgress: 0,
      completed: 0
    },
    error: result.error
  }
}

export async function saveExamPaper(payload: SmisExamPaperPayload) {
  return await responseHandle<{ id: string; totalScore: number }>(
    () =>
      supabase.rpc('smis_manage_exam_paper_secure', {
        p_action: 'save',
        p_payload: keysToSnakeDeep(payload)
      }),
    { showMessage: true, breakReturn: true, message: payload.id ? '试卷已更新' : '试卷已创建' }
  )
}

export async function transitionExamPaper(id: string, action: 'publish' | 'close') {
  return await responseHandle<{ id: string; status: string }>(
    () => supabase.rpc('smis_manage_exam_paper_secure', { p_action: action, p_payload: { id } }),
    {
      showMessage: true,
      breakReturn: true,
      message: action === 'publish' ? '试卷已发布' : '试卷已关闭'
    }
  )
}

export async function deleteExamPapers(ids: string[]) {
  return await responseHandle<{ affected: number }>(
    () => supabase.rpc('smis_manage_exam_paper_secure', { p_action: 'delete', p_payload: { ids } }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '试卷已删除'
    }
  )
}

export async function fetchExamDetail(paperId: string, attemptId?: string | null, preview = false) {
  const result = await responseHandle<SmisExamDetail>(
    () =>
      supabase.rpc('smis_get_exam_detail_secure', {
        p_paper_id: paperId,
        p_attempt_id: attemptId ?? null,
        p_preview: preview
      }),
    { showErrorMessage: true, breakReturn: true }
  )
  return result.data
}

export async function startExam(paperId: string) {
  const result = await responseHandle<SmisExamDetail>(
    () => supabase.rpc('smis_start_exam_secure', { p_paper_id: paperId }),
    { showErrorMessage: true, breakReturn: true }
  )
  return result.data
}

export async function saveExamAnswer(
  attemptId: string,
  questionId: string,
  answerValues: string[]
) {
  return await responseHandle<void>(
    () =>
      supabase.rpc('smis_save_exam_answer_secure', {
        p_attempt_id: attemptId,
        p_question_id: questionId,
        p_answer_values: answerValues
      }),
    { showErrorMessage: true, breakReturn: true }
  )
}

export async function submitExam(attemptId: string) {
  const result = await responseHandle<SmisExamDetail>(
    () => supabase.rpc('smis_submit_exam_secure', { p_attempt_id: attemptId }),
    { showMessage: true, breakReturn: true, message: '试卷已提交并完成自动评分' }
  )
  return result.data
}

export async function fetchExamRecordList(params: SmisExamRecordSearchParams = {}) {
  const { from, to } = pageBounds(params.from, params.to)
  const result = await responseHandle<Partial<SmisExamRecordListResult>>(
    () =>
      supabase.rpc('smis_list_exam_records_secure', {
        p_from: from,
        p_to: to,
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? { total: 0, inProgress: 0, passed: 0, failed: 0 },
    error: result.error
  }
}

export async function fetchCourseList(params: SmisCourseSearchParams = {}) {
  const { from, to } = pageBounds(params.from, params.to)
  const result = await responseHandle<Partial<SmisCourseListResult>>(
    () =>
      supabase.rpc('smis_list_courses_secure', {
        p_from: from,
        p_to: to,
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_category: params.category || null,
        p_scope: params.scope ?? 'manage'
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? {
      total: 0,
      draft: 0,
      published: 0,
      learning: 0,
      completed: 0
    },
    error: result.error
  }
}

export async function saveCourse(payload: SmisCoursePayload) {
  return await responseHandle<{ id: string }>(
    () =>
      supabase.rpc('smis_manage_course_secure', {
        p_action: 'save',
        p_payload: keysToSnakeDeep(payload)
      }),
    { showMessage: true, breakReturn: true, message: payload.id ? '课程已更新' : '课程已新增' }
  )
}

export async function transitionCourse(id: string, action: 'publish' | 'close') {
  return await responseHandle<{ id: string }>(
    () => supabase.rpc('smis_manage_course_secure', { p_action: action, p_payload: { id } }),
    {
      showMessage: true,
      breakReturn: true,
      message: action === 'publish' ? '课程已发布' : '课程已关闭'
    }
  )
}

export async function deleteCourses(ids: string[]) {
  return await responseHandle<{ affected: number }>(
    () => supabase.rpc('smis_manage_course_secure', { p_action: 'delete', p_payload: { ids } }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '课程已删除'
    }
  )
}

export async function fetchCourseLearningRecordList(params: SmisCourseLearningSearchParams = {}) {
  const { from, to } = pageBounds(params.from, params.to)
  const result = await responseHandle<Partial<SmisCourseLearningListResult>>(
    () =>
      supabase.rpc('smis_list_course_learning_records_secure', {
        p_from: from,
        p_to: to,
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? { total: 0, assigned: 0, inProgress: 0, completed: 0 },
    error: result.error
  }
}

export async function updateCourseLearning(
  assignmentId: string,
  progressPercent: number,
  elapsedSeconds = 0,
  complete = false
) {
  return await responseHandle<Record<string, unknown>>(
    () =>
      supabase.rpc('smis_update_course_learning_secure', {
        p_assignment_id: assignmentId,
        p_progress_percent: progressPercent,
        p_elapsed_seconds: elapsedSeconds,
        p_complete: complete
      }),
    { showMessage: complete, breakReturn: true, message: complete ? '课程学习已完成' : undefined }
  )
}
