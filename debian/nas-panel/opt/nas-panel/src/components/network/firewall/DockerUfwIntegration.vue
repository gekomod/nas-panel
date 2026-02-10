<template>

    <div class="docker-ufw-content">
      <el-alert v-if="!dockerStatus.docker.installed" type="warning" title="Docker nie jest zainstalowany" show-icon>
        <p>Aby korzystać z integracji Docker-UFW, musisz zainstalować Dockera.</p>
      </el-alert>

      <el-alert v-else-if="!dockerStatus.docker.running" type="warning" title="Docker nie jest uruchomiony" show-icon>
        <p>Usługa Docker nie jest aktywna. Uruchom: <code>sudo systemctl start docker</code></p>
      </el-alert>

      <template v-else>
        <div class="status-section">
          <el-tag :type="dockerStatus.ufwDocker.installed ? 'success' : 'warning'">
            ufw-docker: {{ dockerStatus.ufwDocker.installed ? 'Zainstalowany' : 'Nie zainstalowany' }}
          </el-tag>

          <el-button 
            v-if="!dockerStatus.ufwDocker.installed" 
            type="primary" 
            size="small" 
            @click="installUfwDocker"
            :loading="installingUfwDocker"
          >
            <Icon icon="mdi:download" width="16" />
            Zainstaluj ufw-docker
          </el-button>
        </div>

        <el-tabs v-if="dockerStatus.ufwDocker.installed" type="border-card">
          <el-tab-pane label="Kontenery">
            <el-table :data="containers" v-loading="loadingContainers">
              <el-table-column prop="name" label="Nazwa kontenera" />
              <el-table-column prop="image" label="Obraz" />
              <el-table-column label="Porty" width="200">
                <template #default="{ row }">
                  <el-tag 
                    v-for="port in row.exposedPorts" 
                    :key="port" 
                    size="small" 
                    class="port-tag"
                    @click="addUfwRule(row.name, port)"
                  >
                    {{ port }}/tcp
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="Akcje" width="120">
                <template #default="{ row }">
                  <el-button 
                    v-for="port in row.exposedPorts" 
                    :key="port" 
                    size="small" 
                    @click="addUfwRule(row.name, port)"
                  >
                    <Icon icon="mdi:plus" width="14" />
                    {{ port }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="Reguły UFW">
            <el-table :data="ufwDockerRules">
              <el-table-column prop="id" label="ID" width="80" />
              <el-table-column prop="target" label="Cel" />
              <el-table-column prop="port" label="Port" />
              <el-table-column label="Akcja">
                <template #default="{ row }">
                  <el-tag :type="row.action === 'allow' ? 'success' : 'danger'">
                    {{ row.action }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="comment" label="Komentarz" />
            </el-table>
          </el-tab-pane>
          
          
            <el-tab-pane label="Reguły Docker UFW" name="docker-rules">
    <el-alert v-if="ufwDockerRules.length === 0" type="info" title="Brak reguł Docker UFW" show-icon>
      <p>Nie znaleziono reguł UFW dla Docker. Możesz dodać reguły używając przycisków powyżej.</p>
      <el-button @click="debugRules" size="small">Debuguj reguły</el-button>
    </el-alert>

    <el-table v-else :data="ufwDockerRules">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="Akcja" width="100">
        <template #default="{ row }">
          <el-tag :type="row.action === 'allow' ? 'success' : 'danger'">
            {{ row.action }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="container" label="Kontener" />
      <el-table-column prop="port" label="Port" width="100" />
      <el-table-column prop="protocol" label="Protokół" width="100" />
      <el-table-column prop="comment" label="Opis" />
    </el-table>
  </el-tab-pane>
        </el-tabs>
      </template>
    </div>

</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const dockerStatus = reactive({
  docker: { installed: false, running: false },
  ufwDocker: { installed: false }
})

const containers = ref([])
const ufwDockerRules = ref([])
const loadingContainers = ref(false)
const installingUfwDocker = ref(false)

onMounted(() => {
  checkDockerStatus()
  loadContainers()
  loadUfwDockerRules()
})

const checkDockerStatus = async () => {
  try {
    const response = await axios.get('/network/docker/status')
    Object.assign(dockerStatus, response.data)
  } catch (error) {
    ElMessage.error('Błąd sprawdzania statusu Dockera')
  }
}

const installUfwDocker = async () => {
  try {
    installingUfwDocker.value = true
    const response = await axios.post('/network/docker/install-ufw-docker')
    
    if (response.data.success) {
      ElMessage.success('ufw-docker zainstalowany pomyślnie')
      dockerStatus.ufwDocker.installed = true
    } else {
      ElMessage.error('Błąd instalacji: ' + response.data.error)
    }
  } catch (error) {
    ElMessage.error('Błąd instalacji ufw-docker')
  } finally {
    installingUfwDocker.value = false
  }
}

const loadContainers = async () => {
  try {
    loadingContainers.value = true
    const response = await axios.get('/network/docker/containers')
    
    if (response.data.success) {
      containers.value = response.data.containers
    }
  } catch (error) {
    ElMessage.error('Błąd ładowania kontenerów')
  } finally {
    loadingContainers.value = false
  }
}

const loadUfwDockerRules = async () => {
  try {
    const response = await axios.get('/network/docker/ufw-rules')
    
    if (response.data.success) {
      ufwDockerRules.value = response.data.rules
    }
  } catch (error) {
    console.error('Błąd ładowania reguł UFW', error)
  }
}

const addUfwRule = async (containerName, port) => {
  try {
    const response = await axios.post('/network/docker/ufw-rule', {
      containerName,
      port,
      protocol: 'tcp'
    })
    
    if (response.data.success) {
      ElMessage.success(`Dodano regułę UFW dla ${containerName}:${port}`)
      loadUfwDockerRules()
    } else {
      ElMessage.error('Błąd: ' + response.data.error)
    }
  } catch (error) {
    ElMessage.error('Błąd dodawania reguły UFW')
  }
}

const debugRules = async () => {
  try {
    const response = await axios.get('/network/docker/debug-rules');
    console.log('Debug rules:', response.data.results);
    ElMessage.info('Dane debugowania w konsoli');
  } catch (error) {
    ElMessage.error('Błąd debugowania');
  }
};
</script>

<style scoped>
.docker-ufw-widget {
  margin-top: 20px;
}

.status-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.port-tag {
  margin: 2px;
  cursor: pointer;
}

.port-tag:hover {
  opacity: 0.8;
}
</style>
