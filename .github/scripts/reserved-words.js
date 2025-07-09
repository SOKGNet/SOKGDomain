const fs = require('fs');
const path = require('path');
const config = require('./config');

class ReservedWordsService {
  constructor() {
    this.cacheFilePath = path.join(__dirname, 'reserved_words_cache.json');
    this.cachedWords = null;
    this.lastUpdateTime = null;
    
    // Load cache on startup
    this.loadFromCache();
  }

  /**
   * Get reserved words list
   */
  async getReservedWords() {
    try {
      // Check if cache is still valid
      if (this.isCacheValid()) {
        console.log('Using cached reserved words list');
        return this.cachedWords;
      }

      console.log('Cache expired or not exists, reading reserved words from local file');
      
      // Try to read from local file
      const localWords = await this.readLocalWords();
      
      if (localWords && localWords.length > 0) {
        // Update cache
        this.updateCache(localWords);
        return localWords;
      } else {
        console.warn('Local file read failed, using fallback reserved words list');
        return this.getFallbackWords();
      }

    } catch (error) {
      console.error('Error occurred while getting reserved words:', error.message);
      return this.getAvailableWords();
    }
  }

  /**
   * Read reserved words from local file
   */
  async readLocalWords() {
    try {
      const filePath = path.resolve(__dirname, config.reservedWords.localPath);
      console.log(`Reading reserved words from local file: ${filePath}`);

      const data = await fs.promises.readFile(filePath, 'utf8');
      
      // Parse reserved words file content
      const words = this.parseReservedWordsContent(data);
      console.log(`Successfully read ${words.length} reserved words`);
      return words;

    } catch (error) {
      console.error('Failed to read local reserved words:', error.message);
      throw error;
    }
  }

  /**
   * Parse reserved words file content
   */
  parseReservedWordsContent(content) {
    if (!content || typeof content !== 'string') {
      throw new Error('Reserved words content is empty or invalid format');
    }

    // Split by lines and clean
    const words = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => {
        // Filter out empty lines, comment lines and invalid lines
        return line.length > 0 && 
               !line.startsWith('#') && 
               !line.startsWith('//') && 
               /^[a-zA-Z0-9-]+$/.test(line);
      })
      .map(word => word.toLowerCase()); // Convert to lowercase uniformly

    // Deduplicate and sort
    const uniqueWords = [...new Set(words)].sort();

    console.log(`Parsed ${uniqueWords.length} valid reserved words`);
    return uniqueWords;
  }

  /**
   * Check if cache is still valid
   */
  isCacheValid() {
    if (!this.cachedWords || !this.lastUpdateTime) {
      return false;
    }

    const now = Date.now();
    const cacheAge = now - this.lastUpdateTime;
    return cacheAge < config.reservedWords.cacheTimeout;
  }

  /**
   * Update cache with new words
   */
  updateCache(words) {
    try {
      const cacheData = {
        words: words,
        timestamp: Date.now()
      };

      fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2));
      
      this.cachedWords = words;
      this.lastUpdateTime = cacheData.timestamp;
      
      console.log(`Cache updated with ${words.length} words`);
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

        if (cacheData.words && Array.isArray(cacheData.words)) {
          this.cachedWords = cacheData.words;
          this.lastUpdateTime = cacheData.timestamp || 0;
          
          console.log(`Loaded ${this.cachedWords.length} reserved words from cache, cache time: ${new Date(this.lastUpdateTime).toLocaleString()}`);
        }
      }
    } catch (error) {
      console.error('Failed to load cache:', error.message);
      this.cachedWords = null;
      this.lastUpdateTime = null;
    }
  }

  /**
   * Get available words (prioritize cache, then fallback)
   */
  getAvailableWords() {
    // If there are cached words, use cache (even if expired)
    if (this.cachedWords && this.cachedWords.length > 0) {
      console.warn('Using expired cached reserved words list');
      return this.cachedWords;
    }
    
    // Otherwise use fallback
    console.warn('Using fallback reserved words list');
    return this.getFallbackWords();
  }

  /**
   * Get fallback reserved words
   */
  getFallbackWords() {
    return config.reservedWords.fallbackWords || [];
  }
}

// Create singleton instance
const reservedWordsService = new ReservedWordsService();

module.exports = reservedWordsService; 