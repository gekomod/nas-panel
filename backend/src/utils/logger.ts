import axios from 'axios'

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, unknown>
}

class Logger {
  private static instance: Logger
  private queue: LogEntry[] = []
  private isSending = false
  private readonly MAX_QUEUE_SIZE = 50
  private readonly FLUSH_INTERVAL = 10000 // 10 sekund

  private constructor() {
    // Automatyczne czyszczenie kolejki
    setInterval(() => this.flush(), this.FLUSH_INTERVAL)
    
    // Obsługa błędów nieprzechwyconych
    window.addEventListener('error', (event) => {
      this.error('Unhandled error', { error: event.error })
    })
    
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', { reason: event.reason })
    })
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private async sendToServer(entry: LogEntry): Promise<void> {
    try {
      await axios.post('/api/logs', entry)
    } catch (error) {
      console.error('Failed to send log to server:', error)
      // Fallback do localStorage jeśli wysyłanie się nie uda
      this.saveToLocalStorage(entry)
    }
  }

  private saveToLocalStorage(entry: LogEntry): void {
    try {
      const logs = JSON.parse(localStorage.getItem('appLogs') || '[]')
      logs.push(entry)
      
      // Ogranicz rozmiar logów
      if (logs.length > this.MAX_QUEUE_SIZE) {
        logs.splice(0, logs.length - this.MAX_QUEUE_SIZE)
      }
      
      localStorage.setItem('appLogs', JSON.stringify(logs))
    } catch (error) {
      console.error('Failed to save log to localStorage:', error)
    }
  }

  private addToQueue(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context
    }

    // Dodaj do kolejki
    this.queue.push(entry)
    
    // Jeśli kolejka jest zbyt duża, wyślij od razu
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      this.flush()
    }
  }

  public async flush(): Promise<void> {
    if (this.isSending || this.queue.length === 0) return
    
    this.isSending = true
    const logsToSend = [...this.queue]
    this.queue = []
    
    try {
      // Wysyłaj wszystkie logi na raz
      await Promise.all(logsToSend.map(log => this.sendToServer(log)))
    } catch (error) {
      // Jeśli wysyłanie się nie uda, przywróć logi do kolejki
      this.queue.unshift(...logsToSend)
    } finally {
      this.isSending = false
    }
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.addToQueue('error', message, context)
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.addToQueue('warn', message, context)
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.addToQueue('info', message, context)
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.addToQueue('debug', message, context)
  }
}

const logger = Logger.getInstance()
export default logger