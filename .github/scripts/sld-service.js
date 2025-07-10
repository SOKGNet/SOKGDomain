const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');

class SLDService {
  constructor() {
    this.cacheFilePath = path.join(__dirname, config.sld.cache.filename);
    this.cachedSLDList = null;
    this.lastUpdateTime = null;
    this.cacheTimeout = config.sld.cache.timeout;
    
    // Load cache on startup
    this.loadFromCache();
  }

  /**
   * Get supported SLD list
   * @returns {Promise<string[]>} 返回所有可用的SLD列表
   */
  async getSupportedSLDs() {
    try {
      const sldList = await this.getSLDList();
      if (!sldList) return [];

      // 只返回状态为live的SLD
      return Object.entries(sldList)
        .filter(([, info]) => info.status === config.sld.status.live)
        .map(([sld]) => sld);

    } catch (error) {
      logger.error('Error occurred while getting SLD list:', error);
      return [];
    }
  }

  /**
   * 检查SLD是否可用
   * @param {string} sld - 要检查的SLD
   * @returns {Promise<boolean>} 如果SLD存在且状态为live则返回true
   */
  async isSLDAvailable(sld) {
    try {
      const sldList = await this.getSLDList();
      if (!sldList) return false;

      return sldList[sld]?.status === config.sld.status.live;
    } catch (error) {
      logger.error(`Error checking SLD availability for ${sld}:`, error);
      return false;
    }
  }

  /**
   * 获取SLD信息
   * @param {string} sld - 要获取信息的SLD
   * @returns {Promise<Object|null>} SLD信息对象或null
   */
  async getSLDInfo(sld) {
    try {
      const sldList = await this.getSLDList();
      return sldList?.[sld] || null;
    } catch (error) {
      logger.error(`Error getting SLD info for ${sld}:`, error);
      return null;
    }
  }

  /**
   * 获取SLD列表（优先使用缓存）
   * @private
   * @returns {Promise<Object|null>} SLD列表对象或null
   */
  async getSLDList() {
    try {
      // 检查缓存是否有效
      if (this.isCacheValid()) {
        logger.debug('Using cached SLD list');
        return this.cachedSLDList;
      }

      logger.info('Cache expired or not exists, reading SLD list from file');
      
      // 读取文件
      const sldList = await this.readSLDList();
      
      if (sldList && Object.keys(sldList).length > 0) {
        // 更新缓存
        this.updateCache(sldList);
        return sldList;
      }

      logger.warn('No valid SLD list found');
      return null;

    } catch (error) {
      logger.error('Error getting SLD list:', error);
      return this.cachedSLDList; // 发生错误时返回缓存的数据（即使已过期）
    }
  }

  /**
   * 从文件读取SLD列表
   * @private
   */
  async readSLDList() {
    try {
      const filePath = path.resolve(__dirname, config.sld.localPath);
      logger.debug(`Reading SLD list from file: ${filePath}`);

      const data = await fs.promises.readFile(filePath, 'utf8');
      const sldList = JSON.parse(data);
      
      // 验证数据格式
      if (!this.validateSLDList(sldList)) {
        throw new Error('Invalid SLD list format');
      }

      logger.info(`Successfully read ${Object.keys(sldList).length} SLDs`);
      return sldList;

    } catch (error) {
      logger.error(`Failed to read SLD list: ${error.message}`);
      throw error;
    }
  }

  /**
   * 验证SLD列表格式
   * @private
   */
  validateSLDList(sldList) {
    if (!sldList || typeof sldList !== 'object') {
      return false;
    }

    // 检查每个SLD条目
    for (const [sld, info] of Object.entries(sldList)) {
      if (!this.validateSLDEntry(sld, info)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 验证单个SLD条目
   * @private
   */
  validateSLDEntry(sld, info) {
    // 基本类型检查
    if (!info || typeof info !== 'object') return false;
    if (!info.status || typeof info.status !== 'string') return false;
    if (!info.operator || typeof info.operator !== 'object') return false;

    // 检查operator字段
    const operator = info.operator;
    if (!operator.organization || typeof operator.organization !== 'string') return false;
    if (!operator.website || typeof operator.website !== 'string') return false;
    if (!operator.created_at || typeof operator.created_at !== 'string') return false;
    if (!operator.description || typeof operator.description !== 'string') return false;

    return true;
  }

  /**
   * 检查缓存是否有效
   * @private
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
   * 更新缓存
   * @private
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
      
      logger.debug(`Cache updated with ${Object.keys(sldList).length} SLDs`);
    } catch (error) {
      logger.error('Failed to update cache:', error.message);
    }
  }

  /**
   * 从缓存加载数据
   * @private
   */
  loadFromCache() {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const cacheContent = fs.readFileSync(this.cacheFilePath, 'utf8');
        const cacheData = JSON.parse(cacheContent);

        if (cacheData.sldList && typeof cacheData.sldList === 'object') {
          this.cachedSLDList = cacheData.sldList;
          this.lastUpdateTime = cacheData.timestamp || 0;
          
          logger.debug(`Loaded ${Object.keys(this.cachedSLDList).length} SLDs from cache, cache time: ${new Date(this.lastUpdateTime).toLocaleString()}`);
        }
      }
    } catch (error) {
      logger.error('Failed to load cache:', error.message);
      this.cachedSLDList = null;
      this.lastUpdateTime = null;
    }
  }
}

// 创建单例实例
const sldService = new SLDService();

module.exports = sldService; 