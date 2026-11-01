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
    <div v-if="record" class="three-violation-detail">
      <div class="three-violation-detail__summary">
        <ElAvatar :size="56" :src="record.avatarUrl || undefined">
          {{ record.employeeName.slice(-1) }}
        </ElAvatar>
        <div>
          <div class="three-violation-detail__identity">
            <strong>{{ record.employeeName }}</strong>
            <ArtDictDisplay
              dict-code="commonWarningStatus"
              :value="record.warningStatus"
              display="tag"
            />
            <ArtDictDisplay
              dict-code="smisThreeViolationEducationStatus"
              :value="record.educationStatus"
              display="tag"
            />
          </div>
          <p>{{
            [record.employeeNo, record.organizationName, record.positionName]
              .filter(Boolean)
              .join(' · ')
          }}</p>
        </div>
      </div>

      <div class="three-violation-detail__sections">
        <ElTabs v-model="activeDetailTab"
          ><ElTabPane name="section-0" label="违章与人员"
            ><div class="space-y-4 min-w-0"
              ><ArtSectionCard title="三违检查信息" subtitle="查看被检查人、问题事实和计划教育要求">
                <ArtDescriptions
                  :data="record"
                  :items="inspectionItems"
                  :columns="3"
                /> </ArtSectionCard></div
          ></ElTabPane>
          <ElTabPane name="section-1" label="教育实施与结果"
            ><div class="space-y-4 min-w-0"
              ><ArtSectionCard title="教育记录信息" subtitle="查看教育实施、考核结果和台账责任人">
                <ArtDescriptions
                  :data="record"
                  :items="educationItems"
                  :columns="3"
                /> </ArtSectionCard></div></ElTabPane
        ></ElTabs>
      </div>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { useAuth } from '@/hooks/core/useAuth'
  import { ref, shallowRef } from 'vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import type { SmisThreeViolationEducation } from '@smis/api'
  import { formatGender, printThreeViolationLedger } from './three-violation-ledger'

  const activeDetailTab = ref('section-0')
  const dialogRef = ref<ArtDialogExpose<SmisThreeViolationEducation>>()
  const record = shallowRef<SmisThreeViolationEducation>()
  const { hasAuth } = useAuth()
  const formatDateTime = createDateTimeFormatter({ format: 'YYYY-MM-DD HH:mm', emptyText: '—' })
  const responsibleNames = (row: SmisThreeViolationEducation): string =>
    row.responsibleEmployees.map((item) => item.employeeName).join('、') || '—'
  const responsibleOrganizations = (row: SmisThreeViolationEducation): string =>
    row.responsibleEmployees
      .map((item) => [item.organizationName, item.positionName].filter(Boolean).join(' · '))
      .filter(Boolean)
      .join('；') || '—'

  const inspectionItems: ArtDescriptionItem<SmisThreeViolationEducation>[] = [
    { key: 'employeeName', label: '被检查人', field: 'employeeName' },
    {
      key: 'age',
      label: '年龄',
      field: 'age',
      formatter: (value) => (value == null ? '—' : `${value} 岁`)
    },
    {
      key: 'gender',
      label: '性别',
      field: 'gender',
      formatter: (value) => formatGender(String(value ?? ''))
    },
    { key: 'organizationName', label: '所属组织', field: 'organizationName', span: 2 },
    { key: 'positionName', label: '岗位', field: 'positionName' },
    { key: 'violationDescription', label: '三违问题描述', field: 'violationDescription', span: 3 },
    { key: 'checkerName', label: '检查人', field: 'checkerName' },
    { key: 'checkerOrganizationName', label: '检查人组织', field: 'checkerOrganizationName' },
    { key: 'checkerPositionName', label: '检查人岗位', field: 'checkerPositionName' },
    {
      key: 'inspectionTime',
      label: '检查时间',
      value: (row: SmisThreeViolationEducation) => formatDateTime(row.inspectionTime)
    },
    { key: 'categoryName', label: '违章分类', field: 'categoryName' },
    { key: 'standardName', label: '反违章标准', field: 'standardName' },
    {
      key: 'plannedEducationContent',
      label: '拟教育内容',
      field: 'plannedEducationContent',
      span: 3
    },
    { key: 'remark', label: '检查备注', field: 'remark', span: 3 }
  ]

  const educationItems: ArtDescriptionItem<SmisThreeViolationEducation>[] = [
    {
      key: 'examScore',
      label: '考核分数',
      field: 'examScore',
      formatter: (value) => (value == null ? '—' : `${value} 分`)
    },
    {
      key: 'trainingHours',
      label: '培训课时',
      field: 'trainingHours',
      formatter: (value) => (value == null ? '—' : `${value} 课时`)
    },
    {
      key: 'educationStatus',
      label: '教育状态',
      field: 'educationStatus',
      dictCode: 'smisThreeViolationEducationStatus',
      dictDisplay: 'tag'
    },
    { key: 'responsibleNames', label: '教育负责人', value: responsibleNames },
    {
      key: 'responsibleOrganizations',
      label: '负责人组织 / 岗位',
      value: responsibleOrganizations,
      span: 2
    },
    { key: 'educationContent', label: '教育培训内容', field: 'educationContent', span: 3 },
    { key: 'educationResult', label: '教育培训结果', field: 'educationResult', span: 3 },
    {
      key: 'educationStartTime',
      label: '教育开始时间',
      value: (row: SmisThreeViolationEducation) => formatDateTime(row.educationStartTime)
    },
    {
      key: 'educationCompletedAt',
      label: '教育完成时间',
      value: (row: SmisThreeViolationEducation) => formatDateTime(row.educationCompletedAt)
    },
    {
      key: 'attachmentUrls',
      label: '教育材料',
      value: (row: SmisThreeViolationEducation) =>
        row.attachmentUrls.length ? `${row.attachmentUrls.length} 个文件` : '暂无材料'
    },
    { key: 'educationRemark', label: '教育备注', field: 'educationRemark', span: 3 }
  ]

  const handleOpen = async (row: SmisThreeViolationEducation): Promise<void> => {
    record.value = row
    await dialogRef.value?.handleOpen(row, {
      title: '查看三违人员教育信息',
      subtitle: '核对检查事实、教育过程与安全教育台账内容',
      contentMaxHeight: 'calc(100vh - 150px)',
      cancelText: '关闭',
      confirmText: '打印安全教育台账',
      showConfirmButton: hasAuth('SmisThreeViolationEducation:Print'),
      autoClose: false,
      onConfirm: () => {
        if (!hasAuth('SmisThreeViolationEducation:Print')) return false
        printThreeViolationLedger(row)
        return false
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .three-violation-detail {
    min-width: 0;

    &__summary {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 14px;
      align-items: center;
      padding: 15px 16px;
      margin-bottom: 16px;
      background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-base);

      p {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    &__identity {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;

      strong {
        margin-right: 2px;
        font-size: 17px;
        color: var(--el-text-color-primary);
      }
    }

    &__sections {
      display: grid;
      gap: 14px;
    }
  }
</style>
