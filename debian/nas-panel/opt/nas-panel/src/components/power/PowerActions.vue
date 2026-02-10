<template>
  <div class="power-actions">
    <el-row :gutter="20">
      <el-col :span="8" v-for="action in actions" :key="action.id">
        <el-card shadow="hover" class="action-card">
          <div class="action-content">
            <div class="action-icon" :class="action.type">
              <icon :icon="action.icon" width="48" />
            </div>
            <h3>{{ action.title }}</h3>
            <p>{{ action.description }}</p>
            <el-button
              :type="action.buttonType"
              :loading="action.loading"
              @click="executeAction(action)"
              class="action-button"
            >
              <icon :icon="action.buttonIcon" width="16" />
              {{ action.buttonText }}
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover" style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <icon icon="mdi:history" width="24" />
          <h3>Historia akcji</h3>
        </div>
      </template>

      <el-table :data="actionHistory" style="width: 100%" v-loading="historyLoading">
        <el-table-column prop="timestamp" label="Data" width="160" />
        <el-table-column prop="action" label="Akcja" />
        <el-table-column prop="status" label="Status" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'">
              {{ row.status === 'success' ? 'Sukces' : 'Błąd' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="user" label="Użytkownik" width="120" />
      </el-table>
    </el-card>

    <!-- Dialog potwierdzenia -->
    <el-dialog
      v-model="confirmDialog.visible"
      :title="confirmDialog.title"
      width="400px"
    >
      <p>{{ confirmDialog.message }}</p>
      <el-input
        v-if="confirmDialog.requiresInput"
        v-model="confirmInput"
        :placeholder="confirmDialog.inputPlaceholder"
        style="margin-top: 15px;"
      />
      <template #footer>
        <el-button @click="confirmDialog.visible = false">Anuluj</el-button>
        <el-button
          type="primary"
          :disabled="confirmDialog.requiresInput && !confirmInput"
          @click="confirmAction"
        >
          Potwierdź
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import axios from 'axios'

const actions = reactive([
  {
    id: 'restart',
    type: 'warning',
    icon: 'mdi:restart',
    title: 'Restart systemu',
    description: 'Bezpieczny restart całego systemu NAS',
    buttonType: 'warning',
    buttonIcon: 'mdi:restart',
    buttonText: 'Restartuj',
    loading: false,
    requiresConfirmation: true,
    confirmationMessage: 'Czy na pewno chcesz zrestartować system?'
  },
  {
    id: 'shutdown',
    type: 'danger',
    icon: 'mdi:power',
    title: 'Wyłącz system',
    description: 'Bezpieczne wyłączenie całego systemu NAS',
    buttonType: 'danger',
    buttonIcon: 'mdi:power',
    buttonText: 'Wyłącz',
    loading: false,
    requiresConfirmation: true,
    requiresInput: true,
    confirmationMessage: 'Czy na pewno chcesz wyłączyć system?',
    inputPlaceholder: 'Wpisz "POTWIERDZAM" aby kontynuować'
  },
  {
    id: 'sleep',
    type: 'info',
    icon: 'mdi:sleep',
    title: 'Tryb uśpienia',
    description: 'Przełączenie systemu w tryb niskiego poboru mocy',
    buttonType: 'info',
    buttonIcon: 'mdi:sleep',
    buttonText: 'Uśpij',
    loading: false,
    requiresConfirmation: true,
    confirmationMessage: 'Czy na pewno chcesz uśpić system?'
  }
])

const actionHistory = ref([])
const historyLoading = ref(false)

const confirmDialog = reactive({
  visible: false,
  title: '',
  message: '',
  requiresInput: false,
  inputPlaceholder: '',
  actionId: null
})

const confirmInput = ref('')
const pendingAction = ref(null)

const loadHistory = async () => {
  historyLoading.value = true
  try {
    const response = await axios.get('/power/history')
    actionHistory.value = response.data.history
  } catch (error) {
    console.error('Błąd podczas ładowania historii:', error)
    ElMessage.error('Nie udało się załadować historii akcji')
  } finally {
    historyLoading.value = false
  }
}

const executeAction = (action) => {
  pendingAction.value = action
  
  if (action.requiresConfirmation) {
    confirmDialog.title = action.title
    confirmDialog.message = action.confirmationMessage
    confirmDialog.requiresInput = action.requiresInput || false
    confirmDialog.inputPlaceholder = action.inputPlaceholder || ''
    confirmDialog.actionId = action.id
    confirmDialog.visible = true
    confirmInput.value = ''
  } else {
    performAction(action)
  }
}

const confirmAction = () => {
  if (confirmDialog.requiresInput && confirmInput.value !== 'POTWIERDZAM') {
    ElMessage.warning('Nieprawidłowe potwierdzenie')
    return
  }

  const action = actions.find(a => a.id === confirmDialog.actionId)
  if (action) {
    performAction(action)
  }
  
  confirmDialog.visible = false
}

const performAction = async (action) => {
  action.loading = true
  
  try {
    const confirmation = action.requiresInput ? 'POTWIERDZAM' : undefined
    await axios.post('/power/action', { 
      action: action.id, 
      confirmation 
    })
    
    ElMessage.success(`Akcja ${action.title} wykonana pomyślnie`)
    
    // Odśwież historię
    await loadHistory()
  } catch (error) {
    console.error('Błąd podczas wykonywania akcji:', error)
    ElMessage.error(`Błąd podczas wykonywania akcji: ${error.response?.data?.error || error.message}`)
  } finally {
    action.loading = false
  }
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.power-actions {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-header h3 {
  margin: 0;
}

.action-card {
  height: 250px;
  display: flex;
  flex-direction: column;
}

.action-content {
  text-align: center;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.action-icon {
  margin-bottom: 15px;
}

.action-icon.warning { color: var(--el-color-warning); }
.action-icon.danger { color: var(--el-color-danger); }
.action-icon.info { color: var(--el-color-info); }

.action-content h3 {
  margin: 0 0 10px 0;
  font-size: 1.2rem;
}

.action-content p {
  margin: 0 0 20px 0;
  color: var(--el-text-color-secondary);
  flex-grow: 1;
}

.action-button {
  width: 100%;
}
</style>
