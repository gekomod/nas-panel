<template>
  <div>
    <div 
      v-for="node in nodes" 
      :key="node.path"
      class="tree-node"
      :style="{ 'padding-left': (depth * 15) + 'px' }"
    >
      <div 
        class="tree-item"
        :class="{ 
          'active': currentPath === node.path,
          'has-children': node.children && node.children.length
        }"
        @click="toggleExpand(node)"
      >
        <Icon 
          :icon="node.expanded ? 'mdi:chevron-down' : 'mdi:chevron-right'" 
          v-if="node.children && node.children.length"
          class="expand-icon"
        />
        <Icon :icon="'mdi:folder'" />
        <span @click.stop="navigate(node.path)">{{ node.name }}</span>
      </div>
      
      <DirectoryTree 
        v-if="node.expanded && node.children && node.children.length"
        :nodes="node.children"
        :current-path="currentPath"
        :depth="depth + 1"
        @navigate="navigate"
      />
    </div>
  </div>
</template>

<script>
import { Icon } from '@iconify/vue';

export default {
  name: 'DirectoryTree',
  components: {
    Icon
  },
  props: {
    nodes: {
      type: Array,
      required: true
    },
    currentPath: {
      type: String,
      required: true
    },
    depth: {
      type: Number,
      default: 0
    }
  },
  methods: {
    toggleExpand(node) {
      if (node.children && node.children.length) {
        node.expanded = !node.expanded;
      } else {
        this.navigate(node.path);
      }
    },
    navigate(path) {
      this.$emit('navigate', path);
    }
  }
};
</script>

<style scoped>
.tree-node {
  user-select: none;
}

.tree-item {
  padding: 6px 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
}

.tree-item:hover {
  background: #e0e0e0;
}

.tree-item.active {
  background: #e3f2fd;
  color: #1976d2;
}

.expand-icon {
  width: 16px;
  height: 16px;
  margin-right: 5px;
}
</style>
