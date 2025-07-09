// GitHub Actions environment configuration
const config = {
  // Reserved words configuration
  reservedWords: {
    // Local reserved words file path
    localPath: '../../reserved_words.txt',
    // Cache timeout: 24 hours (milliseconds)
    cacheTimeout: 24 * 60 * 60 * 1000,
    // Local fallback reserved words (used when file read fails)
    fallbackWords: [
      'api', 'admin', 'administrator', 'root', 'master', 'www', 'ftp', 'mail', 'email',
      'support', 'help', 'blog', 'news', 'about', 'contact', 'legal', 'privacy',
      'terms', 'login', 'signin', 'signup', 'register', 'logout', 'auth', 'security',
      'http', 'https', 'ssl', 'tls', 'ssh', 'smtp', 'pop', 'imap', 'dns', 'cdn',
      'backup', 'cache', 'config', 'database', 'db', 'server', 'host', 'localhost',
      'static', 'assets', 'uploads', 'download', 'files', 'images', 'css', 'js',
      'shop', 'store', 'cart', 'checkout', 'payment', 'billing', 'sales', 'order',
      'business', 'enterprise', 'corp', 'company', 'official', 'service', 'status',
      'facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'google', 'apple',
      'microsoft', 'amazon', 'github', 'gitlab', 'discord', 'slack', 'teams',
      'home', 'index', 'main', 'default', 'public', 'private', 'user', 'users',
      'profile', 'account', 'dashboard', 'settings', 'preferences', 'test', 'demo',
      'beta', 'alpha', 'dev', 'development', 'staging', 'production', 'live'
    ]
  },

  // GitHub configuration
  github: {
    token: process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY
  },

  // PR validation configuration
  validation: {
    // Minimum PR description length
    minDescriptionLength: 1300,
    // Maximum number of files allowed in a PR
    maxFileCount: 1,
    // Required file path pattern
    filePathPattern: /^whois\/[^\/]+\.json$/,
    // PR title pattern: Registration/Update/Remove: domain.sld
    titlePattern: /^(Registration|Update|Remove):\s+([a-zA-Z0-9-]+)\.(.+)$/
  }
};

module.exports = config; 