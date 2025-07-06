<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ filename }}</h3>
        <div class="header-actions">
          <button class="icon-btn" @click="toggleDarkMode" title="Toggle theme">
            <Icon :icon="darkMode ? 'radix-icons:sun' : 'radix-icons:moon'" />
          </button>
          <button class="icon-btn close-btn" @click="close" title="Close">
            <Icon icon="radix-icons:cross-1" />
          </button>
        </div>
      </div>
      
      <div class="editor-container" ref="editorContainer"></div>
      
      <div class="modal-footer">
        <div class="file-info">
          <span>Lines: {{ lineCount }}</span>
          <span>Size: {{ fileSize }}</span>
          <span>Language: {{ currentLanguage }}</span>
        </div>
        <div class="footer-actions">
          <button class="btn btn-secondary" @click="close">
            Cancel
          </button>
          <button class="btn btn-primary" @click="save">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap } from '@codemirror/commands'
import { history, redo, undo } from '@codemirror/commands'
import { highlightActiveLine } from '@codemirror/view'

const props = defineProps({
  filename: String,
  content: String
})

const emit = defineEmits(['save', 'close'])
const editorContainer = ref(null)
const editorView = ref(null)
const darkMode = ref(false)

const languages = {
  js: javascript(),
  ts: javascript(),
  html: html(),
  css: css(),
  json: json(),
  py: python()
}

const currentLanguage = computed(() => {
  const ext = props.filename.split('.').pop().toLowerCase()
  return ext in languages ? ext : 'text'
})

const setupExtensions = computed(() => [
  lineNumbers(),
  highlightActiveLine(),
  history(),
  languages[currentLanguage.value] || [],
  keymap.of([
    ...defaultKeymap,
    { key: "Mod-z", run: undo },
    { key: "Mod-y", run: redo }
  ]),
  darkMode.value ? oneDark : EditorView.theme({
    "&": {
      backgroundColor: "#fff"
    },
    ".cm-content": {
      caretColor: "#000"
    }
  }),
  EditorView.lineWrapping,
  EditorView.updateListener.of(update => {
    if (update.docChanged) {
      // Update statistics
    }
  })
])

const lineCount = computed(() => {
  return editorView.value?.state.doc.lines || 0
})

const fileSize = computed(() => {
  const content = editorView.value?.state.doc.toString() || ''
  const bytes = new Blob([content]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

onMounted(() => {
  editorView.value = new EditorView({
    state: EditorState.create({
      doc: props.content,
      extensions: setupExtensions.value
    }),
    parent: editorContainer.value
  })
})

onBeforeUnmount(() => {
  editorView.value?.destroy()
})

const toggleDarkMode = () => {
  darkMode.value = !darkMode.value
  // Recreate editor with new theme
  const content = editorView.value.state.doc.toString()
  editorView.value.destroy()
  editorView.value = new EditorView({
    state: EditorState.create({
      doc: content,
      extensions: setupExtensions.value
    }),
    parent: editorContainer.value
  })
}

const save = () => {
  const content = editorView.value.state.doc.toString()
  emit('save', content)
}

const close = () => emit('close')
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 80%;
  max-width: 1000px;
  max-height: 90vh;
  background-color: var(--modal-bg, #ffffff);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 12px 16px;
  background-color: var(--header-bg, #f5f5f5);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.editor-container {
  flex: 1;
  min-height: 300px;
  max-height: 60vh;
  overflow: auto;
  position: relative;
}

:deep(.cm-editor) {
  height: 100%;
  font-size: 14px;
  font-family: 'Fira Code', monospace;
}

:deep(.cm-scroller) {
  overflow: auto;
}

:deep(.cm-gutters) {
  background-color: var(--gutter-bg, #f5f5f5);
  border-right: 1px solid var(--gutter-border, #ddd);
}

:deep(.cm-lineNumbers .cm-gutterElement) {
  padding: 0 8px;
  color: var(--gutter-color, #999);
}

.modal-footer {
  padding: 12px 16px;
  background-color: var(--footer-bg, #f5f5f5);
  border-top: 1px solid var(--border-color, #e0e0e0);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background-color: var(--primary, #3b82f6);
  color: white;
  border: none;
}

.btn-primary:hover {
  background-color: var(--primary-hover, #2563eb);
}

.btn-secondary {
  background-color: transparent;
  border: 1px solid var(--border-color, #e0e0e0);
  color: var(--text-primary, #333333);
}

.btn-secondary:hover {
  background-color: var(--hover-bg, #f0f0f0);
}

.file-info {
  font-size: 0.85rem;
  color: var(--text-secondary, #666);
  display: flex;
  gap: 16px;
}

.icon-btn {
  background: none;
  border: none;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary, #333333);
}

.icon-btn:hover {
  background-color: var(--hover-bg, #e0e0e0);
}

.close-btn:hover {
  color: #ef4444;
}

/* Dark mode styles */
.dark .modal-content {
  --modal-bg: #1e1e1e;
  --header-bg: #252526;
  --footer-bg: #252526;
  --border-color: #444;
  --text-primary: #e0e0e0;
  --text-secondary: #aaa;
  --gutter-bg: #252526;
  --gutter-border: #444;
  --gutter-color: #777;
}
</style>
