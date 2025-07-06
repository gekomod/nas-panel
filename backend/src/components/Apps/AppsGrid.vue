<template>
  <div class="apps-grid">
    <AppCard 
      v-for="app in apps" 
      :key="app.id"
      :title="app.title"
      :description="app.description"
      :icon="app.icon"
      :icon-color="app.color"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import AppCard from './AppCard.vue'
import { Connection, Calendar, Setting } from '@element-plus/icons-vue'

const apps = ref([
  {
    id: 1,
    title: 'Container Station',
    description: 'Zarządzaj Dockerem i LXC',
    icon: Connection,
    color: '#409EFF'
  },
  {
    id: 2,
    title: 'Kalendarz',
    description: 'Planowanie zadań',
    icon: Calendar,
    color: '#67C23A'
  },
  {
    id: 3,
    title: 'Ustawienia',
    description: 'Konfiguracja systemu',
    icon: Setting,
    color: '#E6A23C'
  }
])
</script>

<style scoped>
.apps-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}
</style>
