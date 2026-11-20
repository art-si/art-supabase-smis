<template>
  <ArtDialog ref="dialogRef" size="lg" :show-footer="false">
    <div class="shift-calendar">
      <div class="shift-calendar__toolbar art-card-xs">
        <div>
          <strong>{{ calendar?.employeeName || employee?.employeeName || '人员倒班表' }}</strong>
          <span
            >{{ employee?.organizationName || '未关联组织' }} · {{ employee?.positionName }}</span
          >
        </div>
        <ElDatePicker
          v-model="month"
          type="month"
          value-format="YYYY-MM"
          format="YYYY 年 MM 月"
          :clearable="false"
          aria-label="选择倒班月份"
          @change="loadCalendar"
        />
      </div>

      <ElCalendar v-model="calendarDate" class="shift-calendar__calendar">
        <template #header>
          <div class="shift-calendar__legend" aria-label="倒班图例">
            <span><i class="is-work"></i>排班</span>
            <span><i class="is-leave"></i>请假</span>
            <span><i class="is-rest"></i>休息</span>
          </div>
        </template>
        <template #date-cell="{ data }">
          <div
            class="shift-calendar__day"
            :class="{
              'is-other-month': data.type !== 'current-month',
              'is-today': dayjs(data.day).isSame(dayjs(), 'day')
            }"
          >
            <span class="shift-calendar__date">
              <strong>{{ dayjs(data.day).date() }}</strong>
              <small v-if="dayjs(data.day).isSame(dayjs(), 'day')">今天</small>
            </span>
            <template v-if="data.type === 'current-month'">
              <span
                v-if="assignmentMap.get(data.day)"
                class="shift-calendar__assignment"
                :class="`is-${assignmentMap.get(data.day)?.assignmentStatus}`"
                :title="assignmentTitle(assignmentMap.get(data.day))"
              >
                <strong>{{ assignmentMap.get(data.day)?.shiftName || '班次' }}</strong>
                <small v-if="assignmentMap.get(data.day)?.assignmentStatus === 'leave'">请假</small>
                <small v-else>
                  {{ assignmentMap.get(data.day)?.startTime }}–{{
                    assignmentMap.get(data.day)?.endTime
                  }}
                </small>
              </span>
              <span v-else class="shift-calendar__rest">休息</span>
            </template>
          </div>
        </template>
      </ElCalendar>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { useArtOverlaySession } from '@/hooks/core/useArtOverlay'
  import dayjs from 'dayjs'
  import { computed, nextTick, ref, unref } from 'vue'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import {
    fetchEmployeeShiftCalendar,
    type SmisEmployeeShiftAssignment,
    type SmisEmployeeShiftCalendar,
    type SmisPersonnelChecklistRecord
  } from '@smis/api'

  export interface ShiftCalendarOpenData {
    employee: SmisPersonnelChecklistRecord
    month?: string
  }

  const dialogRef = ref<ArtDialogExpose<ShiftCalendarOpenData>>()
  const session = useArtOverlaySession(() => Boolean(unref(dialogRef.value?.visible)))
  const employee = ref<SmisPersonnelChecklistRecord>()
  const calendar = ref<SmisEmployeeShiftCalendar | null>(null)
  const month = ref(dayjs().format('YYYY-MM'))
  const calendarDate = ref(dayjs().startOf('month').toDate())
  const assignmentMap = computed(
    () => new Map((calendar.value?.assignments ?? []).map((item) => [item.workDate, item]))
  )

  const assignmentTitle = (assignment?: SmisEmployeeShiftAssignment): string => {
    if (!assignment) return '休息'
    if (assignment.assignmentStatus === 'leave') return `${assignment.shiftName} · 请假`
    return `${assignment.shiftName} · ${assignment.startTime}–${assignment.endTime}${assignment.crossDay ? '（跨日）' : ''}`
  }
  const loadCalendar = async (): Promise<void> => {
    if (!employee.value) return
    const employeeId = employee.value.id
    const requestedMonth = month.value
    const version = session.invalidate()
    if (!session.isCurrent(version)) return
    calendarDate.value = dayjs(`${requestedMonth}-01`).toDate()
    dialogRef.value?.setLoading(true)
    try {
      const loadedCalendar = await fetchEmployeeShiftCalendar(employeeId, requestedMonth)
      if (session.isCurrent(version)) calendar.value = loadedCalendar
    } finally {
      if (session.isCurrent(version)) dialogRef.value?.setLoading(false)
    }
  }
  const handleOpen = async (data: ShiftCalendarOpenData): Promise<void> => {
    const version = session.invalidate()
    employee.value = data.employee
    month.value = data.month || dayjs().format('YYYY-MM')
    calendar.value = null
    await dialogRef.value?.handleOpen(data, {
      title: `${data.employee.employeeName} · 倒班表`,
      showFooter: false,
      loading: true,
      onOpen: async () => {
        await nextTick()
        if (!session.isCurrent(version)) return
        await loadCalendar()
      },
      onClose: () => {
        session.invalidate()
      },
      onReset: () => {
        session.invalidate()
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .shift-calendar {
    min-width: 0;

    &__toolbar {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      margin-bottom: 12px;
    }

    &__toolbar > div {
      display: grid;
      min-width: 0;
    }

    &__toolbar span {
      margin-top: 2px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__calendar {
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__calendar :deep(.el-calendar__header) {
      padding: 10px 14px;
    }

    &__calendar :deep(.el-calendar__body) {
      padding: 0;
    }

    &__calendar :deep(.el-calendar-day) {
      height: 86px;
      padding: 0;
    }

    &__legend {
      display: flex;
      gap: 16px;
      align-items: center;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__legend span {
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }

    &__legend i {
      width: 8px;
      height: 8px;
      background: var(--el-color-info);
      border-radius: 50%;
    }

    &__legend i.is-work {
      background: var(--theme-color);
    }

    &__legend i.is-leave {
      background: var(--el-color-warning);
    }

    &__day {
      display: flex;
      flex-direction: column;
      gap: 7px;
      height: 100%;
      padding: 7px;
    }

    &__day.is-other-month {
      opacity: 0.38;
    }

    &__day.is-today {
      background: color-mix(in srgb, var(--theme-color) 7%, transparent);
    }

    &__date {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    &__date small {
      color: var(--theme-color);
    }

    &__assignment,
    &__rest {
      display: grid;
      gap: 2px;
      padding: 5px 7px;
      overflow: hidden;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--el-bg-color));
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-small);
    }

    &__assignment small,
    &__assignment strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__assignment small {
      font-size: 11px;
    }

    &__assignment.is-leave {
      color: var(--el-color-warning-dark-2);
      background: var(--el-color-warning-light-9);
      border-color: var(--el-color-warning);
    }

    &__rest {
      color: var(--el-text-color-placeholder);
      background: var(--art-gray-100);
      border-color: var(--el-border-color);
    }

    @media (width <= 680px) {
      &__toolbar {
        flex-direction: column;
        align-items: stretch;
      }

      &__calendar :deep(.el-calendar-day) {
        height: 70px;
      }

      &__assignment small {
        display: none;
      }
    }
  }
</style>
