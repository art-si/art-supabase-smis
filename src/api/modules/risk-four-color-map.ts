import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'

export type SmisRiskMapShapeType = 'rectangle' | 'circle' | 'polygon' | 'text'

export interface SmisRiskMapPointOption {
  id: string
  pointNo: string
  pointName: string
  riskType: string
  siteName: string
  riskLevelCode?: string | null
  riskLevelName?: string | null
  riskLevelColor?: string | null
}

export interface SmisRiskMapShape {
  id: string
  sceneId?: string
  shapeType: SmisRiskMapShapeType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  fillColor: string
  fillOpacity: number
  borderColor: string
  borderOpacity: number
  borderWidth: number
  label?: string | null
  points: Array<{ x: number; y: number }>
  riskPointId?: string | null
  riskPointName?: string | null
  riskPointNo?: string | null
  riskLevelCode?: string | null
  riskLevelName?: string | null
  riskLevelColor?: string | null
  sort: number
}

export interface SmisRiskMapScene {
  id: string
  tenantId: string
  parentId?: string | null
  sceneName: string
  backgroundUrl?: string | null
  canvasWidth: number
  canvasHeight: number
  sort: number
  shapes: SmisRiskMapShape[]
  children?: SmisRiskMapScene[]
  createBy?: string | null
  createTime: string
  updateBy?: string | null
  updateTime: string
}

export interface SmisRiskMapScenePayload {
  id?: string
  parentId?: string | null
  sceneName: string
  backgroundUrl?: string | null
  canvasWidth: number
  canvasHeight: number
  sort: number
}

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchRiskMapScenes() {
  const result = await responseHandle<SmisRiskMapScene[]>(
    () => supabase.rpc('smis_list_risk_map_scenes_secure'),
    { showErrorMessage: true }
  )
  return { data: result.data ?? [], error: result.error }
}

export async function fetchRiskMapPoints() {
  const result = await responseHandle<SmisRiskMapPointOption[]>(
    () => supabase.rpc('smis_list_risk_map_points_secure'),
    { showErrorMessage: true }
  )
  return result.data ?? []
}

export async function saveRiskMapScene(params: SmisRiskMapScenePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_risk_map_scene_secure', {
        p_id: params.id ?? null,
        p_parent_id: params.parentId || null,
        p_scene_name: params.sceneName.trim(),
        p_background_url: normalizeNullableText(params.backgroundUrl),
        p_canvas_width: params.canvasWidth,
        p_canvas_height: params.canvasHeight,
        p_sort: params.sort
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '场景设置已更新' : '四色图场景已新增'
    }
  )
}

export async function saveRiskMapShapes(sceneId: string, shapes: SmisRiskMapShape[]) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_save_risk_map_shapes_secure', {
        p_scene_id: sceneId,
        p_shapes: keysToSnakeDeep(
          shapes.map((shape) =>
            omit(shape, [
              'sceneId',
              'riskPointName',
              'riskPointNo',
              'riskLevelCode',
              'riskLevelName',
              'riskLevelColor'
            ])
          )
        )
      }),
    { showMessage: true, breakReturn: true, message: '风险四色图已保存' }
  )
}

export async function deleteRiskMapScene(id: string) {
  return await responseHandle<boolean>(
    () => supabase.rpc('smis_delete_risk_map_scene_secure', { p_id: id }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '四色图场景已删除'
    }
  )
}
