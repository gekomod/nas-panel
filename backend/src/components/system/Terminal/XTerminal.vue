<template>
  <div ref="terminalContainer" class="xterminal"></div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Terminal } from 'xterm'
import 'xterm/css/xterm.css'

const terminalContainer = ref(null)
const term = new Terminal({
  cursorBlink: true,
  theme: { background: '#1E1E1E' }
})

onMounted(() => {
  term.open(terminalContainer.value)
  term.write('Witaj w terminalu QNAP-like!$\x1B[1;3;31m $\x1B[0m')
  
  // Symulacja komend (w prawdziwej aplikacji podłącz WebSocket do backendu)
  term.onData(data => {
    term.write(data)
    if (data === '\r') term.write('\n$ ')
  })
})
</script>

<style scoped>
.xterminal {
  padding: 10px;
  height: 400px;
  background: #1E1E1E;
  border-radius: 4px;
}
</style>
