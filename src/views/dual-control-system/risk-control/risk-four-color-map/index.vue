<template>
  <ArtPermissionGuard permission="SmisDualControlRiskFourColorMap:View">
    <div class="risk-four-map-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="risk-four-map-page__overview"
        eyebrow="RISK VISUAL CONFIGURATION"
        title="风险四色图"
        description="按场景层级维护全厂风险空间图，拖拽配置图形并关联风险点，实现风险等级的直观定位。"
        icon="ri:map-2-line"
        density="compact"
        :tags="workspaceTags"
        :metrics="workspaceMetrics"
      >
        <template #actions>
          <ElButton
            v-auth="'SmisDualControlRiskFourColorMap:AddScene'"
            type="primary"
            @click="openSceneDialog()"
          >
            <ArtSvgIcon icon="ri:add-line" />
            新增场景
          </ElButton>
        </template>
      </BusinessWorkspaceHeader>

      <div class="risk-four-map-page__workspace">
        <ArtWorkspaceSplitter
          primary-size="300px"
          primary-min="280px"
          primary-max="380px"
          secondary-min="720px"
          :breakpoint="1120"
          narrow-mode="stack"
          stacked-primary-size="380px"
          stacked-secondary-min-size="1040px"
        >
          <template #primary>
            <aside class="risk-four-map-page__scene-panel">
              <RiskMapSceneNavigator
                v-model:keyword="sceneState.keyword"
                :rows="sceneState.rows"
                :tree-data="filteredSceneTree"
                :selected-id="sceneState.selectedId"
                :loading="sceneState.loading"
                :error="sceneState.error"
                @refresh="loadWorkspace"
                @select="handleSceneSelect"
                @add-root="openSceneDialog()"
                @add-child="handleAddChildScene"
                @edit="openSceneDialog"
                @delete="handleDeleteScene"
              />
            </aside>
          </template>

          <div class="risk-four-map-page__content">
            <main class="risk-four-map-page__canvas-panel">
              <ArtSectionCard
                :show-scrollbar="false"
                :title="selectedScene?.sceneName || '四色图画布'"
                :subtitle="canvasSubtitle"
                :empty="!sceneState.loading && !selectedScene"
                empty-title="请选择一个场景"
                empty-description="从左侧场景树选择场景后，可在画布中拖拽配置图形。"
                :min-height="520"
              >
                <template #actions>
                  <div v-if="selectedScene" class="risk-four-map-page__canvas-actions">
                    <ElButton
                      v-auth="'SmisDualControlRiskFourColorMap:Save'"
                      :disabled="!editor.dirty"
                      :loading="editor.saving"
                      type="primary"
                      @click="handleSaveMap"
                    >
                      <ArtSvgIcon icon="ri:save-3-line" />
                      {{ editor.dirty ? '保存配置' : '已保存' }}
                    </ElButton>
                    <ElButton
                      v-auth="'SmisDualControlRiskFourColorMap:Export'"
                      @click="downloadMap"
                    >
                      <ArtSvgIcon icon="ri:download-2-line" />
                      下载图片
                    </ElButton>
                  </div>
                </template>

                <div v-if="selectedScene" class="risk-four-map-page__canvas-workspace">
                  <div class="risk-four-map-page__legend" aria-label="风险等级图例">
                    <span v-for="item in riskLegends" :key="item.code">
                      <i :style="{ backgroundColor: item.color }"></i>{{ item.label }}
                    </span>
                  </div>
                  <div class="risk-four-map-page__shape-toolbar art-card-xs">
                    <span>添加图形</span>
                    <ElButtonGroup v-auth="'SmisDualControlRiskFourColorMap:Save'">
                      <ElButton aria-label="添加矩形" @click.stop="addShape('rectangle')">
                        <ArtSvgIcon icon="ri:rectangle-line" />矩形
                      </ElButton>
                      <ElButton aria-label="添加圆形" @click.stop="addShape('circle')">
                        <ArtSvgIcon icon="ri:checkbox-blank-circle-line" />圆形
                      </ElButton>
                      <ElButton aria-label="添加多边形" @click.stop="addShape('polygon')">
                        <ArtSvgIcon icon="ri:hexagon-line" />多边形
                      </ElButton>
                      <ElButton aria-label="添加文字" @click.stop="addShape('text')">
                        <ArtSvgIcon icon="ri:text" />文字
                      </ElButton>
                    </ElButtonGroup>
                    <ElTag
                      v-if="selectedShape"
                      class="risk-four-map-page__selected-shape"
                      effect="plain"
                    >
                      <ArtSvgIcon icon="ri:cursor-line" />
                      已选：{{ selectedShape.label || shapeTypeLabel(selectedShape.shapeType) }}
                    </ElTag>
                    <ElButton
                      v-auth="'SmisDualControlRiskFourColorMap:Save'"
                      type="danger"
                      plain
                      :disabled="!selectedShape"
                      @click="removeSelectedShape"
                    >
                      <ArtSvgIcon icon="ri:delete-bin-6-line" />删除图形
                    </ElButton>
                  </div>
                  <ElScrollbar class="risk-four-map-page__canvas-scrollbar" always>
                    <div class="risk-four-map-page__canvas-stage">
                      <svg
                        ref="svgRef"
                        class="risk-four-map-page__canvas"
                        :viewBox="`0 0 ${selectedScene.canvasWidth} ${selectedScene.canvasHeight}`"
                        :width="selectedScene.canvasWidth"
                        :height="selectedScene.canvasHeight"
                        xmlns="http://www.w3.org/2000/svg"
                        role="application"
                        tabindex="0"
                        :aria-label="`${selectedScene.sceneName}风险四色图拖拽画布`"
                        @pointermove="handlePointerMove"
                        @pointerup="handlePointerUp"
                        @pointercancel="handlePointerUp"
                        @keydown="handleCanvasKeydown"
                      >
                        <defs>
                          <pattern
                            id="risk-grid"
                            width="24"
                            height="24"
                            patternUnits="userSpaceOnUse"
                          >
                            <path
                              d="M 24 0 L 0 0 0 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="0.6"
                              opacity="0.18"
                            />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" class="risk-four-map-page__canvas-base" />
                        <image
                          v-if="selectedScene.backgroundUrl"
                          :href="selectedScene.backgroundUrl"
                          x="0"
                          y="0"
                          width="100%"
                          height="100%"
                          preserveAspectRatio="xMidYMid meet"
                          opacity="0.72"
                        />
                        <rect
                          width="100%"
                          height="100%"
                          fill="url(#risk-grid)"
                          pointer-events="none"
                        />
                        <g
                          v-for="shape in editor.shapes"
                          :key="shape.id"
                          class="risk-four-map-page__shape"
                          :class="{ 'is-selected': editor.selectedShapeId === shape.id }"
                          :transform="`rotate(${shape.rotation} ${shape.x + shape.width / 2} ${shape.y + shape.height / 2})`"
                          tabindex="0"
                          role="button"
                          :aria-label="`${shape.label || shape.riskPointName || '未命名图形'}，按方向键移动`"
                          @pointerdown.stop="handlePointerDown($event, shape)"
                          @focus="editor.selectedShapeId = shape.id"
                          @click.stop="editor.selectedShapeId = shape.id"
                        >
                          <rect
                            v-if="shape.shapeType === 'rectangle' || shape.shapeType === 'text'"
                            :x="shape.x"
                            :y="shape.y"
                            :width="shape.width"
                            :height="shape.height"
                            :rx="shape.shapeType === 'text' ? 8 : 4"
                            :fill="shape.shapeType === 'text' ? 'transparent' : shape.fillColor"
                            :fill-opacity="shape.fillOpacity"
                            :stroke="shape.borderColor"
                            :stroke-opacity="shape.borderOpacity"
                            :stroke-width="shape.borderWidth"
                          />
                          <ellipse
                            v-else-if="shape.shapeType === 'circle'"
                            :cx="shape.x + shape.width / 2"
                            :cy="shape.y + shape.height / 2"
                            :rx="shape.width / 2"
                            :ry="shape.height / 2"
                            :fill="shape.fillColor"
                            :fill-opacity="shape.fillOpacity"
                            :stroke="shape.borderColor"
                            :stroke-opacity="shape.borderOpacity"
                            :stroke-width="shape.borderWidth"
                          />
                          <polygon
                            v-else
                            :points="polygonPoints(shape)"
                            :fill="shape.fillColor"
                            :fill-opacity="shape.fillOpacity"
                            :stroke="shape.borderColor"
                            :stroke-opacity="shape.borderOpacity"
                            :stroke-width="shape.borderWidth"
                          />
                          <text
                            :x="shape.x + shape.width / 2"
                            :y="shape.y + shape.height / 2"
                            text-anchor="middle"
                            dominant-baseline="middle"
                            :fill="
                              shape.shapeType === 'text'
                                ? shape.fillColor
                                : readableTextColor(shape.fillColor)
                            "
                            class="risk-four-map-page__shape-label"
                            pointer-events="none"
                          >
                            {{
                              shape.label || shape.riskPointName || shapeTypeLabel(shape.shapeType)
                            }}
                          </text>
                          <rect
                            v-if="editor.selectedShapeId === shape.id"
                            :x="shape.x - 5"
                            :y="shape.y - 5"
                            :width="shape.width + 10"
                            :height="shape.height + 10"
                            rx="7"
                            fill="none"
                            class="risk-four-map-page__selection-ring"
                            pointer-events="none"
                          />
                        </g>
                      </svg>
                    </div>
                  </ElScrollbar>
                  <div class="risk-four-map-page__canvas-help">
                    <ArtSvgIcon icon="ri:drag-move-2-line" />
                    单击图形保持选中；拖拽调整位置，方向键微调，Delete 删除，Esc 取消选择。
                  </div>
                </div>
              </ArtSectionCard>
            </main>

            <aside class="risk-four-map-page__property-panel">
              <RiskMapPropertyPanel
                v-model="selectedShapeModel"
                :scene="selectedScene"
                :risk-points="riskPoints"
                :risk-colors="riskColors"
                @risk-point-change="handleRiskPointChange"
                @edit-scene="openSceneDialog(selectedScene)"
                @delete-shape="removeSelectedShape"
              />
            </aside>
          </div>
        </ArtWorkspaceSplitter>
      </div>

      <RiskMapSceneDialog ref="sceneDialogRef" @success="handleSceneSaved" />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { computed, nextTick, onMounted, reactive, ref, shallowRef, watch } from 'vue'
  import { cloneDeep, clamp } from 'lodash-es'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric,
    type BusinessWorkspaceTag
  } from '@/components/business/business-workspace-header/index.vue'
  import TreeUtils from '@/utils/tree'
  import { downloadBlob } from '@/utils/file'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import {
    deleteRiskMapScene,
    fetchRiskMapPoints,
    fetchRiskMapScenes,
    saveRiskMapShapes,
    type SmisRiskMapPointOption,
    type SmisRiskMapScene,
    type SmisRiskMapShape,
    type SmisRiskMapShapeType
  } from '@smis/api'
  import RiskMapSceneDialog, {
    type RiskMapSceneDialogOpenData
  } from './modules/risk-map-scene-dialog.vue'
  import RiskMapPropertyPanel from './modules/risk-map-property-panel.vue'
  import RiskMapSceneNavigator from './modules/risk-map-scene-navigator.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_risk_map_scene',
    '四色图场景'
  )

  defineOptions({ name: 'SmisDualControlRiskFourColorMap' })

  interface SceneDialogExpose {
    handleOpen: (data: RiskMapSceneDialogOpenData) => Promise<void>
  }
  interface DragState {
    pointerId: number
    shapeId: string
    startX: number
    startY: number
    originX: number
    originY: number
  }

  const riskLegends = [
    { code: 'low', label: '低风险', color: '#0EA5E9' },
    { code: 'medium', label: '一般风险', color: '#FACC15' },
    { code: 'high', label: '较大风险', color: '#F97316' },
    { code: 'major', label: '重大风险', color: '#DC2626' }
  ] as const
  const riskColors = riskLegends.map((item) => item.color)
  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: '场景树导航', type: 'primary', effect: 'plain' },
    { label: '拖拽式配置', type: 'success', effect: 'light' },
    { label: '风险点关联', type: 'warning', effect: 'plain' }
  ]
  const { confirmAction } = useArtFeedback()
  const svgRef = ref<SVGSVGElement>()
  const sceneDialogRef = ref<SceneDialogExpose>()
  const sceneTreeUtils = new TreeUtils({
    idKey: 'id',
    parentKey: 'parentId',
    childrenKey: 'children'
  })
  const sceneState = reactive({
    rows: [] as SmisRiskMapScene[],
    selectedId: '',
    keyword: '',
    loading: false,
    error: null as string | null
  })
  const editor = reactive({
    shapes: [] as SmisRiskMapShape[],
    selectedShapeId: '',
    dirty: false,
    saving: false,
    hydrating: false,
    drag: null as DragState | null
  })
  const riskPoints = shallowRef<SmisRiskMapPointOption[]>([])
  const sceneTree = computed(
    () => sceneTreeUtils.listToTree(cloneDeep(sceneState.rows)) as SmisRiskMapScene[]
  )
  const filteredSceneTree = computed(() => {
    const keyword = sceneState.keyword.trim().toLocaleLowerCase()
    if (!keyword) return sceneTree.value
    const filter = (rows: SmisRiskMapScene[]): SmisRiskMapScene[] =>
      rows.flatMap((row) => {
        const children = filter(row.children ?? [])
        if (row.sceneName.toLocaleLowerCase().includes(keyword) || children.length)
          return [{ ...row, children }]
        return []
      })
    return filter(sceneTree.value)
  })
  const selectedScene = computed(() =>
    sceneState.rows.find((scene) => scene.id === sceneState.selectedId)
  )
  const selectedShape = computed(() =>
    editor.shapes.find((shape) => shape.id === editor.selectedShapeId)
  )
  const selectedShapeModel = computed<SmisRiskMapShape | undefined>({
    get: () => selectedShape.value,
    set: (value) => {
      if (selectedShape.value && value) Object.assign(selectedShape.value, value)
    }
  })
  const canvasSubtitle = computed(() =>
    selectedScene.value
      ? `${selectedScene.value.canvasWidth} × ${selectedScene.value.canvasHeight} · ${editor.shapes.length} 个图形${editor.dirty ? ' · 有未保存更改' : ''}`
      : '选择场景后开始配置'
  )
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() =>
    riskLegends.map((legend, index) => ({
      label: legend.label,
      value: editor.shapes.filter((shape) => shape.riskLevelCode === legend.code).length,
      description: index === 0 ? `${sceneState.rows.length} 个场景` : '当前场景关联图形',
      icon:
        index === 0
          ? 'ri:shield-check-line'
          : index === 1
            ? 'ri:error-warning-line'
            : index === 2
              ? 'ri:alarm-warning-line'
              : 'ri:fire-line',
      tone: index === 0 ? 'info' : index === 3 ? 'danger' : 'warning'
    }))
  )
  watch(
    () => editor.shapes,
    () => {
      if (!editor.hydrating) editor.dirty = true
    },
    { deep: true }
  )

  const hydrateEditor = async (): Promise<void> => {
    editor.hydrating = true
    editor.shapes = cloneDeep(selectedScene.value?.shapes ?? [])
    editor.selectedShapeId = ''
    await nextTick()
    editor.dirty = false
    editor.hydrating = false
  }
  const loadWorkspace = async (preferredSceneId?: string): Promise<void> => {
    sceneState.loading = true
    sceneState.error = null
    try {
      const [sceneResult, points] = await Promise.all([fetchRiskMapScenes(), fetchRiskMapPoints()])
      sceneState.rows = sceneResult.data
      riskPoints.value = points
      const nextId = preferredSceneId || sceneState.selectedId
      sceneState.selectedId = sceneState.rows.some((scene) => scene.id === nextId)
        ? nextId
        : (sceneState.rows[0]?.id ?? '')
      await hydrateEditor()
    } catch {
      sceneState.error = '风险四色图加载失败，请检查网络或权限后重试'
    } finally {
      sceneState.loading = false
    }
  }
  const handleSceneSelect = async (scene: SmisRiskMapScene): Promise<void> => {
    if (scene.id === sceneState.selectedId) return
    if (editor.dirty) {
      try {
        await confirmAction('切换场景将放弃当前未保存的图形更改，确定继续吗？', '切换场景')
      } catch {
        return
      }
    }
    sceneState.selectedId = scene.id
    await hydrateEditor()
  }
  const openSceneDialog = (row?: SmisRiskMapScene, presetParentId?: string): void =>
    void sceneDialogRef.value?.handleOpen({ row, sceneTree: sceneTree.value, presetParentId })
  const handleAddChildScene = (scene: SmisRiskMapScene): void =>
    openSceneDialog(undefined, scene.id)
  const handleSceneSaved = async (id: string): Promise<void> => {
    await loadWorkspace(id)
  }
  const handleDeleteScene = async (scene: SmisRiskMapScene): Promise<void> => {
    await deleteRecords({
      resources: [scene].map((row) => ({
        id: String(row.id ?? ''),
        label: String(row.sceneName ?? '四色图场景')
      })),
      permission: 'SmisDualControlRiskFourColorMap:DeleteScene',
      confirmMessage: `确定删除场景“${scene.sceneName}”吗？场景内的图形配置将一并删除。`,
      remove: async () => {
        await deleteRiskMapScene(scene.id)
      },
      onDeleted: async () => {
        await loadWorkspace()
      }
    })
  }
  const shapeTypeLabel = (type: SmisRiskMapShapeType): string =>
    ({ rectangle: '矩形', circle: '圆形', polygon: '多边形', text: '文字' })[type]
  const createShape = (type: SmisRiskMapShapeType): SmisRiskMapShape => {
    const index = editor.shapes.length
    const color = riskLegends[index % riskLegends.length].color
    return {
      id: crypto.randomUUID(),
      sceneId: selectedScene.value?.id,
      shapeType: type,
      x: 72 + (index % 5) * 34,
      y: 70 + (index % 4) * 30,
      width: type === 'text' ? 180 : 150,
      height: type === 'text' ? 54 : 96,
      rotation: 0,
      fillColor: color,
      fillOpacity: type === 'text' ? 1 : 0.82,
      borderColor: color,
      borderOpacity: 1,
      borderWidth: type === 'text' ? 1 : 2,
      label: shapeTypeLabel(type),
      points: [],
      riskPointId: null,
      sort: index
    }
  }
  const addShape = async (type: SmisRiskMapShapeType): Promise<void> => {
    const shape = createShape(type)
    editor.shapes.push(shape)
    await nextTick()
    editor.selectedShapeId = shape.id
    svgRef.value?.focus({ preventScroll: true })
  }
  const removeSelectedShape = (): void => {
    const index = editor.shapes.findIndex((shape) => shape.id === editor.selectedShapeId)
    if (index < 0) return
    editor.shapes.splice(index, 1)
    editor.selectedShapeId = ''
  }
  const handleRiskPointChange = (id?: string): void => {
    const shape = selectedShape.value
    if (!shape) return
    const point = riskPoints.value.find((item) => item.id === id)
    if (!point) {
      Object.assign(shape, {
        riskPointName: null,
        riskPointNo: null,
        riskLevelCode: null,
        riskLevelName: null,
        riskLevelColor: null
      })
      return
    }
    Object.assign(shape, {
      riskPointName: point.pointName,
      riskPointNo: point.pointNo,
      riskLevelCode: point.riskLevelCode,
      riskLevelName: point.riskLevelName,
      riskLevelColor: point.riskLevelColor,
      fillColor: point.riskLevelColor || shape.fillColor,
      borderColor: point.riskLevelColor || shape.borderColor,
      label: shape.label === shapeTypeLabel(shape.shapeType) ? point.pointName : shape.label
    })
  }
  const polygonPoints = (shape: SmisRiskMapShape): string => {
    const points = shape.points.length
      ? shape.points.map((point) => ({ x: shape.x + point.x, y: shape.y + point.y }))
      : [
          { x: shape.x + shape.width / 2, y: shape.y },
          { x: shape.x + shape.width, y: shape.y + shape.height * 0.35 },
          { x: shape.x + shape.width * 0.82, y: shape.y + shape.height },
          { x: shape.x + shape.width * 0.18, y: shape.y + shape.height },
          { x: shape.x, y: shape.y + shape.height * 0.35 }
        ]
    return points.map((point) => `${point.x},${point.y}`).join(' ')
  }
  const readableTextColor = (color: string): string => {
    const value = color.replace('#', '')
    const red = Number.parseInt(value.slice(0, 2), 16)
    const green = Number.parseInt(value.slice(2, 4), 16)
    const blue = Number.parseInt(value.slice(4, 6), 16)
    return red * 0.299 + green * 0.587 + blue * 0.114 > 160 ? '#111827' : '#FFFFFF'
  }
  const canvasPoint = (event: PointerEvent): { x: number; y: number } => {
    const svg = svgRef.value
    if (!svg) return { x: 0, y: 0 }
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const matrix = svg.getScreenCTM()?.inverse()
    return matrix ? point.matrixTransform(matrix) : { x: 0, y: 0 }
  }
  const handlePointerDown = (event: PointerEvent, shape: SmisRiskMapShape): void => {
    if (event.button !== 0) return
    const point = canvasPoint(event)
    editor.selectedShapeId = shape.id
    editor.drag = {
      pointerId: event.pointerId,
      shapeId: shape.id,
      startX: point.x,
      startY: point.y,
      originX: shape.x,
      originY: shape.y
    }
    svgRef.value?.setPointerCapture(event.pointerId)
  }
  const handlePointerMove = (event: PointerEvent): void => {
    const drag = editor.drag
    const scene = selectedScene.value
    if (!drag || !scene || drag.pointerId !== event.pointerId) return
    const shape = editor.shapes.find((item) => item.id === drag.shapeId)
    if (!shape) return
    const point = canvasPoint(event)
    shape.x = clamp(drag.originX + point.x - drag.startX, 0, scene.canvasWidth - shape.width)
    shape.y = clamp(drag.originY + point.y - drag.startY, 0, scene.canvasHeight - shape.height)
  }
  const handlePointerUp = (event: PointerEvent): void => {
    if (editor.drag?.pointerId !== event.pointerId) return
    svgRef.value?.releasePointerCapture(event.pointerId)
    editor.drag = null
  }
  const handleCanvasKeydown = (event: KeyboardEvent): void => {
    const shape = selectedShape.value
    const scene = selectedScene.value
    if (!shape || !scene) return
    if (event.key === 'Escape') {
      event.preventDefault()
      editor.selectedShapeId = ''
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      removeSelectedShape()
      return
    }
    const delta = event.shiftKey ? 10 : 2
    const next = {
      ArrowLeft: [-delta, 0],
      ArrowRight: [delta, 0],
      ArrowUp: [0, -delta],
      ArrowDown: [0, delta]
    }[event.key]
    if (!next) return
    event.preventDefault()
    shape.x = clamp(shape.x + next[0], 0, scene.canvasWidth - shape.width)
    shape.y = clamp(shape.y + next[1], 0, scene.canvasHeight - shape.height)
  }
  const handleSaveMap = async (): Promise<void> => {
    const scene = selectedScene.value
    if (!scene || editor.saving) return
    editor.saving = true
    try {
      await saveRiskMapShapes(scene.id, editor.shapes)
      await loadWorkspace(scene.id)
    } finally {
      editor.saving = false
    }
  }
  const downloadMap = (): void => {
    const svg = svgRef.value
    const scene = selectedScene.value
    if (!svg || !scene) return
    const exportSvg = svg.cloneNode(true) as SVGSVGElement
    exportSvg.setAttribute('width', String(scene.canvasWidth))
    exportSvg.setAttribute('height', String(scene.canvasHeight))
    exportSvg.removeAttribute('style')
    const source = new XMLSerializer().serializeToString(exportSvg)
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    downloadBlob(blob, `${scene.sceneName}-风险四色图.svg`)
  }

  onMounted(loadWorkspace)
