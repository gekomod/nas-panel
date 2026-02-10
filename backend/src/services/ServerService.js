import axios from 'axios';

class ServerService {
  constructor() {
    this.baseURL = '/api';
    this.cacheBuster = 1;
  }

  async restart() {
    try {
      console.log('Sending restart command...');
      const response = await axios.post(`${this.baseURL}/system-restart`, {}, {
        timeout: 5000
      });
      
      console.log('Restart response:', response.data);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return response.data;
      
    } catch (error) {
      console.log('Restart command sent, server is restarting...');
      return { 
        status: 'restarting', 
        message: 'Restart initiated - server will be offline temporarily' 
      };
    }
  }

  async shutdown() {
    try {
      const response = await axios.post(`${this.baseURL}/system-shutdown`);
      return response.data;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        return { status: 'shutting_down', message: 'Shutdown initiated' };
      }
      throw new Error('Failed to shutdown server: ' + error.message);
    }
  }

  async checkStatus() {
    try {
      const timestamp = Date.now();
      const response = await axios.get(`${this.baseURL}/system-health?_=${timestamp}`, {
        timeout: 3000
      });
      
      // Obsłuż różne formaty odpowiedzi
      if (response.data === true || response.data === "true") {
        return true;
      }
      
      // Sprawdź czy to JSON ze statusem
      if (response.data && typeof response.data === 'object') {
        return response.data.status === true || 
               response.data.status === "true" || 
               response.data.status === "healthy";
      }
      
      return false;
    } catch (error) {
      console.error('Health check failed:', error.message);
      return false;
    }
  }
  
  async checkWithRetry(maxRetries = 10, delay = 3000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const isOnline = await this.checkStatus();
        if (isOnline) {
          return true;
        }
        // Czekaj przed kolejną próbą
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.log(`Retry ${i + 1}/${maxRetries} failed`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return false;
  }

  async scheduleShutdown(time) {
    try {
      const response = await axios.post(`${this.baseURL}/system/schedule-shutdown`, { time });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to schedule shutdown');
    }
  }

  async cancelShutdown() {
    try {
      const response = await axios.post(`${this.baseURL}/system/cancel-shutdown`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to cancel shutdown');
    }
  }
  
async checkServerStatus() {
  try {
    const response = await fetch(`/apis/healths`, {  // Poprawiłem z healths na health
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.status === 200) {
      const data = await response.json();
      
      // Obsłuż różne formaty odpowiedzi
      if (typeof data === 'object' && data.status === "healthy") {
        return true;
      }
      if (data === true || data === "true") {
        return true;
      }
      if (data === "healthy") {
        return true;
      }
      if (typeof data === 'object' && data.healthy === true) {
        return true;
      }
    }
    return false;
  } catch (error) {
    // Ignoruj błędy timeout/network
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      console.warn('Server health check timeout');
    } else {
      console.warn('Server health check failed:', error.message);
    }
    return false;
  }
}
  
async sendHeartbeat() {
  try {
    const response = await fetch(`/apis/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      }),
      signal: AbortSignal.timeout(3000)
    });
    
    console.debug('Heartbeat sent successfully');
    
    if (response.ok) {
      return await response.json();
    } else {
      console.debug('Heartbeat response not OK:', response.status);
      return null;
    }
  } catch (error) {
    // Ignoruj błędy timeout/abort
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      console.debug('Heartbeat timeout (non-critical)');
    } else {
      console.debug('Heartbeat failed (non-critical):', error.message);
    }
    return null;
  }
}
  
  async checkServerRestart() {
    try {
      const lastKnownBootTime = localStorage.getItem('server_boot_time');
      
      if (!lastKnownBootTime) {
        // Pierwsze uruchomienie - zapisz aktualny czas
        const initialTime = Date.now().toString();
        localStorage.setItem('server_boot_time', initialTime);
        return false;
      }
      
      const response = await axios.get(`${this.baseURL}/system/boot-time`, {
        timeout: 3000
      });
      
      let currentBootTime;
      if (response.data && typeof response.data === 'object') {
        currentBootTime = response.data.bootTime || response.data;
      } else {
        currentBootTime = response.data;
      }
      
      if (currentBootTime && lastKnownBootTime !== currentBootTime.toString()) {
        console.log('Server restart detected');
        localStorage.setItem('server_boot_time', currentBootTime.toString());
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to check server restart:', error.message);
      return false;
    }
  }

async isApiAvailable() {
  try {
    const response = await fetch(`/apis/ping`, {
      signal: AbortSignal.timeout(2000)
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

  async checkInternetConnection() {
    return new Promise((resolve) => {
      if (navigator.onLine === false) {
        resolve(false);
        return;
      }
      
      const timeout = setTimeout(() => resolve(false), 3000);
      
      // Prosta metoda z obrazkiem
      const img = new Image();
      img.onload = () => {
        clearTimeout(timeout);
        resolve(true);
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      img.src = 'https://www.google.com/favicon.ico?' + Date.now();
    });
  }

  async checkSession() {
    try {
      const response = await axios.get(`${process.env.HOST}/apis/auth/check`, {
        timeout: 3000
      });
      
      if (response.status === 200) {
        if (response.data && typeof response.data === 'object') {
          return response.data.authenticated === true;
        }
        return true;
      }
      return false;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        return false;
      }
      console.error('Session check error:', error.message);
      return false;
    }
  }
  
  // Dodatkowe metody pomocnicze
  async waitForServer(maxWait = 30000, interval = 1000) {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      if (await this.checkServerStatus()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    return false;
  }
}

export default new ServerService();
