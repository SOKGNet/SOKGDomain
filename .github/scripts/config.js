/**
 * Configuration module
 */

module.exports = {
  github: {
    repository: process.env.GITHUB_REPOSITORY || 'PublicFreeSuffix/PublicFreeSuffix',
    templateUrl: 'https://raw.githubusercontent.com/PublicFreeSuffix/PublicFreeSuffix/refs/heads/main/.github/PULL_REQUEST_TEMPLATE/WHOIS_FILE_OPERATION.md',
    labels: {
      validationPassed: 'validation-passed',
      validationFailed: 'validation-failed'
    }
  },
  validation: {
    maxFileCount: 1,
    filePathPattern: /^whois\/[^\/]+\.json$/,
    minDescriptionLength: 1300,
    titlePattern: /^(Registration|Update|Remove):\s+([a-zA-Z0-9-]+)\.(.+)$/
  },
  sld: {
    // SLD列表文件的本地路径
    localPath: '../../public_sld_list.json',
    
    // 缓存配置
    cache: {
      timeout: 24 * 60 * 60 * 1000, // 24 hours
      filename: 'sld_cache.json'     // 缓存文件名
    },

    // SLD状态定义
    status: {
      live: 'live'  // 可用状态的值
    }
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    colors: {
      error: 'red',
      warn: 'yellow',
      info: 'green',
      debug: 'blue'
    }
  }
}; 