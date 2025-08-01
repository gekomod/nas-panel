<template>
  <div class="home-view">
    <div class="header">
      <h1 class="page-title">{{ $t('home.title') }}</h1>
      <el-button 
        type="primary" 
        @click="openWidgetManager"
        :icon="ElIconSetting"
      >
        {{ $t('home.manageWidgets') }}
      </el-button>
    </div>

    <!-- Widget Manager Dialog -->
    <el-dialog
      v-model="widgetManagerVisible"
      :title="$t('home.widgetManager.title')"
      width="70%"
    >
      <el-table :data="allWidgets" style="width: 100%">
        <el-table-column prop="name" :label="$t('home.widgetManager.widgetName')" width="180">
          <template #default="{row}">
            <span :class="{'disabled-widget': !row.enabled}">
              {{ row.displayName || row.name }}
            </span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('home.widgetManager.status')" width="120">
          <template #default="{row}">
            <el-tag :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? $t('home.widgetManager.enabled') : $t('home.widgetManager.disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('home.widgetManager.actions')">
          <template #default="{row}">
    <el-switch
      v-model="row.enabled"
      @change="() => handleWidgetToggle(row)"
      active-color="#13ce66"
      inactive-color="#ff4949"
      :active-value="1"
      :inactive-value="0"
      inline-prompt
    />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="widgetManagerVisible = false">{{ $t('home.widgetManager.cancel') }}</el-button>
        <el-button type="primary" @click="saveWidgetSettings">{{ $t('home.widgetManager.saveChanges') }}</el-button>
      </template>
    </el-dialog>

    <!-- Wyświetlanie widgetów -->
    <div class="widgets-container">
      <div 
        v-for="widget in activeWidgets" 
        :key="widget.name"
        class="widget-wrapper"
      >
        <component :is="widget.component" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, shallowRef, computed, onMounted, markRaw } from 'vue';
import { 
  initDatabase, 
  getDB,
  query, 
  executeSQL, 
  saveDatabaseState,
  loadDatabaseState 
} from '@/database/sqlite-service';
import { ElButton, ElDialog, ElTable, ElTableColumn, ElTag, ElSwitch, ElNotification } from 'element-plus';
import { Setting as ElIconSetting } from '@element-plus/icons-vue';

const widgetManagerVisible = ref(false);
const allWidgets = ref([]);
const isInitialLoad = ref(true); // Nowa flaga do śledzenia pierwszego ładowania

const openWidgetManager = () => {
  widgetManagerVisible.value = true;
  if (isInitialLoad.value) {
    loadWidgets();
    isInitialLoad.value = false;
  }
};

const loadWidgets = async () => {
  try {
    await initDatabase();
    
    const dbWidgets = await query("SELECT name, enabled, position FROM widgets ORDER BY position");
    const widgetModules = import.meta.glob('@/components/Dashboard/*.vue');
    const loadedWidgets = [];
    
    for (const path in widgetModules) {
      const widgetName = path.split('/').pop().replace('.vue', '');
      const module = await widgetModules[path]();
      const dbWidget = dbWidgets.find(w => w.name === widgetName) || {
        name: widgetName,
        enabled: false,
        position: loadedWidgets.length
      };
      
      loadedWidgets.push({
        ...dbWidget,
        component: markRaw(module.default),
        displayName: module.default.displayName || widgetName
      });
    }
    
    if (allWidgets.value.length > 0) {
      const updatedWidgets = allWidgets.value.map(existingWidget => {
        const newWidgetData = loadedWidgets.find(w => w.name === existingWidget.name);
        return newWidgetData ? { ...existingWidget, ...newWidgetData } : existingWidget;
      });
      
      loadedWidgets.forEach(newWidget => {
        if (!updatedWidgets.some(w => w.name === newWidget.name)) {
          updatedWidgets.push(newWidget);
        }
	      });
      
      allWidgets.value = updatedWidgets.sort((a, b) => (a.position || 0) - (b.position || 0));
    } else {
      allWidgets.value = loadedWidgets.sort((a, b) => (a.position || 0) - (b.position || 0));
    }
    
  } catch (error) {
    ElNotification.error({
      title: 'Błąd',
      message: 'Widget loading failed',
      duration: 5000
    });
    const fallback = JSON.parse(localStorage.getItem('widgets_fallback') || '[]');
    allWidgets.value = fallback;
  }
};

const saveWidgetSettings = async () => {
  try {
    if (!allWidgets.value?.length) {
      //console.warn('No widgets to save');
      return;
    }

    if (!getDB) {
      await initDatabase();
    }

    await executeSQL("BEGIN TRANSACTION");
    await executeSQL("DELETE FROM widgets");
    
    for (const widget of allWidgets.value) {
      if (!widget.name) continue;
      
      await executeSQL(
        "INSERT OR REPLACE INTO widgets (name, enabled, position) VALUES (?, ?, ?)",
        [widget.name, widget.enabled ? 1 : 0, widget.position || 0]
      );
    }
    
    await executeSQL("COMMIT");
    const saveResult = saveDatabaseState();
    
    ElNotification.success({
      title: 'Sukces',
      message: 'Ustawienia widgetów zostały zapisane',
      duration: 3000
    });

  } catch (error) {
    //console.error('Widget save failed:', error);
    await executeSQL("ROLLBACK");
  }
};

const activeWidgets = computed(() => 
  allWidgets.value.filter(widget => widget.enabled)
);

const handleWidgetToggle = (widget) => {
  console.log(`Widget ${widget.name} zmieniono na: ${widget.enabled ? 'włączony' : 'wyłączony'}`);
};

onMounted(() => {
  loadWidgets();
});
</script>

<style scoped>
.home-view {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.widgets-container {
    column-count: 4;          /* 4 kolumny */
    column-gap: 20px;        /* odstęp między kolumnami */
    width: 100%;
  align-items: start; /* Ważne dla różnych wysokości */
}

.widget-content {
  transition: all 0.3s ease;
}

.disabled-widget {
  color: #999;
  text-decoration: line-through;
}
.widget-wrapper {
  background: var(--card-bg);
  border-radius: 16px;
  box-shadow: var(--card-shadow);
  border: var(--card-border);
  transition: var(--transition);
  }


.disabled-widget {
  color: var(--text-light);
  text-decoration: line-through;
}
.widget-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100px; /* Minimalna wysokość */
  max-height: 80vh; /* Maksymalna wysokość przed pojawieniem się scrolla */
  overflow: hidden; /* Ukryj domyślne przewijanie */
}

.widget-wrapper > * {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto; /* Włącz przewijanie tylko gdy potrzebne */
}
</style>
