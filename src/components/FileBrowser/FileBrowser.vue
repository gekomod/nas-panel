<template>
  <div class="file-manager">
    <el-button type="primary" @click="showUploadModal = true">
      <el-icon><Upload /></el-icon> Upload
    </el-button>

    <el-table :data="files" style="width: 100%">
      <el-table-column prop="name" label="Nazwa" />
      <el-table-column prop="size" label="Rozmiar" width="120" />
      <el-table-column prop="modified" label="Data" width="180" />
      <el-table-column label="Akcje" width="120">
        <template #default="scope">
          <el-button size="small" @click="downloadFile(scope.row)">Pobierz</el-button>
        </template>
      </el-table-column>
    </el-table>

    <UploadModal v-model="showUploadModal" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Upload } from '@element-plus/icons-vue'
import UploadModal from './UploadModal.vue'

const files = ref([
  { name: 'Dokument.pdf', size: '2.4 MB', modified: '2024-05-20' },
  { name: 'Obraz.jpg', size: '1.8 MB', modified: '2024-05-18' }
])

const showUploadModal = ref(false)

const downloadFile = (file) => {
  alert(`Pobieranie: ${file.name}`)
}
</script>
