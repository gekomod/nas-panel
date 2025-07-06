<template>
  <el-card class="app-card" shadow="hover">
    <template #header>
      <div class="app-header">
        <el-icon :size="30" :color="iconColor"><component :is="icon" /></el-icon>
        <h3>{{ title }}</h3>
      </div>
    </template>
    <p>{{ description }}</p>
    <el-button type="primary" @click="launchApp">Uruchom</el-button>
  </el-card>
</template>

<script setup>
defineProps({
  title: String,
  description: String,
  icon: Object,
  iconColor: String
})

const launchApp = () => {
  alert('Aplikacja uruchomiona!')
}
</script>

<style scoped>
.app-card {
  margin: 10px;
  width: 250px;
}
.app-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
