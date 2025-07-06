<template>
  <el-table :data="tests" style="width: 100%">
    <el-table-column prop="date" label="Data" width="180" />
    <el-table-column prop="type" label="Typ testu" width="150" />
    <el-table-column prop="status" label="Status" width="120">
      <template #default="{ row }">
        <el-tag :type="row.status === 'Completed' ? 'success' : 'warning'">
          {{ row.status }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="remaining" label="Pozostało" width="100" />
    <el-table-column prop="lifetime" label="Godziny pracy" />
    <el-table-column label="Akcje" width="120">
      <template #default="{ row }">
        <el-button size="small" @click="showTestDetails(row)">
          Szczegóły
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup>
defineProps({
  tests: {
    type: Array,
    required: true
  }
})

const showTestDetails = (test) => {
  console.log('Show test details:', test)
}
</script>
