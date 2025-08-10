<template>
  <div class="docker-backup">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>Backup & Restore</span>
        </div>
      </template>
      
      <el-tabs v-model="activeTab">
        <el-tab-pane label="Backup" name="backup">
          <el-form label-width="200px">
            <el-form-item label="Backup Frequency">
              <el-select v-model="cronExpression">
                <el-option 
                  v-for="option in frequencyOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="Backup Location">
              <el-input v-model="backupLocation" placeholder="/path/to/backup" />
            </el-form-item>
            <el-form-item label="Include">
              <el-checkbox-group v-model="backupIncludes">
                <el-checkbox label="compose" value="compose">Compose Files</el-checkbox>
                <el-checkbox label="volumes" value="volumes">Volumes</el-checkbox>
                <el-checkbox label="config" value="config">Configuration</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="runBackup">Run Backup Now</el-button>
              <el-button @click="scheduleBackup">Schedule Backup</el-button>
            </el-form-item>
          </el-form>
          
          <el-divider />
          
          <h3>Scheduled Backups</h3>
          <el-table :data="scheduledJobs" style="width: 100%">
            <el-table-column prop="id" label="ID" width="180" />
            <el-table-column label="Schedule">
              <template #default="{row}">
                {{ frequencyOptions.find(opt => opt.value === row.schedule)?.label || row.schedule }}
              </template>
            </el-table-column>
            <el-table-column prop="nextRun" label="Next Run" />
            <el-table-column label="Actions" width="120">
              <template #default="{row}">
                <el-button type="danger" size="small" @click="removeScheduledJob(row.id)">
                  Remove
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        
        <el-tab-pane label="Restore" name="restore">
          <el-table :data="backupFiles" style="width: 100%">
            <el-table-column prop="name" label="File" />
            <el-table-column prop="date" label="Date" width="180" />
            <el-table-column prop="size" label="Size" width="120" />
            <el-table-column label="Actions" width="120">
              <template #default="{row}">
                <el-button type="primary" size="small" @click="restoreBackup(row)">Restore</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  data() {
    return {
      activeTab: 'backup',
      backupFrequency: 'weekly',
      backupLocation: '/var/backups/docker',
      backupIncludes: ['compose', 'volumes', 'config'],
      backupFiles: [],
      scheduledJobs: [],
      cronExpression: '0 2 * * *', // Default: daily at 2am
      frequencyOptions: [
        { label: 'Daily (2:00 AM)', value: '0 2 * * *' },
        { label: 'Weekly (Monday 2:00 AM)', value: '0 2 * * 1' },
        { label: 'Monthly (1st 2:00 AM)', value: '0 2 1 * *' },
        { label: 'Custom', value: 'custom' }
      ]
    };
  },
  computed: {
    frequencyLabel() {
      const option = this.frequencyOptions.find(opt => opt.value === this.cronExpression);
      return option ? option.label : 'Custom';
    }
  },
  methods: {
    async runBackup() {
      try {
        const response = await axios.post('/services/docker/backup', {
          location: this.backupLocation,
          includes: this.backupIncludes
        });
        
        this.$message.success(response.data.message);
        this.fetchBackupFiles();
      } catch (error) {
        this.$message.error('Backup failed: ' + error.message);
      }
    },
    
    async scheduleBackup() {
      try {
        const response = await axios.post('/services/docker/backup/schedule', {
          schedule: this.cronExpression,
          location: this.backupLocation,
          includes: this.backupIncludes
        });
        
        const cron = await axios.post('/system/cron-jobs', {
          name: 'Docker Backup Schedule',
          description: 'Scheduled backup for Docker services',
          job: 'docker_backup_schedule',
          command: `/usr/local/bin/docker-backup --location ${this.backupLocation} --includes ${this.backupIncludes.join(',')}`,
          schedule: this.cronExpression
        });

        this.$message.success(response.data.message);
        this.fetchScheduledJobs();
      } catch (error) {
        this.$message.error('Failed to schedule backup: ' + error.message);
      }
    },
    
    async fetchBackupFiles() {
      try {
        const response = await axios.get('/services/docker/backup/list');
        this.backupFiles = response.data.files;
      } catch (error) {
        this.$message.error('Failed to fetch backup files');
      }
    },
    
    async fetchScheduledJobs() {
      try {
        const response = await axios.get('/services/docker/backup/schedules');
        this.scheduledJobs = Object.entries(response.data.jobs).map(([id, job]) => ({
          id,
          ...job,
          nextRun: this.getNextRun(job.schedule)
        }));
      } catch (error) {
        console.error('Failed to fetch scheduled jobs:', error);
      }
    },
    
    getNextRun(cronExpression) {
      try {
        const schedule = cron.parseExpression(cronExpression);
        return schedule.next().toISOString();
      } catch {
        return 'Unknown';
      }
    },
    
    async removeScheduledJob(id) {
      try {
        await this.$confirm('Remove this scheduled backup?', 'Warning', {
          confirmButtonText: 'Remove',
          cancelButtonText: 'Cancel',
          type: 'warning'
        });
        
        await axios.delete(`/services/docker/backup/schedule/${id}`);
        this.$message.success('Scheduled backup removed');
        this.fetchScheduledJobs();
      } catch (error) {
        if (error !== 'cancel') {
          this.$message.error('Failed to remove scheduled backup');
        }
      }
    },
    
    async restoreBackup(file) {
      try {
        await this.$confirm(`Restore from ${file.name}? This will overwrite current configuration.`, 'Warning', {
          confirmButtonText: 'Restore',
          cancelButtonText: 'Cancel',
          type: 'warning'
        });
        
        const response = await axios.post('/services/docker/backup/restore', {
          file: file.name
        });
        
        this.$message.success(response.data.message);
      } catch (error) {
        if (error !== 'cancel') {
          this.$message.error('Restore failed: ' + error.message);
        }
      }
    }
  },
  mounted() {
    this.fetchBackupFiles();
    this.fetchScheduledJobs();
  }
};
</script>
