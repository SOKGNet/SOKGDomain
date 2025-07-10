const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class ReservedWordsService {
  constructor() {
    this.filePath = path.resolve(__dirname, '../../reserved_words.txt');
  }

  /**
   * 获取保留字列表
   * @returns {Promise<string[]>} 保留字数组
   * @throws {Error} 如果文件读取失败
   */
  async getReservedWords() {
    try {
      logger.debug('Reading reserved words from file:', this.filePath);
      
      const content = await fs.promises.readFile(this.filePath, 'utf8');
      const words = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')); // 忽略空行和注释

      if (!words.length) {
        throw new Error('Reserved words list is empty');
      }

      logger.debug(`Successfully loaded ${words.length} reserved words`);
      return words;

    } catch (error) {
      logger.error('Failed to read reserved words:', error);
      throw new Error('Unable to validate domain: reserved words list is not accessible');
    }
  }
}

// 创建单例实例
const reservedWordsService = new ReservedWordsService();

module.exports = reservedWordsService; 