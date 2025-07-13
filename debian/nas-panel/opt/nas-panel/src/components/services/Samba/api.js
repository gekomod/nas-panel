// services/Samba/api.js
import axios from 'axios'

const SAMBA_API_BASE = '/services/samba'

export default {
  async getShares() {
    try {
      const response = await axios.get(`${SAMBA_API_BASE}/shares`)
      return response.data
    } catch (error) {
      console.error('Error fetching Samba shares:', error)
      throw error
    }
  },

  async createShare(shareData) {
    try {
      const response = await axios.post(`${SAMBA_API_BASE}/shares`, shareData)
      return response.data
    } catch (error) {
      console.error('Error creating Samba share:', error)
      throw error
    }
  },

  async updateShare(id, shareData) {
    try {
      const response = await axios.put(`${SAMBA_API_BASE}/shares/${id}`, shareData)
      return response.data
    } catch (error) {
      console.error('Error updating Samba share:', error)
      throw error
    }
  },

  async deleteShare(id) {
    try {
      const response = await axios.delete(`${SAMBA_API_BASE}/shares/${id}`)
      return response.data
    } catch (error) {
      console.error('Error deleting Samba share:', error)
      throw error
    }
  },

  async getSettings() {
    try {
      const response = await axios.get(`${SAMBA_API_BASE}/settings`)
      return response.data
    } catch (error) {
      console.error('Error fetching Samba settings:', error)
      throw error
    }
  },

  async updateSettings(settings) {
    try {
      const response = await axios.put(`${SAMBA_API_BASE}/settings`, settings)
      return response.data
    } catch (error) {
      console.error('Error updating Samba settings:', error)
      throw error
    }
  },

  async restartService() {
    try {
      const response = await axios.post(`${SAMBA_API_BASE}/restart`)
      return response.data
    } catch (error) {
      console.error('Error restarting Samba service:', error)
      throw error
    }
  },
  
  async getHomeDirSettings() {
    try {
      const response = await axios.get(`${SAMBA_API_BASE}/settings/homedirs`);
      return response.data;
    } catch (error) {
      console.error('Error getting home dir settings:', error);
      throw error;
    }
  },

  async updateHomeDirSettings(settings) {
    try {
      // Validate settings before sending
      const validatedSettings = {
        enabled: !!settings.enabled,
        enableUserHomes: !!settings.enableUserHomes,
        browsable: settings.browsable !== false,
        inheritAcls: settings.inheritAcls !== false,
        inheritPermissions: !!settings.inheritPermissions,
        enableRecycleBin: settings.enableRecycleBin !== false,
        followSymlinks: !!settings.followSymlinks,
        wideLinks: !!settings.wideLinks
      };

      const response = await axios.post(`${SAMBA_API_BASE}/settings/homedirs`, validatedSettings);
      return response.data;
    } catch (error) {
      console.error('Error updating home dir settings:', error);
      throw error;
    }
  }
}
