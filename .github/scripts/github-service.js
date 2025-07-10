const { Octokit } = require('@octokit/rest');
const logger = require('./logger');

class GitHubService {
  constructor() {
    if (!process.env.MY_GITHUB_TOKEN) {
      throw new Error('MY_GITHUB_TOKEN environment variable is required but not set');
    }

    this.octokit = new Octokit({
      auth: process.env.MY_GITHUB_TOKEN
    });
  }

  /**
   * Get file content from GitHub repository
   * @param {string} filePath - Path to the file
   * @param {string} ref - Git reference (commit SHA, branch, tag)
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<string|null>} File content or null if not found
   */
  async getFileContent(filePath, ref, owner, repo) {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref
      });

      if (response.data.content) {
        return Buffer.from(response.data.content, 'base64').toString('utf8');
      }

      return null;
    } catch (error) {
      logger.error('Failed to get file content from GitHub:', error);
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  /**
   * Get pull request information
   * @param {number} prNumber - Pull request number
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Pull request data
   */
  async getPullRequestInfo(prNumber, owner, repo) {
    try {
      const response = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get PR info from GitHub:', error);
      throw new Error(`Failed to get PR info: ${error.message}`);
    }
  }

  /**
   * Get pull request files
   * @param {number} prNumber - Pull request number
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} List of files changed in the PR
   */
  async getPullRequestFiles(prNumber, owner, repo) {
    try {
      const response = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get PR files from GitHub:', error);
      throw new Error(`Failed to get PR files: ${error.message}`);
    }
  }

  /**
   * Create a comment on a pull request
   * @param {number} prNumber - Pull request number
   * @param {string} body - Comment content
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Created comment data
   */
  async createPullRequestComment(prNumber, body, owner, repo) {
    try {
      const response = await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create PR comment:', error);
      throw new Error(`Failed to create PR comment: ${error.message}`);
    }
  }

  /**
   * Update pull request labels
   * @param {number} prNumber - Pull request number
   * @param {Array<string>} labels - List of labels to add
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Updated PR data
   */
  async updatePullRequestLabels(prNumber, labels, owner, repo) {
    try {
      const response = await this.octokit.rest.issues.setLabels({
        owner,
        repo,
        issue_number: prNumber,
        labels
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to update PR labels:', error);
      throw new Error(`Failed to update PR labels: ${error.message}`);
    }
  }
}

module.exports = new GitHubService(); 