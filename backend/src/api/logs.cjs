const path = require('path');
const fs = require('fs');
const morgan = require('morgan');

const LOGS_DIR = path.join('/var/log/nas-panel')

module.exports = function(app, requireAuth) {

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true })
}

app.use(morgan('combined', {
  stream: fs.createWriteStream(path.join(LOGS_DIR, 'access.log'), { flags: 'a' })
}))

app.post('/api/logs', async (req, res) => {
  try {
    const { level, message, timestamp, context } = req.body
    
    const logFile = path.join(LOGS_DIR, `${level}.log`)
    const logEntry = `[${timestamp}] ${message} ${context ? JSON.stringify(context) : ''}\n`
    
    fs.appendFileSync(logFile, logEntry, { encoding: 'utf8' })
    
    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error saving log:', error)
    res.status(500).json({ success: false, error: error.message })
  }
});

};