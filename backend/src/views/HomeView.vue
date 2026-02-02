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
      <el-table 
        :data="allWidgets" 
        style="width: 100%"
        row-key="name"
        class="widget-manager-table"
      >
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
              @change="handleWidgetToggle(row)"
              active-color="#13ce66"
              inactive-color="#ff4949"
            />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="widgetManagerVisible = false">{{ $t('home.widgetManager.cancel') }}</el-button>
        <el-button type="primary" @click="saveWidgetSettings">{{ $t('home.widgetManager.saveChanges') }}</el-button>
      </template>
    </el-dialog>

    <!-- Main widgets display with drag and drop -->
    <draggable 
      v-model="enabledWidgets"
      class="widgets-container"
      item-key="name"
      @end="saveWidgetPositions"
    >
      <template #item="{element}">
        <div class="widget-wrapper">
          <component :is="element.component" />
        </div>
      </template>
    </draggable>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, computed, onMounted, markRaw } from 'vue';
import { ElButton, ElDialog, ElTable, ElTableColumn, ElTag, ElSwitch, ElNotification } from 'element-plus';
import { Setting as ElIconSetting } from '@element-plus/icons-vue';
import draggable from 'vuedraggable';

const widgetManagerVisible = ref(false);
const allWidgets = ref([]);
const enabledWidgets = ref([]);

// Klucz dla localStorage
const WIDGETS_STORAGE_KEY = 'dashboard_widgets_settings';

const openWidgetManager = () => {
  widgetManagerVisible.value = true;
  if (allWidgets.value.length === 0) {
    loadWidgets();
  }
};

const loadWidgets = async () => {
  try {
    // Wczytaj zapisane ustawienia z localStorage
    const savedSettings = JSON.parse(localStorage.getItem(WIDGETS_STORAGE_KEY) || '{}');
    
    // Dynamicznie importuj wszystkie komponenty z folderu Dashboard
    const widgetModules = import.meta.glob('@/components/Dashboard/*.vue');
    
    const loadedWidgets = [];
    
    for (const path in widgetModules) {
      const widgetName = path.split('/').pop().replace('.vue', '');
      
      // Załaduj komponent
      const module = await widgetModules[path]();
      
      // Pobierz zapisane ustawienia lub użyj domyślnych
      const widgetSettings = savedSettings[widgetName] || {
        enabled: true, // domyślnie włączony
        position: loadedWidgets.length,
        displayName: module.default.displayName || widgetName
      };
      
      loadedWidgets.push({
        name: widgetName,
        component: markRaw(module.default),
        displayName: module.default.displayName || widgetName,
        enabled: widgetSettings.enabled,
        position: widgetSettings.position || loadedWidgets.length
      });
    }
    
    // Posortuj według pozycji
    allWidgets.value = loadedWidgets.sort((a, b) => a.position - b.position);
    updateEnabledWidgets();
    
  } catch (error) {
    console.error('Widget loading failed:', error);
    ElNotification.error({
      title: 'Błąd',
      message: 'Nie udało się załadować widgetów',
      duration: 5000
    });
  }
};

const updateEnabledWidgets = () => {
  enabledWidgets.value = allWidgets.value
    .filter(w => w.enabled)
    .sort((a, b) => a.position - b.position);
};

const saveWidgetPositions = () => {
  // Aktualizuj pozycje na podstawie bieżącej kolejności
  enabledWidgets.value.forEach((widget, index) => {
    const originalWidget = allWidgets.value.find(w => w.name === widget.name);
    if (originalWidget) {
      originalWidget.position = index;
    }
  });
  
  // Zaktualizuj pozycje pozostałych widgetów
  allWidgets.value
    .filter(w => !w.enabled)
    .forEach((widget, index) => {
      widget.position = enabledWidgets.value.length + index;
    });
    
  saveWidgetSettings();
};

const saveWidgetSettings = () => {
  try {
    // Przygotuj obiekt do zapisania
    const settingsToSave = {};
    allWidgets.value.forEach(widget => {
      settingsToSave[widget.name] = {
        enabled: widget.enabled,
        position: widget.position,
        displayName: widget.displayName
      };
    });
    
    // Zapisz w localStorage
    localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(settingsToSave));
    
    updateEnabledWidgets();
    
    ElNotification.success({
      title: 'Sukces',
      message: 'Ustawienia widgetów zostały zapisane',
      duration: 3000
    });
    
    widgetManagerVisible.value = false;
    
  } catch (error) {
    console.error('Widget save failed:', error);
    ElNotification.error({
      title: 'Błąd',
      message: 'Nie udało się zapisać ustawień',
      duration: 5000
    });
  }
};

const handleWidgetToggle = (widget) => {
  // Automatycznie zapisz przy zmianie
  saveWidgetSettings();
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
  column-count: 4;
  column-gap: 20px;
  width: 100%;
}

.widget-wrapper {
  background: var(--card-bg);
  border-radius: 16px;
  box-shadow: var(--card-shadow);
  border: var(--card-border);
  transition: var(--transition);
  display: inline-block;
  width: 100%;
  margin-bottom: 20px;
  break-inside: avoid;
}

.disabled-widget {
  color: var(--text-light);
  text-decoration: line-through;
}

.widget-manager-table {
  margin-bottom: 20px;
}

/* Responsywność */
@media (max-width: 1200px) {
  .widgets-container {
    column-count: 3;
  }
}

@media (max-width: 900px) {
  .widgets-container {
    column-count: 2;
  }
}

@media (max-width: 600px) {
  .widgets-container {
    column-count: 1;
  }
  
  .header {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
}
</style>
