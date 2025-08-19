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
      
      return response.data === true;
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
}

export default new ServerService();
