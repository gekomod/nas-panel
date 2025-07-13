<template>
  <div class="smart-attributes-container">
    <el-table 
      :data="attributesTable" 
      style="width: 100%"
      v-loading="loading"
      empty-text="Brak danych atrybutów SMART"
    >
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="Atrybut" width="180" />
      <el-table-column prop="value" label="Wartość" width="100" align="center" />
      <el-table-column prop="worst" label="Najgorsza" width="100" align="center" />
      <el-table-column prop="thresh" label="Próg" width="100" align="center" />
      <el-table-column label="Status" width="120" align="center">
        <template #default="{ row }">
          <el-tag 
            :type="getStatusType(row)" 
            size="small"
            effect="dark"
          >
            {{ getStatusText(row) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Surowe dane">
        <template #default="{ row }">
          <el-tooltip 
            v-if="row.raw.value !== undefined" 
            :content="`Surowe dane: ${row.raw.value}`" 
            placement="top"
          >
            <span>{{ formatRawValue(row.raw.value) }}</span>
          </el-tooltip>
          <span v-else>-</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({
  attributes: {
    type: Object,
    required: true,
    default: () => ({ table: [] })
  }
})

const loading = computed(() => !props.attributes.table)

const attributesTable = computed(() => {
  if (!props.attributes?.table) return []
  return props.attributes.table.map(attr => ({
    ...attr,
    // Dodaj tłumaczenia nazw atrybutów
    name: translateAttributeName(attr.name)
  }))
})

const translateAttributeName = (name) => {
  const translations = {
    'Raw_Read_Error_Rate': 'Wskaźnik błędów odczytu',
    'Spin_Up_Time': 'Czas rozruchu',
    'Start_Stop_Count': 'Liczba start/stop',
    'Reallocated_Sector_Ct': 'Liczba realokowanych sektorów',
    'Power_On_Hours': 'Godziny pracy',
    'Power_Cycle_Count': 'Liczba cykli włączeń',
    // Dodaj więcej tłumaczeń według potrzeb
  }
  return translations[name] || name
}

const getStatusType = (row) => {
  if (row.value <= row.thresh) return 'danger'
  if ((row.value - row.thresh) < 10) return 'warning'
  return 'success'
}

const getStatusText = (row) => {
  if (row.value <= row.thresh) return t('storageSmart.status.failed')
  return t('storageSmart.status.passed')
}

const formatRawValue = (value) => {
  if (typeof value === 'number') return value.toLocaleString()
  return value || '-'
}
</script>

<style scoped>
.smart-attributes-container {
  margin-top: 20px;
}

:deep(.el-table .cell) {
  white-space: nowrap;
}
</style>
