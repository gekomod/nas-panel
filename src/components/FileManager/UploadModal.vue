<template>
  <el-dialog v-model="visible" title="Upload plików" width="30%">
    <el-upload
      drag
      action="/api/upload" <!-- W rzeczywistości podaj endpoint backendu -->
      multiple
      :on-success="handleSuccess"
    >
      <el-icon :size="50"><Upload /></el-icon>
      <div class="el-upload__text">
        Upuść pliki tutaj lub <em>kliknij, aby wybrać</em>
      </div>
    </el-upload>
    <template #footer>
      <el-button @click="visible = false">Anuluj</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { Upload } from '@element-plus/icons-vue'

const visible = ref(false)
const emit = defineEmits(['update:modelValue'])

defineProps({
  modelValue: Boolean
})

const handleSuccess = (response) => {
  alert('Plik przesłany pomyślnie!')
  visible.value = false
}
</script>
