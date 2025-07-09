const fs = require('fs');
const path = require('path');

class SLDService {
  constructor() {
    this.cacheFilePath = path.join(__dirname, 'sld_cache.json');
    this.cachedSLDList = null;
    this.lastUpdateTime = null;
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
    
    // Load cache on startup
    this.loadFromCache();
  }

  /**
   * Get supported SLD list
   */
  async getSupportedSLDs() {
    try {
      // Check if cache is still valid
      if (this.isCacheValid()) {
        console.log('Using cached SLD list');
        return Object.keys(this.cachedSLDList);
      }

      console.log('Cache expired or not exists, reading SLD list from local file');
      
      // Try to read from local file
      const sldList = await this.readSLDList();
      
      if (sldList && Object.keys(sldList).length > 0) {
        // Update cache
        this.updateCache(sldList);
        return Object.keys(sldList);
      } else {
        console.warn('Local file read failed or empty SLD list');
        return [];
      }

    } catch (error) {
      console.error('Error occurred while getting SLD list:', error);
      return this.getAvailableSLDs();
    }
  }

  /**
   * Get SLD status
   */
  async getSLDStatus(sld) {
    try {
      // Check if cache is still valid
      if (this.isCacheValid() && this.cachedSLDList) {
        console.log('Using cached SLD info');
        return this.cachedSLDList[sld]?.status || null;
      }

      console.log('Cache expired or not exists, reading SLD list from local file');
      
      // Try to read from local file
      const sldList = await this.readSLDList();
      
      if (sldList && Object.keys(sldList).length > 0) {
        // Update cache
        this.updateCache(sldList);
        return sldList[sld]?.status || null;
      } else {
        console.warn('Local file read failed or empty SLD list');
        return null;
      }

    } catch (error) {
      console.error('Error occurred while getting SLD status:', error);
      return null;
    }
  }

  /**
   * Read SLD list from local file
   */
  async readSLDList() {
    try {
      const filePath = path.resolve(__dirname, '../../public_sld_list.json');
      console.log(`Reading SLD list from local file: ${filePath}`);

      const data = await fs.promises.readFile(filePath, 'utf8');
      const sldList = JSON.parse(data);
      
      // Validate the SLD list format
      if (!this.validateSLDList(sldList)) {
        throw new Error('Invalid SLD list format');
      }

      console.log(`Successfully read ${Object.keys(sldList).length} SLDs`);
      return sldList;

    } catch (error) {
      console.error('Failed to read local SLD list:', error.message);
      throw error;
    }
  }

  /**
   * Validate SLD list format
   */
  validateSLDList(sldList) {
    if (!sldList || typeof sldList !== 'object') {
      return false;
    }

    // Check each SLD entry
    for (const [sld, info] of Object.entries(sldList)) {
      if (!info || typeof info !== 'object') return false;
      if (!info.status || typeof info.status !== 'string') return false;
      if (!info.operator || typeof info.operator !== 'object') return false;
      
      const operator = info.operator;
      if (!operator.organization || typeof operator.organization !== 'string') return false;
      if (!('website' in operator) || typeof operator.website !== 'string') return false;
      if (!('created_at' in operator) || typeof operator.created_at !== 'string') return false;
      if (!('description' in operator) || typeof operator.description !== 'string') return false;
    }

    return true;
  }

  /**
   * Check if cache is still valid
   */
  isCacheValid() {
    if (!this.cachedSLDList || !this.lastUpdateTime) {
      return false;
    }

    const now = Date.now();
    const cacheAge = now - this.lastUpdateTime;
    return cacheAge < this.cacheTimeout;
  }

  /**
   * Update cache with new SLD list
   */
  updateCache(sldList) {
    try {
      const cacheData = {
        sldList: sldList,
        timestamp: Date.now()
      };

      fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2));
      
      this.cachedSLDList = sldList;
      this.lastUpdateTime = cacheData.timestamp;
      
      console.log(`Cache updated with ${Object.keys(sldList).length} SLDs`);
    } catch (error) {
      console.error('Failed to update cache:', error.message);
    }
  }

  /**
   * Load from local cache
   */
  loadFromCache() {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const cacheContent = fs.readFileSync(this.cacheFilePath, 'utf8');
        const cacheData = JSON.parse(cacheContent);

        if (cacheData.sldList && typeof cacheData.sldList === 'object') {
          this.cachedSLDList = cacheData.sldList;
          this.lastUpdateTime = cacheData.timestamp || 0;
          
          console.log(`Loaded ${Object.keys(this.cachedSLDList).length} SLDs from cache, cache time: ${new Date(this.lastUpdateTime).toLocaleString()}`);
        }
      }
    } catch (error) {
      console.error('Failed to load cache:', error.message);
      this.cachedSLDList = null;
      this.lastUpdateTime = null;
    }
  }

  /**
   * Get available SLDs (use cache even if expired)
   */
  getAvailableSLDs() {
    if (this.cachedSLDList && Object.keys(this.cachedSLDList).length > 0) {
      console.warn('Using expired cached SLD list');
      return Object.keys(this.cachedSLDList);
    }
    return [];
  }
}

// Create singleton instance
const sldService = new SLDService();

module.exports = sldService; 