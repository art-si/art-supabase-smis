import { computed, reactive, ref } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import type { SmisExamDetail, SmisExamQuestionSelection } from '@smis/api'

const EMPTY_EXAM_QUESTION: SmisExamQuestionSelection = {
  id: '',
  questionId: '',
  questionType: 'single',
  stem: '',
  score: 0,
  options: []
}

export const useExamSession = () => {
  const session = ref<SmisExamDetail>()
  const currentIndex = ref(0)
  const answers = reactive<Record<string, string[]>>({})
  const nowTick = ref(Date.now())

  const { pause: pauseClock, resume: resumeClock } = useIntervalFn(
    () => {
      nowTick.value = Date.now()
    },
    1000,
    { immediate: false }
  )

  const currentQuestion = computed<SmisExamQuestionSelection>(
    () => session.value?.questions[currentIndex.value] ?? EMPTY_EXAM_QUESTION
  )
  const answerProgress = computed(() =>
    !session.value?.questions.length
      ? 0
      : Math.round(
          (Object.values(answers).filter((item) => item.length).length /
            session.value.questions.length) *
            100
        )
  )
  const remainingText = computed(() => {
    const expires = session.value?.attempt?.expiresAt
    if (!expires) return '不限时'
    const seconds = Math.max(Math.floor((new Date(expires).getTime() - nowTick.value) / 1000), 0)
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  })

  const startSession = (value: SmisExamDetail | undefined) => {
    session.value = value
    currentIndex.value = 0
    Object.keys(answers).forEach((key) => delete answers[key])
    value?.questions.forEach((item) => {
      answers[item.id] = [...(item.answerValues ?? [])]
    })
    nowTick.value = Date.now()
    if (value) resumeClock()
    else pauseClock()
  }

  const stopSessionClock = () => pauseClock()

  return {
    session,
    currentIndex,
    answers,
    currentQuestion,
    answerProgress,
    remainingText,
    startSession,
    stopSessionClock
  }
}
