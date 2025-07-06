<template>
  <el-card class="terminal-view">
    <template #header>
      <h2>Terminal Webowy</h2>
    </template>
    <XTerminal />
  </el-card>
</template>

<script setup>
import XTerminal from '@/components/system/Terminal/XTerminal.vue'
</script>
