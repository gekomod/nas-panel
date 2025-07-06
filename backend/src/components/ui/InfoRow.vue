<template>
  <div class="info-row">
    <span class="label">{{ label }}:</span>
    <el-tag :type="type === 'default' ? undefined : type" size="small" class="value">
      {{ value }}
    </el-tag>
  </div>
</template>

<script setup>
defineProps({
  label: String,
  value: [String, Number],
  type: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'primary', 'success', 'info', 'warning', 'danger'].includes(value)
  }
})
</script>