</script>

<style scoped lang="scss">
  .risk-four-map-page {
    min-width: 0;

    &__overview {
      min-width: 0;
      overflow: hidden;
    }

    &__workspace {
      flex: 1 1 auto;
      width: 100%;
      min-width: 0;
      min-height: 0;
    }

    &__content {
      display: grid;
      grid-template-columns: minmax(480px, 1fr) minmax(292px, 320px);
      gap: var(--art-space-3);
      width: 100%;
      min-width: 0;
      height: 100%;
      min-height: 0;
    }

    &__scene-panel,
    &__canvas-panel,
    &__property-panel {
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    &__canvas-panel,
    &__property-panel {
      > :deep(.art-section-card) {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
    }

    &__scene-panel > :deep(.art-section-card) {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    &__canvas-actions,
    &__shape-toolbar,
    &__legend,
    &__canvas-help {
      display: flex;
      align-items: center;
    }

    &__canvas-actions {
      gap: var(--art-space-2);
    }

    &__canvas-workspace {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
    }

    &__legend {
      flex-wrap: wrap;
      gap: var(--art-space-4);
      padding-bottom: var(--art-space-3);
      font-size: var(--art-font-size-caption);
      color: var(--el-text-color-regular);

      span {
        display: inline-flex;
        gap: var(--art-space-1);
        align-items: center;
      }

      i {
        width: 10px;
        height: 10px;
        border: 1px solid rgb(15 23 42 / 16%);
        border-radius: 50%;
      }
    }

    &__shape-toolbar {
      flex-wrap: wrap;
      gap: var(--art-space-2);
      padding: var(--art-space-2);
      margin-bottom: var(--art-space-3);

      > span {
        padding-inline: var(--art-space-2);
        font-size: var(--art-font-size-caption);
        font-weight: 600;
        color: var(--el-text-color-secondary);
      }

      > :deep(.el-button:last-child) {
        margin-left: auto;
      }
    }

    &__selected-shape {
      display: inline-flex;
      gap: var(--art-space-1);
      align-items: center;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--theme-color);
      white-space: nowrap;
    }

    &__canvas-scrollbar {
      flex: 1 1 auto;
      min-height: 180px;
      background: color-mix(in srgb, var(--el-fill-color-light) 84%, var(--theme-color) 2%);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__canvas-stage {
      display: grid;
      place-items: center;
      width: 100%;
      min-width: 100%;
      height: 100%;
      padding: var(--art-space-3);
    }

    &__canvas {
      display: block;
      width: auto;
      max-width: 100%;
      height: auto;
      max-height: 100%;
      color: var(--el-border-color);
      touch-action: none;
      cursor: default;
      background: var(--el-fill-color-blank);
      border: 1px solid var(--el-border-color);
      border-radius: var(--el-border-radius-base);
      box-shadow: var(--art-themed-action-hover-shadow);

      &:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-color) 22%, transparent);
      }
    }

    &__canvas-base {
      fill: var(--el-fill-color-blank);
    }

    &__shape {
      cursor: grab;
      outline: none;

      &:active {
        cursor: grabbing;
      }

      &:focus-visible .risk-four-map-page__selection-ring {
        stroke-width: 3;
      }
    }

    &__shape-label {
      font-size: 15px;
      font-weight: 700;
      user-select: none;
    }

    &__selection-ring {
      stroke: var(--theme-color);
      stroke-width: 2;
      stroke-dasharray: 8 5;
    }

    &__canvas-help {
      gap: var(--art-space-2);
      padding-top: var(--art-space-2);
      font-size: var(--art-font-size-caption);
      color: var(--el-text-color-secondary);

      svg {
        color: var(--theme-color);
      }
    }

    :deep(.art-section-card__body),
    :deep(.art-async-state) {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
    }

    :deep(.risk-four-map-page__canvas-scrollbar .el-scrollbar__view) {
      height: 100%;
    }

    @media (width <= 1260px) {
      &__content {
        grid-template-rows: minmax(640px, 1fr) minmax(520px, auto);
        grid-template-columns: minmax(480px, 1fr);
      }

      &__property-panel {
        min-height: 520px;
      }
    }

    @media (width <= 1120px) {
      &__workspace {
        flex: 0 0 auto;
        min-height: 1440px;
      }

      &__scene-panel {
        min-height: 0;
      }
    }

    @media (width <= 900px) {
      &__canvas-panel {
        min-height: 720px;
      }

      &__property-panel {
        min-height: 560px;
      }
    }
  }
</style>
