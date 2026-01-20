<template>
  <el-dialog 
    :model-value="props.visible" 
    @update:model-value="$emit('update:visible', $event)"
    title="Install Docker" 
    width="50%"
    :before-close="handleClose"
  >
    <el-steps :active="activeStep" finish-status="success" align-center>
      <el-step title="Preparation" />
      <el-step title="Installation" />
      <el-step title="Completion" />
    </el-steps>

    <div v-if="activeStep === 0" class="step-content">
      <h3>System Requirements</h3>
      <ul>
        <li>Ubuntu 20.04/22.04 or Debian 10/11</li>
        <li>64-bit architecture</li>
        <li>Minimum 2GB RAM (4GB recommended)</li>
        <li>At least 10GB free disk space</li>
      </ul>
    </div>

    <div v-else-if="activeStep === 1" class="step-content">
      <el-progress :percentage="progress" :status="progressStatus" />
      <div class="current-step">
        <h4>{{ currentStep }}</h4>
        <pre class="log-output">{{ logOutput }}</pre>
      </div>
    </div>

    <div v-else class="step-content">
      <el-result
        v-if="installationSuccess"
        icon="success"
        title="Installation Complete"
      >
        <template #extra>
          <el-button type="primary" @click="finishInstallation">
            Finish
          </el-button>
        </template>
      </el-result>

      <el-result
        v-else
        icon="error"
        title="Installation Failed"
        :sub-title="error"
      >
        <template #extra>
          <el-button type="primary" @click="retryInstallation">
            Retry
          </el-button>
        </template>
      </el-result>
    </div>

    <template #footer>
      <el-button
        v-if="activeStep > 0 && activeStep < 2 && !isInstalling"
        @click="activeStep--"
      >
        Back
      </el-button>
      <el-button
        v-if="activeStep === 0"
        type="primary"
        @click="startInstallation"
        :loading="isInstalling"
      >
        Begin Installation
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const props = defineProps({
  visible: Boolean
});

const emit = defineEmits(['update:visible', 'installed']);

const activeStep = ref(0);
const progress = ref(0);
const progressStatus = ref('');
const currentStep = ref('');
const logOutput = ref('');
const error = ref('');
const isInstalling = ref(false);
const installationSuccess = ref(false);

const installationSteps = [
  'Updating packages...',
  'Installing dependencies...',
  'Adding Docker GPG key...',
  'Adding Docker repository...',
  'Installing Docker Engine...',
  'Enabling Docker service...',
  'Starting Docker service...',
  'Verifying installation...'
];

const startInstallation = async () => {
  activeStep.value = 1;
  isInstalling.value = true;
  error.value = '';
  logOutput.value = '';
  installationSuccess.value = false;

  try {
    const response = await axios.post('/services/docker/install');
    logOutput.value = response.data.output;
    progress.value = 100;
    progressStatus.value = 'success';
    installationSuccess.value = true;
    activeStep.value = 2;
  } catch (err) {
    error.value = err.response?.data?.error || 'Installation failed';
    logOutput.value = err.response?.data?.details || err.message;
    progressStatus.value = 'exception';
    activeStep.value = 2;
  } finally {
    isInstalling.value = false;
  }
};

const retryInstallation = () => {
  activeStep.value = 0;
  progress.value = 0;
  progressStatus.value = '';
  error.value = '';
};

const finishInstallation = () => {
  emit('installed');
  emit('update:visible', false);
};

const handleClose = (done) => {
  if (isInstalling.value) {
    ElMessage.warning('Installation in progress. Please wait or cancel the operation.');
    return;
  }
  done();
  emit('update:visible', false);
};
</script>

<style scoped>
.step-content {
  padding: 20px;
  min-height: 200px;
}

.current-step {
  margin-top: 20px;
}

.log-output {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  max-height: 200px;
  overflow: auto;
  font-family: monospace;
}
</style>
