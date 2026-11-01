<template>
  <ArtDialog ref="dialogRef" size="md">
    <div class="document-share-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:share-forward-2-line" /></template>
        <strong>{{ document?.title }}</strong>
        <p>分享对象仅限当前租户的启用用户；对方会在顶部通知中心收到消息。</p>
      </ArtEntitySummary>
      <ArtForm
        ref="formRef"
        v-model="form"
        :items="items"
        :rules="rules"
        :span="24"
        label-position="top"
      >
        <template #userIds>
          <ArtUserSelect
            v-model="form.userIds"
            :options="userOptions"
            multiple
            :loading="loadingUsers"
            placeholder="选择要分享的用户"
            no-data-text="当前租户暂无其他启用用户"
          />
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import type { FormRules } from 'element-plus'
  import { fetchEnabledOrganizationUserList } from '@/api/system-manage'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtUserSelect from '@/components/core/forms/art-user-select/index.vue'
  import type { ArtUserSelectOption } from '@/components/core/forms/art-user-select/types'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import { shareDocument, type SmisDocument } from '@smis/api'

  export interface ShareDialogOpenData {
    row: SmisDocument
  }

  interface ShareForm {
    userIds: string[]
    message: string
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const { getUserInfo } = storeToRefs(userStore)
  const dialogRef = ref<ArtDialogExpose<ShareDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const document = shallowRef<SmisDocument>()
  const userOptions = shallowRef<ArtUserSelectOption[]>([])
  const loadingUsers = ref(false)
  const form = ref<ShareForm>({ userIds: [], message: '' })
  const items: FormItem[] = [
    { label: '分享给', key: 'userIds', type: 'text', span: 24 },
    {
      label: '分享留言',
      key: 'message',
      type: 'textarea',
      span: 24,
      props: {
        rows: 4,
        maxlength: 500,
        showWordLimit: true,
        resize: 'none',
        placeholder: '可补充阅读重点、协作要求或处理时限'
      }
    }
  ]
  const rules: FormRules<ShareForm> = {
    userIds: [
      {
        validator: (_rule, value, callback) => {
          if (!Array.isArray(value) || value.length === 0) callback(new Error('请选择分享对象'))
          else callback()
        },
        trigger: 'change'
      }
    ]
  }

  const loadUsers = async (): Promise<void> => {
    const tenantId = getUserInfo.value.tenantId
    if (!tenantId) return
    loadingUsers.value = true
    try {
      const response = await fetchEnabledOrganizationUserList({ tenantId })
      userOptions.value = (response.data ?? [])
        .filter((user) => user.id !== getUserInfo.value.userId)
        .map((user) => ({
          value: user.id,
          label: user.nickName || user.userName || user.userEmail,
          avatar: user.avatar,
          userName: user.userName,
          nickName: user.nickName,
          userEmail: user.userEmail,
          departmentName: user.organization?.organizationName
        }))
    } finally {
      loadingUsers.value = false
    }
  }

  const handleSubmit = async (): Promise<boolean> => {
    if (!document.value) return false
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await shareDocument({
        documentId: document.value.id,
        userIds: [...form.value.userIds],
        message: normalizeNullableText(form.value.message)
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '文档分享失败，请稍后重试')
      return false
    }
  }

  const handleOpen = async (data: ShareDialogOpenData): Promise<void> => {
    document.value = data.row
    Object.assign(form.value, { userIds: [], message: '' })
    userOptions.value = []
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(data, {
      title: '分享文档',
      subtitle: '分享关系用于“我分享的”和“分享给我”范围筛选',
      confirmText: '发送分享',
      loading: true,
      contentMaxHeight: 'calc(100vh - 190px)',
      onOpen: async (_data, api) => {
        try {
          await loadUsers()
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit
    })
  }

  defineExpose({ handleOpen })
</script>
