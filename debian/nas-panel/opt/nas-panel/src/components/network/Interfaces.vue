<template>
  <div class="interfaces-container">
    <div class="header">
      <h2>
        <Icon icon="mdi:ethernet-cable" width="24" class="header-icon" />
        {{ $t('network.interfaces.title') }}  
      </h2>
      
      <div class="actions">
	      <el-button type="primary" @click="showAddInterfaceDialog" class="add-button">
		<Icon icon="mdi:plus" width="18" class="button-icon" />
		{{ $t('network.interfaces.add_interface') }}
	      </el-button>
	      <el-button type="primary" @click="refreshInterfaces" class="refresh-button">
		<Icon icon="mdi:refresh" width="18" class="button-icon" />
		{{ $t('network.interfaces.refresh') }}
	      </el-button>
      </div>
    </div>
    
    <el-dialog v-model="addDialogVisible" :title="$t('network.interfaces.add_interface')" width="500px">
      <el-form :model="newInterfaceForm" :rules="interfaceRules" ref="addInterfaceForm">
        <el-form-item :label="$t('network.interfaces.interface_name')" prop="name">
          <el-input v-model="newInterfaceForm.name" placeholder="np. eth1"></el-input>
        </el-form-item>
        
        <el-form-item :label="$t('network.interfaces.interface_type')" prop="type">
          <el-select v-model="newInterfaceForm.type" class="w-full">
            <el-option 
              v-for="type in interfaceTypes" 
              :key="type.value" 
              :label="type.label" 
              :value="type.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="addDialogVisible = false">
          {{ $t('cancel') }}
        </el-button>
        <el-button type="primary" @click="addNewInterface" :loading="addingInterface">
          {{ $t('confirm') }}
        </el-button>
      </template>
    </el-dialog>

    <el-card class="interfaces-card" shadow="hover">
      <el-table :data="interfaces" v-loading="loading" class="interfaces-table" stripe>
        <el-table-column prop="device" :label="$t('network.interfaces.device')">
          <template #default="{ row }">
            <Icon 
              :icon="row.type === 'ethernet' ? 'mdi:ethernet-cable' : 'mdi:wifi'" 
              width="20" 
              class="device-icon" 
            />
            {{ row.device }}
          </template>
        </el-table-column>
        
        <el-table-column prop="method" :label="$t('network.interfaces.method')">
          <template #default="{ row }">
            <el-tag :type="row.method === 'dhcp' ? 'primary' : 'success'" size="small">
              {{ row.method }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="address" :label="$t('network.interfaces.address')" />
        <el-table-column prop="netmask" :label="$t('network.interfaces.netmask')" />
        <el-table-column prop="status" :label="$t('network.interfaces.status')">
          <template #default="{ row }">
            <el-tag :type="row.status === 'up' ? 'success' : 'danger'" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        
    <el-table-column :label="$t('network.interfaces.actions')" width="150" align="center" header-align="center">
      <template #default="{ row }">
        <div class="action-buttons">
          <el-tooltip effect="dark" :content="$t('network.interfaces.details')" placement="top">
            <el-button 
              size="small" 
              circle 
              @click="showDetails(row.device)"
              class="action-button"
            >
              <Icon icon="mdi:information-outline" width="16" />
            </el-button>
          </el-tooltip>
          
          <el-tooltip 
            effect="dark" 
            :content="$t('network.interfaces.delete')" 
            placement="top"
            :disabled="row.device === 'eth0' || row.device === 'lo'"
          >
            <el-button
              size="small"
              circle
              type="danger"
              @click="confirmDeleteInterface(row.device)"
              :disabled="row.device === 'eth0' || row.device === 'lo'"
              class="action-button"
            >
              <Icon icon="mdi:delete" width="16" />
            </el-button>
          </el-tooltip>
        </div>
      </template>
    </el-table-column>
    
      </el-table>
    </el-card>
    
    <el-dialog v-model="deleteDialogVisible" :title="$t('network.interfaces.delete_interface')" width="400px">
      <p>{{ $t('network.interfaces.delete_confirm', { interface: interfaceToDelete }) }}</p>
      <template #footer>
        <el-button @click="deleteDialogVisible = false">
          {{ $t('network.interfaces.cancel') }}
        </el-button>
        <el-button type="danger" @click="deleteInterface" :loading="deletingInterface">
          {{ $t('network.interfaces.confirm') }}
        </el-button>
      </template>
    </el-dialog>
    
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElMessage, ElNotification } from 'element-plus'

