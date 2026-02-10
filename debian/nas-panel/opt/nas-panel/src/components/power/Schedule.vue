<template>
  <div class="power-schedule">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <icon icon="mdi:clock-outline" width="24" />
            <h2>Harmonogram Zasilania</h2>
          </div>
          <el-button type="primary" @click="showAddDialog = true">
            <icon icon="mdi:plus" width="16" />
            Nowy harmonogram
          </el-button>
        </div>
      </template>

      <el-table :data="schedules" style="width: 100%" v-loading="loading">
        <el-table-column label="Akcja" width="120">
          <template #default="{ row }">
            <div class="action-cell">
              <icon :icon="getActionIcon(row.action)" width="20" />
              <span>{{ getActionLabel(row.action) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="time" label="Czas" width="100" />
        <el-table-column label="Dni tygodnia" width="200">
          <template #default="{ row }">
            <el-tag
              v-for="day in row.days"
              :key="day"
              size="small"
              class="day-tag"
            >
              {{ getDayAbbreviation(day) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Status" width="100">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? 'Aktywny' : 'Nieaktywny' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Operacje" width="150">
          <template #default="{ row }">
            <el-button size="small" @click="editSchedule(row)">
              <icon icon="mdi:pencil" width="14" />
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="deleteSchedule(row)"
            >
              <icon icon="mdi:delete" width="14" />
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Dialog dodawania/edycji -->
      <el-dialog
        v-model="showAddDialog"
        :title="editingSchedule ? 'Edytuj harmonogram' : 'Nowy harmonogram'"
        width="500px"
      >
        <el-form :model="form" label-width="120px">
          <el-form-item label="Akcja">
            <el-select v-model="form.action" placeholder="Wybierz akcję">
              <el-option value="shutdown" label="Wyłącz">
                <icon icon="mdi:power" width="16" /> Wyłącz
              </el-option>
              <el-option value="restart" label="Restart">
                <icon icon="mdi:restart" width="16" /> Restart
              </el-option>
              <el-option value="wake" label="Włącz">
                <icon icon="mdi:power-on" width="16" /> Włącz
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="Czas">
            <el-time-picker
              v-model="form.time"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="Wybierz czas"
            />
          </el-form-item>
          <el-form-item label="Dni tygodnia">
            <el-checkbox-group v-model="form.days">
              <el-checkbox label="monday">Poniedziałek</el-checkbox>
              <el-checkbox label="tuesday">Wtorek</el-checkbox>
              <el-checkbox label="wednesday">Środa</el-checkbox>
              <el-checkbox label="thursday">Czwartek</el-checkbox>
              <el-checkbox label="friday">Piątek</el-checkbox>
              <el-checkbox label="saturday">Sobota</el-checkbox>
              <el-checkbox label="sunday">Niedziela</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item label="Status">
            <el-switch v-model="form.enabled" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showAddDialog = false">Anuluj</el-button>
          <el-button type="primary" @click="saveSchedule">
            Zapisz
          </el-button>
        </template>
      </el-dialog>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import axios from 'axios'

const loading = ref(false)
const showAddDialog = ref(false)
const editingSchedule = ref(null)

const schedules = ref([])

const form = reactive({
  action: 'restart',
  time: '00:00',
  days: [],
  enabled: true
})

const loadSchedules = async () => {
  loading.value = true
  try {
    const response = await axios.get('/power/schedules')
    schedules.value = response.data.schedules
  } catch (error) {
    console.error('Błąd podczas ładowania harmonogramów:', error)
    ElMessage.error('Nie udało się załadować harmonogramów')
  } finally {
    loading.value = false
  }
}

const getActionIcon = (action) => {
  const icons = {
    shutdown: 'mdi:power',
    restart: 'mdi:restart',
    wake: 'mdi:power-on'
  }
  return icons[action] || 'mdi:clock'
}

const getActionLabel = (action) => {
  const labels = {
    shutdown: 'Wyłącz',
    restart: 'Restart',
    wake: 'Włącz'
  }
  return labels[action] || action
}

const getDayAbbreviation = (day) => {
  const abbreviations = {
    monday: 'Pn',
    tuesday: 'Wt',
    wednesday: 'Śr',
    thursday: 'Cz',
    friday: 'Pt',
    saturday: 'Sb',
    sunday: 'Nd'
  }
  return abbreviations[day] || day
}

const editSchedule = (schedule) => {
  editingSchedule.value = schedule
  Object.assign(form, schedule)
  showAddDialog.value = true
}

const deleteSchedule = async (schedule) => {
  try {
    await ElMessageBox.confirm(
      `Czy na pewno chcesz usunąć harmonogram?`,
      'Potwierdzenie usunięcia',
      { type: 'warning' }
    )
    
    await axios.delete(`/power/schedules/${schedule.id}`)
    schedules.value = schedules.value.filter(s => s.id !== schedule.id)
    ElMessage.success('Harmonogram usunięty')
  } catch (error) {
    // Anulowano
  }
}

const saveSchedule = async () => {
  try {
    if (editingSchedule.value) {
      await axios.post('/power/schedules', { schedule: form })
      Object.assign(editingSchedule.value, form)
      ElMessage.success('Harmonogram zaktualizowany')
    } else {
      const response = await axios.post('/power/schedules', { schedule: form })
      const newSchedule = {
        id: response.data.id,
        ...form
      }
      schedules.value.push(newSchedule)
      ElMessage.success('Harmonogram dodany')
    }
    
    showAddDialog.value = false
    editingSchedule.value = null
    resetForm()
  } catch (error) {
    console.error('Błąd podczas zapisywania harmonogramu:', error)
    ElMessage.error('Nie udało się zapisać harmonogramu')
  }
}

const resetForm = () => {
  Object.assign(form, {
    action: 'restart',
    time: '00:00',
    days: [],
    enabled: true
  })
}

onMounted(() => {
  loadSchedules()
})
</script>

<style scoped>
.power-schedule {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-title h2 {
  margin: 0;
  font-size: 1.5rem;
}

.action-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.day-tag {
  margin: 2px;
}
</style>
