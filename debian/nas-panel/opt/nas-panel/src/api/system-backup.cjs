const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const cron = require('node-cron');
const cronParser = require('cron-parser');
const { v4: uuidv4, validate: uuidValidate } = require('uuid');

// Konfiguracja ścieżek
const BACKUP_ROOT = '/var/backups/nas';
const CONFIG_FILE = path.join('/etc/nas-panel/backup_config.json');
const CRON_JOBS_FILE = path.join('/etc', 'nas-panel', 'cron-jobs.json');
const BACKUP_JOB_ID = 'system-scheduled-backup';

// Globalny stan
const cronJobs = new Map();
let backupCronJob = null;

// Helper functions
const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const loadConfig = () => {
  try {
    ensureDirExists(path.dirname(CONFIG_FILE));
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return {
        schedule: {
          type: config.schedule?.type || 'disabled',
          daily_time: config.schedule?.daily_time || '02:00',
          weekly_day: config.schedule?.weekly_day || 'monday',
          weekly_time: config.schedule?.weekly_time || '02:00',
          monthly_day: config.schedule?.monthly_day || 1,
          monthly_time: config.schedule?.monthly_time || '02:00',
          retention: config.schedule?.retention || '30d'
        },
        backups: config.backups || []
      };
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return {
    schedule: {
      type: 'disabled',
      daily_time: '02:00',
      weekly_day: 'monday',
      weekly_time: '02:00',
      monthly_day: 1,
      monthly_time: '02:00',
      retention: '30d'
    },
    backups: []
  };
};

const saveConfig = (config) => {
  try {
    ensureDirExists(path.dirname(CONFIG_FILE));
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
};

const loadCronJobs = () => {
  try {
    ensureDirExists(path.dirname(CRON_JOBS_FILE));
    if (fs.existsSync(CRON_JOBS_FILE)) {
      const data = fs.readFileSync(CRON_JOBS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading cron jobs:', error);
  }
  return [];
};

const saveCronJobs = () => {
  try {
    ensureDirExists(path.dirname(CRON_JOBS_FILE));
    const jobsToSave = Array.from(cronJobs.values()).map(job => ({
      id: job.id,
      name: job.name,
      schedule: job.schedule,
      command: job.command,
      description: job.description,
      nextRun: job.nextRun?.toISOString(),
      lastRun: job.lastRun?.toISOString()
    }));
    fs.writeFileSync(CRON_JOBS_FILE, JSON.stringify(jobsToSave, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving cron jobs:', error);
    return false;
  }
};

const validateCronExpression = (expression) => {
  try {
    cronParser.CronExpressionParser.parse(expression);
    return true;
  } catch (error) {
    console.error('Invalid cron expression:', expression, error.message);
    return false;
  }
};

const getCronPattern = (schedule) => {
  switch (schedule.type) {
    case 'daily':
      const [dailyHours, dailyMinutes] = schedule.daily_time.split(':');
      return `${dailyMinutes} ${dailyHours} * * *`;
    
    case 'weekly':
      const [weeklyHours, weeklyMinutes] = schedule.weekly_time.split(':');
      const dayMap = { 
        monday: 1, tuesday: 2, wednesday: 3, 
        thursday: 4, friday: 5, saturday: 6, sunday: 0 
      };
      return `${weeklyMinutes} ${weeklyHours} * * ${dayMap[schedule.weekly_day.toLowerCase()] || 1}`;
    
    case 'monthly':
      const [monthlyHours, monthlyMinutes] = schedule.monthly_time.split(':');
      return `${monthlyMinutes} ${monthlyHours} ${schedule.monthly_day} * *`;
    
    default:
      throw new Error('Invalid schedule type');
  }
};

const calculateNextRun = (expression) => {
  try {
    const interval = cronParser.CronExpressionParser.parse(expression, {
      currentDate: new Date(),
      tz: 'Europe/Warsaw'
    });
    return interval.next().toDate();
  } catch (error) {
    console.error('Error calculating next run:', error);
    return null;
  }
};

const updateCronJob = (schedule) => {
  // Usuń istniejące zadanie
    if (backupCronJob && typeof backupCronJob.stop === 'function') {
      backupCronJob.stop();
      backupCronJob = null;
    }

    // Bezpieczne usunięcie z mapy cronJobs
    if (cronJobs.has(BACKUP_JOB_ID)) {
      const existingJob = cronJobs.get(BACKUP_JOB_ID);
      if (existingJob.task && typeof existingJob.task.stop === 'function') {
        existingJob.task.stop();
      }
      cronJobs.delete(BACKUP_JOB_ID);
    }

  if (schedule.type === 'disabled') {
    saveCronJobs();
    return;
  }

  try {
    const cronPattern = getCronPattern(schedule);
    
    if (!validateCronExpression(cronPattern)) {
      throw new Error(`Invalid cron pattern: ${cronPattern}`);
    }

    const command = `/usr/bin/nas-backup --type ${schedule.type}`;
    const nextRun = calculateNextRun(cronPattern);

    if (!nextRun) {
      throw new Error('Could not calculate next run time');
    }

    const task = cron.schedule(cronPattern, async () => {
      console.log(`[${new Date().toISOString()}] Executing scheduled backup...`);
      try {
        await execAsync(command);
        
        const newNextRun = calculateNextRun(cronPattern);
        cronJobs.set(BACKUP_JOB_ID, {
          ...cronJobs.get(BACKUP_JOB_ID),
          lastRun: new Date(),
          nextRun: newNextRun
        });
        saveCronJobs();
        console.log(`[${new Date().toISOString()}] Backup completed successfully`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Backup failed:`, error);
      }
    }, {
      scheduled: true,
      timezone: 'Europe/Warsaw'
    });

    cronJobs.set(BACKUP_JOB_ID, {
      id: BACKUP_JOB_ID,
      name: 'System Backup',
      schedule: cronPattern,
      command: command,
      description: 'Automatic system backups',
      task: task,
      nextRun: nextRun,
      lastRun: null,
      isSystemJob: true
    });

    backupCronJob = task;
    saveCronJobs();
    console.log(`Scheduled backup job created. Next run: ${nextRun}`);
  } catch (error) {
    console.error('Failed to create cron job:', error);
    throw error;
  }
};

const initBackupSystem = () => {
  try {
    const config = loadConfig();
    const savedJobs = loadCronJobs();
    
    // Przywróć zapisane zadania
    savedJobs.forEach(job => {
      if (job.id === BACKUP_JOB_ID) {
        cronJobs.set(job.id, {
          ...job,
          nextRun: job.nextRun ? new Date(job.nextRun) : null,
          lastRun: job.lastRun ? new Date(job.lastRun) : null
        });
      }
    });

    // Zaktualizuj zadanie cron
    updateCronJob(config.schedule);
  } catch (error) {
    console.error('Error initializing backup system:', error);
  }
};

const formatSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

module.exports = function(app, requireAuth) {
  // Inicjalizacja przy starcie
  initBackupSystem();

  // Endpointy API
  app.post('/api/system/backup/schedule', requireAuth, async (req, res) => {
    try {
      const { schedule } = req.body;
      
      if (!schedule || typeof schedule !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Invalid schedule data'
        });
      }

      if (!['disabled', 'daily', 'weekly', 'monthly'].includes(schedule.type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid schedule type'
        });
      }

      const config = loadConfig();
      config.schedule = {
        type: schedule.type,
        daily_time: schedule.daily_time || '02:00',
        weekly_day: schedule.weekly_day || 'monday',
        weekly_time: schedule.weekly_time || '02:00',
        monthly_day: schedule.monthly_day || 1,
        monthly_time: schedule.monthly_time || '02:00',
        retention: schedule.retention || '30d'
      };

      updateCronJob(config.schedule);
      saveConfig(config);

      const job = cronJobs.get(BACKUP_JOB_ID) || {};
      
      res.json({
        success: true,
        message: 'Backup schedule updated successfully',
        schedule: config.schedule,
        cronJob: {
          id: job.id,
          name: job.name,
          nextRun: job.nextRun?.toISOString(),
          lastRun: job.lastRun?.toISOString(),
          isActive: !!job.task
        }
      });

    } catch (error) {
      console.error('Schedule update error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: error.stack
      });
    }
  });

  app.get('/api/system/backup/schedule', requireAuth, async (req, res) => {
    try {
      const config = loadConfig();
      const job = cronJobs.get(BACKUP_JOB_ID) || {};
      
      res.json({
        success: true,
        schedule: config.schedule,
        cronJob: {
          id: job.id,
          name: job.name,
          nextRun: job.nextRun?.toISOString(),
          lastRun: job.lastRun?.toISOString(),
          isActive: !!job.task
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get backup schedule'
      });
    }
  });

  // Inne endpointy backupu...
  app.get('/api/system/backup/list', requireAuth, async (req, res) => {
    try {
      const config = loadConfig();
      res.json({
        success: true,
        backups: config.backups.map(b => ({
          ...b,
          size_formatted: formatSize(b.size || 0)
        }))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to list backups'
      });
    }
  });

  app.post('/api/system/backup/create', requireAuth, async (req, res) => {
    try {
      const { type, name } = req.body;
      const backupId = uuidv4();
      const backupName = name || `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const backupFile = path.join(BACKUP_ROOT, `${backupName}.tar.gz`);

      const config = loadConfig();
      config.backups.push({
        id: backupId,
        name: backupName,
        path: backupFile,
        status: 'in_progress',
        created_at: new Date().toISOString()
      });
      saveConfig(config);

      // Uruchom backup w tle
      exec(`tar -czf "${backupFile}" /etc/nas-panel`, async (error) => {
        const updatedConfig = loadConfig();
        const backup = updatedConfig.backups.find(b => b.id === backupId);
        if (backup) {
          if (error) {
            backup.status = 'failed';
            backup.error = error.message;
          } else {
            backup.status = 'completed';
            backup.size = fs.statSync(backupFile).size;
          }
          saveConfig(updatedConfig);
        }
      });

      res.json({
        success: true,
        backupId,
        message: 'Backup started in background'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to start backup'
      });
    }
  });
  
  app.get('/api/system/backup/history', requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.per_page) || 10;
      
      const config = loadConfig();
      const allBackups = config.backups
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(b => ({
          ...b,
          size_formatted: formatSize(b.size || 0)
        }));

      const startIndex = (page - 1) * perPage;
      const endIndex = startIndex + perPage;
      const paginatedBackups = allBackups.slice(startIndex, endIndex);

      res.json({
        success: true,
        backups: paginatedBackups,
        total: allBackups.length,
        page,
        per_page: perPage,
        total_pages: Math.ceil(allBackups.length / perPage)
      });
    } catch (error) {
      console.error('Backup history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch backup history'
      });
    }
  });
  
app.delete('/api/system/backup/delete/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const config = loadConfig();
    const backupIndex = config.backups.findIndex(b => b.id === id);

    if (backupIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Backup not found'
      });
    }

    const backup = config.backups[backupIndex];
    
    // Usuń plik backupu jeśli istnieje
    if (fs.existsSync(backup.path)) {
      fs.unlinkSync(backup.path);
      console.log(`Deleted backup file: ${backup.path}`);
    }

    // Usuń z konfiguracji
    config.backups.splice(backupIndex, 1);
    saveConfig(config);

    res.json({
      success: true,
      message: 'Backup deleted successfully',
      deletedId: id
    });

  } catch (error) {
    console.error('Delete backup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete backup',
      details: error.message
    });
  }
});

app.get('/api/system/backup/download/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prosta walidacja UUID (można użyć też regex)
    if (!id || typeof id !== 'string' || id.length !== 36) {
      return res.status(400).json({
        success: false,
        error: 'Invalid backup ID format'
      });
    }

    const config = loadConfig();
    const backup = config.backups.find(b => b.id === id);

    if (!backup) {
      return res.status(404).json({
        success: false,
        error: 'Backup not found in database'
      });
    }

    if (!fs.existsSync(backup.path)) {
      return res.status(404).json({
        success: false,
        error: 'Backup file not found on disk',
        path: backup.path
      });
    }

    if (backup.status !== 'completed') {
      return res.status(423).json({
        success: false,
        error: 'Backup is not ready for download',
        status: backup.status
      });
    }

    // Ustaw nagłówki
    const filename = path.basename(backup.path);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // Wyślij plik
    const fileStream = fs.createReadStream(backup.path);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download backup',
      details: error.message
    });
  }
});

};