const router = useRouter()
const interfaces = ref([])
const loading = ref(false)
const addDialogVisible = ref(false)
const addingInterface = ref(false)
const addInterfaceForm = ref(null)

const deleteDialogVisible = ref(false)
const interfaceToDelete = ref('')
const deletingInterface = ref(false)

const newInterfaceForm = reactive({
  name: '',
  type: 'ethernet'
})

const interfaceTypes = [
  { value: 'ethernet', label: 'Ethernet' },
  { value: 'bridge', label: 'Most (Bridge)' },
  { value: 'vlan', label: 'VLAN' },
  { value: 'bond', label: 'Bonding' }
]

const interfaceRules = {
  name: [
    { required: true, message: 'Nazwa interfejsu jest wymagana', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9]+$/, message: 'Nieprawidłowa nazwa interfejsu', trigger: 'blur' }
  ],
  type: [
    { required: true, message: 'Typ interfejsu jest wymagany', trigger: 'change' }
  ]
}

const showAddInterfaceDialog = () => {
  addDialogVisible.value = true
}

const confirmDeleteInterface = (interfaceName) => {
  interfaceToDelete.value = interfaceName
  deleteDialogVisible.value = true
}

const addNewInterface = async () => {
  try {
    await addInterfaceForm.value.validate()
    addingInterface.value = true
    
    const response = await axios.post('/network/interfaces/add', {
      name: newInterfaceForm.name,
      type: newInterfaceForm.type
    })
    
    ElNotification({
      title: 'Sukces',
      message: `Interfejs ${newInterfaceForm.name} został dodany`,
      type: 'success'
    })
    
    addDialogVisible.value = false
    refreshInterfaces()
  } catch (error) {
    console.error('Błąd dodawania interfejsu:', error)
    ElMessage.error(error.response?.data?.message || 'Błąd podczas dodawania interfejsu')
  } finally {
    addingInterface.value = false
  }
}

const deleteInterface = async () => {
  try {
    deletingInterface.value = true
    const response = await axios.delete(`/network/interfaces/remove/${interfaceToDelete.value}`)
    
    ElNotification({
      title: 'Sukces',
      message: response.data.message,
      type: 'success'
    })
    
    deleteDialogVisible.value = false
    refreshInterfaces()
  } catch (error) {
    console.error('Błąd usuwania interfejsu:', error)
    ElMessage.error(error.response?.data?.message || 'Błąd podczas usuwania interfejsu')
  } finally {
    deletingInterface.value = false
  }
}

const fetchInterfaces = async () => {
  try {
    loading.value = true
    const response = await axios.get('/network/interfaces')
    interfaces.value = response.data
  } catch (error) {
    console.error('Failed to fetch interfaces:', error)
    ElNotification({
      title: 'Error',
      message: 'Failed to load network interfaces',
      type: 'error'
    })
  } finally {
    loading.value = false
  }
}

const refreshInterfaces = () => {
  fetchInterfaces()
}

const showDetails = (device) => {
  router.push(`/network/interfaces/details/${device}`)
}

onMounted(() => {
  fetchInterfaces()
})
</script>

<style scoped>
.interfaces-container {
  padding: 24px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-icon {
  margin-right: 12px;
  vertical-align: middle;
}

.refresh-button {
  text-transform: none;
}

.button-icon {
  margin-right: 8px;
}

.interfaces-card {
  border-radius: 8px;
}

.device-icon {
  margin-right: 8px;
  vertical-align: middle;
}

.actions {
  display: flex;
  gap: 12px;
}

.w-full {
  width: 100%;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
}

.action-button {
  margin: 0;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.el-table .cell) {
  padding: 0 8px;
}

.action-button:hover {
  transform: scale(1.1);
}

@media (max-width: 768px) {
  .interfaces-table {
    width: 100%;
    overflow-x: auto;
  }
}
</style>
