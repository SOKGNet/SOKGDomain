const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const config = require('./config');
const reservedWordsService = require('./reserved-words');
const sldService = require('./sld-service');
const logger = require('./logger');

class PRValidator {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    // PR title regex: Registration/Update/Remove: domain-name.sld
    this.titleRegex = /^(Registration|Update|Remove):\s+([a-zA-Z0-9-]+)\.(.+)$/;
    this.errors = [];
  }

  /**
   * Main validation function
   */
  async validatePullRequest() {
    console.log('🔍 Starting PR validation process');
    
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      details: {
        titleValid: false,
        fileCountValid: false,
        filePathValid: false,
        jsonValid: false,
        actionType: null,
        domainName: null,
        sld: null,
        fileName: null
      }
    };

    try {
      // Get PR information
      const prData = this.getPRDataFromEnv();
      console.log(`Validating PR #${prData.number}: ${prData.title}`);

      // 1. Validate PR title format
      const titleValidation = await this.validateTitle(prData.title);
      validationResult.details.titleValid = titleValidation.isValid;
      validationResult.details.actionType = titleValidation.actionType;
      validationResult.details.domainName = titleValidation.domainName;
      validationResult.details.sld = titleValidation.sld;
      
      if (!titleValidation.isValid) {
        validationResult.errors.push(titleValidation.error);
        validationResult.isValid = false;
      }

      // 2. Validate PR description length
      const descriptionValidation = this.validatePRDescription(prData.body);
      if (!descriptionValidation) {
        validationResult.errors.push('PR description cannot be empty');
        validationResult.isValid = false;
      }

      // 3. Validate file count
      const fileCountValidation = this.validateFileCount(prData.files);
      validationResult.details.fileCountValid = fileCountValidation;
      
      if (!fileCountValidation) {
        validationResult.errors.push('PR must contain at least one file change');
        validationResult.isValid = false;
      }

      // 4. Validate file path
      if (prData.files.length > 0) {
        const filePathValidation = this.validateFilePath(prData.files[0].filename);
        validationResult.details.filePathValid = filePathValidation;
        validationResult.details.fileName = prData.files[0].filename;
        
        if (!filePathValidation) {
          validationResult.errors.push('File path is incorrect. File must be located in the whois/ directory and be a .json file.');
          validationResult.isValid = false;
        }

        // 5. Validate JSON format (only for added and modified files)
        if (filePathValidation && ['added', 'modified'].includes(prData.files[0].status)) {
          const jsonValidation = await this.validateJsonContent(prData.files[0], prData);
          validationResult.details.jsonValid = jsonValidation.isValid;
          
          if (!jsonValidation.isValid) {
            validationResult.errors.push(jsonValidation.error);
            validationResult.isValid = false;
          }
        } else if (prData.files[0].status === 'removed') {
          // For deleted files, no need to validate JSON content
          validationResult.details.jsonValid = true;
        }

        // 6. Validate title and filename consistency
        if (titleValidation.isValid && filePathValidation) {
          const consistencyValidation = this.validateTitleFileConsistency(
            titleValidation, 
            prData.files[0].filename
          );
          
          if (!consistencyValidation.isValid) {
            validationResult.errors.push(consistencyValidation.error);
            validationResult.isValid = false;
          }
        }
      }

      // Log validation results
      this.logValidationResult(validationResult, prData.number);
      
      // Generate validation report
      const report = this.generateValidationReport(validationResult, prData.author);
      validationResult.report = report;

      // Save results to file
      this.saveValidationResult(validationResult);
      
      return validationResult;

    } catch (error) {
      console.error('Error occurred during validation:', error);
      validationResult.isValid = false;
      validationResult.errors.push(`Internal validation error: ${error.message}`);
      validationResult.report = `## ❌ PR Validation Failed\n\nInternal error occurred during validation: ${error.message}`;
      this.saveValidationResult(validationResult);
      return validationResult;
    }
  }

  /**
   * Get PR data from environment variables
   */
  getPRDataFromEnv() {
    const prTitle = process.env.PR_TITLE || '';
    const prBody = process.env.PR_BODY || '';
    const prNumber = process.env.PR_NUMBER || '';
    const prAuthor = process.env.PR_AUTHOR || '';
    const prFiles = JSON.parse(process.env.PR_FILES || '[]');
    const headSha = process.env.HEAD_SHA || '';

    return {
      title: prTitle,
      body: prBody,
      number: prNumber,
      author: prAuthor,
      files: prFiles,
      headSha: headSha
    };
  }

  /**
   * Validate PR title format
   */
  async validateTitle(title) {
    const result = {
      isValid: false,
      actionType: null,
      domainName: null,
      sld: null,
      error: null
    };

    if (!title || typeof title !== 'string') {
      result.error = 'PR title cannot be empty';
      return result;
    }

    const match = title.match(this.titleRegex);
    
    if (!match) {
      result.error = `PR title format is incorrect. Correct format should be: "Registration/Update/Remove: {domain-name}.{sld}". Current title: "${title}"`;
      return result;
    }

    const actionType = match[1];
    const domainName = match[2];
    const sldPart = match[3];

    // Validate if sld part is in the supported list
    const sldValidation = await this.validateDomainSuffix(sldPart);
    if (!sldValidation.isValid) {
      result.error = sldValidation.error;
      return result;
    }

    result.isValid = true;
    result.actionType = actionType;
    result.domainName = domainName;
    result.sld = sldPart;

    return result;
  }

  /**
   * Validate PR description length
   */
  validatePRDescription(body) {
    const result = {
      isValid: false,
      error: null
    };

    if (!body || typeof body !== 'string') {
      result.error = 'PR description cannot be empty';
      return result;
    }

    // Check if description length is less than 1300 characters
    if (body.length < config.validation.minDescriptionLength) {
      result.error = `PR description is too short. Description should be filled according to the template, requiring at least ${config.validation.minDescriptionLength} characters. Current length: ${body.length} characters. Please use the provided PR template to complete all required confirmation items.`;
      return result;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate file count
   */
  validateFileCount(files) {
    const result = {
      isValid: false,
      error: null
    };

    if (!Array.isArray(files)) {
      result.error = 'Unable to get file change information';
      return result;
    }

    if (files.length === 0) {
      result.error = 'PR must contain at least one file change';
      return result;
    }

    if (files.length > config.validation.maxFileCount) {
      result.error = `PR can only contain 1 file change, currently contains ${files.length} files: ${files.map(f => f.filename).join(', ')}`;
      return result;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate file path
   */
  validateFilePath(file) {
    const result = {
      isValid: false,
      error: null
    };

    if (!file || !file.filename) {
      result.error = 'Unable to get file information';
      return result;
    }

    // Check if file path is whois/*.json
    if (!config.validation.filePathPattern.test(file.filename)) {
      result.error = `File path is incorrect. File must be located in the whois/ directory and be a .json file. Current file: "${file.filename}"`;
      return result;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate JSON content format
   */
  async validateJsonContent(file, prData) {
    const result = {
      isValid: false,
      error: null
    };

    try {
      // Get file content
      const fileContent = await this.getFileContent(file, prData);
      
      if (!fileContent) {
        result.error = 'Unable to get file content';
        return result;
      }

      // Validate JSON format
      try {
        const jsonData = JSON.parse(fileContent);
        
        // Check if it's null or undefined
        if (jsonData === null || jsonData === undefined) {
          result.error = 'JSON file content cannot be null or undefined';
          return result;
        }

        // Basic JSON structure validation
        if (typeof jsonData !== 'object' || Array.isArray(jsonData)) {
          result.error = 'JSON file root level must be an object';
          return result;
        }

        // Detailed field validation
        const fieldValidation = await this.validateJsonFields(jsonData);
        if (!fieldValidation.isValid) {
          result.error = fieldValidation.error;
          return result;
        }

        result.isValid = true;
        return result;

      } catch (parseError) {
        result.error = `Invalid JSON format: ${parseError.message}`;
        return result;
      }

    } catch (error) {
      console.error('Error occurred while getting file content:', error);
      result.error = `Error occurred while validating JSON content: ${error.message}`;
      return result;
    }
  }

  /**
   * Validate JSON field content
   */
  async validateJsonFields(jsonData) {
    const result = {
      isValid: false,
      error: null
    };

    // 1. Validate registrant field
    const registrantValidation = this.validateRegistrant(jsonData.registrant);
    if (!registrantValidation.isValid) {
      result.error = registrantValidation.error;
      return result;
    }

    // 2. Validate domain field
    const domainValidation = await this.validateDomainField(jsonData.domain);
    if (!domainValidation.isValid) {
      result.error = domainValidation.error;
      return result;
    }

    // 3. Validate sld field
    const sldValidation = this.validateSldField(jsonData.sld);
    if (!sldValidation.isValid) {
      result.error = sldValidation.error;
      return result;
    }

    // 4. Validate nameservers field
    const nameserversValidation = this.validateNameservers(jsonData.nameservers);
    if (!nameserversValidation.isValid) {
      result.error = nameserversValidation.error;
      return result;
    }

    // 5. Validate agree_to_agreements field
    const agreementsValidation = this.validateAgreements(jsonData.agree_to_agreements);
    if (!agreementsValidation.isValid) {
      result.error = agreementsValidation.error;
      return result;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate registrant field (email format)
   */
  validateRegistrant(registrant) {
    const result = { isValid: false, error: null };

    if (!registrant || typeof registrant !== 'string') {
      result.error = 'registrant field is required and must be a string';
      return result;
    }

    // Email format validation regular expression
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(registrant)) {
      result.error = `registrant must be a valid email address. Current value: "${registrant}"`;
      return result;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate domain field
   */
  async validateDomainField(domain) {
    const result = { isValid: false, error: null };

    if (!domain || typeof domain !== 'string') {
      result.error = 'domain field is required and must be a string';
      return result;
    }

    // Length validation
    if (domain.length <= 3) {
      result.error = `domain must be more than 3 characters. Current length: ${domain.length}`;
      return result;
    }

    // Domain format validation: alphanumeric and hyphens, or xn-- format punycode
    const domainRegex = /^[a-zA-Z0-9-]+$|^xn--[a-zA-Z0-9-]+$/;
    
    if (!domainRegex.test(domain)) {
      result.error = `domain must be alphanumeric with hyphens or xn-- format punycode. Current value: "${domain}"`;
      return result;
    }

    // Validate that it cannot start or end with a hyphen
    if (domain.startsWith('-') || domain.endsWith('-')) {
      result.error = `domain cannot start or end with a hyphen. Current value: "${domain}"`;
      return result;
    }

    // Validate that domain is not in reserved words list
    const reservedWordsValidation = await this.validateDomainNotReserved(domain);
    if (!reservedWordsValidation.isValid) {
      result.error = reservedWordsValidation.error;
      return result;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate that domain is not in reserved words list
   */
  async validateDomainNotReserved(domain) {
    const result = { isValid: false, error: null };

    try {
      // Get the latest reserved words list from service
      const reservedWords = await reservedWordsService.getReservedWords();

      if (!reservedWords || !Array.isArray(reservedWords)) {
        console.warn('Unable to get reserved words list, skipping reserved words check');
        result.isValid = true;
        return result;
      }

      // Check if domain conflicts with reserved words
      const domainLower = domain.toLowerCase();
      
      for (const reservedWord of reservedWords) {
        if (domainLower === reservedWord.toLowerCase()) {
          result.error = `Domain "${domain}" conflicts with reserved word "${reservedWord}" and cannot be used. Reserved words are used to protect system functions and avoid confusion.`;
          return result;
        }
      }

      result.isValid = true;
      return result;

    } catch (error) {
      console.error('Error occurred while checking reserved words:', error);
      
      // Use fallback reserved words to ensure safety when error occurs
      const fallbackWords = reservedWordsService.getFallbackWords();
      const domainLower = domain.toLowerCase();
      
      for (const reservedWord of fallbackWords) {
        if (domainLower === reservedWord.toLowerCase()) {
          result.error = `Domain "${domain}" conflicts with reserved word "${reservedWord}" and cannot be used. Reserved words are used to protect system functions and avoid confusion.`;
          return result;
        }
      }

      result.isValid = true;
      return result;
    }
  }

  /**
   * Validate sld field
   */
  async validateSldField(sld) {
    const result = { isValid: false, error: null };

    if (!sld || typeof sld !== 'string') {
      result.error = 'sld field is required and must be a string';
      return result;
    }

    // Validate if sld is in the supported list
    const sldValidation = await this.validateDomainSuffix(sld);
    if (!sldValidation.isValid) {
      result.error = sldValidation.error;
      return result;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate nameservers field
   */
  validateNameservers(nameservers) {
    const result = { isValid: false, error: null };

    if (!nameservers || !Array.isArray(nameservers)) {
      result.error = 'nameservers field is required and must be an array';
      return result;
    }

    // Quantity validation
    if (nameservers.length < 2) {
      result.error = `nameservers must have at least 2 entries, currently has ${nameservers.length}`;
      return result;
    }

    if (nameservers.length > 6) {
      result.error = `nameservers allows maximum 6 entries, currently has ${nameservers.length}`;
      return result;
    }

    // Duplicate validation
    const uniqueNameservers = [...new Set(nameservers)];
    if (uniqueNameservers.length !== nameservers.length) {
      result.error = 'nameservers contains duplicate domain names';
      return result;
    }

    // Domain format validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/;
    
    for (let i = 0; i < nameservers.length; i++) {
      const ns = nameservers[i];
      
      if (!ns || typeof ns !== 'string') {
        result.error = `nameservers[${i}] must be a string`;
        return result;
      }

      // Check that it cannot end with a dot
      if (ns.endsWith('.')) {
        result.error = `nameservers[${i}] cannot end with a dot. Current value: "${ns}"`;
        return result;
      }

      // Validate domain format
      if (!domainRegex.test(ns)) {
        result.error = `nameservers[${i}] is not a valid domain format. Current value: "${ns}"`;
        return result;
      }

      // Validate that it must contain at least one dot
      if (!ns.includes('.')) {
        result.error = `nameservers[${i}] must be a complete domain name (containing dots). Current value: "${ns}"`;
        return result;
      }
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate agree_to_agreements field
   */
  validateAgreements(agreements) {
    const result = { isValid: false, error: null };

    if (!agreements || typeof agreements !== 'object' || Array.isArray(agreements)) {
      result.error = 'agree_to_agreements field is required and must be an object';
      return result;
    }

    // Required agreement fields
    const requiredAgreements = [
      'registration_and_use_agreement',
      'acceptable_use_policy', 
      'privacy_policy'
    ];

    for (const agreement of requiredAgreements) {
      if (!(agreement in agreements)) {
        result.error = `agree_to_agreements is missing required field: ${agreement}`;
        return result;
      }

      if (agreements[agreement] !== true) {
        result.error = `agree_to_agreements.${agreement} must be true. Current value: ${agreements[agreement]}`;
        return result;
      }
    }

    result.isValid = true;
    return result;
  }

  /**
   * Validate title and filename consistency
   */
  validateTitleFileConsistency(titleValidation, fileName) {
    const result = {
      isValid: false,
      error: null
    };

    // Extract domain from filename: whois/example.com.json -> example.com
    const fileNameRegex = /^whois\/([^\/]+)\.json$/;
    const fileMatch = fileName.match(fileNameRegex);
    
    if (!fileMatch) {
      result.error = 'Unable to extract domain information from filename';
      return result;
    }

    const fileBaseName = fileMatch[1]; // example.com
    const titleDomainFull = `${titleValidation.domainName}.${titleValidation.sld}`; // example.com

    if (fileBaseName !== titleDomainFull) {
      result.error = `Domain "${titleDomainFull}" in PR title does not match domain "${fileBaseName}" in filename`;
      return result;
    }

    result.isValid = true;
    return result;
  }

  /**
   * Get file content
   */
  async getFileContent(file, prData) {
    try {
      // For added files, extract content from patch
      if (file.status === 'added' && file.patch) {
        return this.extractContentFromPatch(file.patch);
      }

      // For modified files, get the latest version
      if (file.status === 'modified') {
        const [owner, repo] = config.github.repository.split('/');
        const response = await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path: file.filename,
          ref: prData.headSha
        });
        
        if (response.data.content) {
          return Buffer.from(response.data.content, 'base64').toString('utf8');
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get file content:', error);
      return null;
    }
  }

  /**
   * Extract file content from patch
   */
  extractContentFromPatch(patch) {
    if (!patch) return null;

    const lines = patch.split('\n');
    const content = [];
    
    for (const line of lines) {
      // Skip patch header information
      if (line.startsWith('@@') || line.startsWith('+++') || line.startsWith('---')) {
        continue;
      }
      
      // Add new lines (starting with +, but not +++)
      if (line.startsWith('+') && !line.startsWith('+++')) {
        content.push(line.substring(1)); // Remove the + sign
      }
    }
    
    return content.join('\n');
  }

  /**
   * Log validation results
   */
  logValidationResult(validationResult, prNumber) {
    if (validationResult.isValid) {
      console.log(`✅ PR #${prNumber} validation passed`);
      console.log(`   Action type: ${validationResult.details.actionType}`);
      console.log(`   Domain: ${validationResult.details.domainName}.${validationResult.details.sld}`);
      console.log(`   File: ${validationResult.details.fileName}`);
    } else {
      console.log(`❌ PR #${prNumber} validation failed`);
      validationResult.errors.forEach((error, index) => {
        console.log(`   Error ${index + 1}: ${error}`);
      });
    }

    if (validationResult.warnings.length > 0) {
      console.log(`⚠️  PR #${prNumber} has warnings:`);
      validationResult.warnings.forEach((warning, index) => {
        console.log(`   Warning ${index + 1}: ${warning}`);
      });
    }
  }

  /**
   * Generate validation report message (for GitHub comments)
   */
  generateValidationReport(validationResult, mentionUser = null) {
    if (validationResult.isValid) {
      return `## ✅ PR Validation Passed

**Validation Results:**
- ✅ Title format is correct
- ✅ PR description length meets requirements
- ✅ File count meets requirements (1 file)
- ✅ File path is correct (whois/*.json)
- ✅ JSON format is valid
- ✅ Title and filename are consistent

**Details:**
- **Action type:** ${validationResult.details.actionType}
- **Domain:** ${validationResult.details.domainName}.${validationResult.details.sld}
- **File:** ${validationResult.details.fileName}

This PR meets all requirements and can proceed with review.`;
    } else {
      let report = `## ❌ PR Validation Failed

${mentionUser ? `@${mentionUser} ` : ''}**The following issues were found:**
`;
      
      validationResult.errors.forEach((error, index) => {
        report += `${index + 1}. ❌ ${error}\n`;
      });

      // Generate targeted help information based on specific errors
      const helpSections = this.generateTargetedHelp(validationResult.errors);
      
      if (helpSections.length > 0) {
        report += `\n**Solutions:**\n`;
        helpSections.forEach((section, index) => {
          report += `\n### ${index + 1}. ${section.title}\n${section.content}\n`;
        });
      }

      report += `\n**Need help?** Please refer to the [PR template](https://raw.githubusercontent.com/PublicFreeSuffix/PublicFreeSuffix/refs/heads/main/.github/PULL_REQUEST_TEMPLATE/WHOIS_FILE_OPERATION.md) or check the project documentation.`;

      return report;
    }
  }

  /**
   * Generate targeted help information based on error types
   */
  generateTargetedHelp(errors) {
    const helpSections = [];
    const errorTypes = this.categorizeErrors(errors);

    if (errorTypes.titleFormat) {
      helpSections.push({
        title: "Fix Title Format",
        content: `The title must strictly follow this format:
\`\`\`
Registration: example.no.kg
Update: example.no.kg  
Remove: example.no.kg
\`\`\`

**Supported domain suffixes:** ${config.sld ? config.sld.join(', ') : 'Please check configuration'}

**Examples:**
- ✅ \`Registration: mycompany.no.kg\`
- ❌ \`Add new domain mycompany.no.kg\`
- ❌ \`Registration mycompany.no.kg\` (missing colon)`
      });
    }

    if (errorTypes.descriptionLength) {
      helpSections.push({
        title: "Complete PR Description",
        content: `The PR description must be filled out completely according to the template, requiring at least 1300 characters.

**Solutions:**
1. Use the provided PR template
2. Complete all confirmation items (including all checkboxes)
3. Provide detailed operation instructions and contact information
4. Confirm all agreement terms

**Template link:** [WHOIS_FILE_OPERATION.md](https://raw.githubusercontent.com/PublicFreeSuffix/PublicFreeSuffix/refs/heads/main/.github/PULL_REQUEST_TEMPLATE/WHOIS_FILE_OPERATION.md)`
      });
    }

    if (errorTypes.fileCount) {
      helpSections.push({
        title: "Adjust File Count",
        content: `Each PR can only contain 1 file change.

**Solutions:**
- If you need to handle multiple domains, create separate PRs
- Check if other files were accidentally included
- Ensure only the target JSON file was modified`
      });
    }

    if (errorTypes.filePath) {
      helpSections.push({
        title: "Fix File Path",
        content: `Files must be located in the \`whois/\` directory and be \`.json\` files.

**Correct file path format:**
\`\`\`
whois/example.no.kg.json
whois/mycompany.so.kg.json
\`\`\`

**File naming rules:**
- Filename must exactly match the domain name
- Must have \`.json\` extension
- Must be located in the \`whois/\` directory`
      });
    }

    // Add more error type help information...
    // You can continue adding help for other error types here

    return helpSections;
  }

  /**
   * Categorize error messages
   */
  categorizeErrors(errors) {
    const categories = {
      titleFormat: false,
      descriptionLength: false,
      fileCount: false,
      filePath: false,
      jsonFormat: false,
      registrant: false,
      domain: false,
      reservedWords: false,
      sld: false,
      nameservers: false,
      agreements: false,
      consistency: false
    };

    errors.forEach(error => {
      const errorLower = error.toLowerCase();
      
      if (errorLower.includes('title format') || errorLower.includes('pr title')) {
        categories.titleFormat = true;
      }
      if (errorLower.includes('description') && errorLower.includes('1300')) {
        categories.descriptionLength = true;
      }
      if (errorLower.includes('file change') || errorLower.includes('file count')) {
        categories.fileCount = true;
      }
      if (errorLower.includes('file path') || errorLower.includes('whois/')) {
        categories.filePath = true;
      }
      if (errorLower.includes('json format') || (errorLower.includes('json') && errorLower.includes('invalid'))) {
        categories.jsonFormat = true;
      }
      if (errorLower.includes('registrant') || errorLower.includes('email')) {
        categories.registrant = true;
      }
      if (errorLower.includes('domain') && !errorLower.includes('reserved')) {
        categories.domain = true;
      }
      if (errorLower.includes('reserved') || errorLower.includes('conflicts')) {
        categories.reservedWords = true;
      }
      if (errorLower.includes('sld') || errorLower.includes('suffix')) {
        categories.sld = true;
      }
      if (errorLower.includes('nameservers') || errorLower.includes('dns')) {
        categories.nameservers = true;
      }
      if (errorLower.includes('agree_to_agreements') || errorLower.includes('agreement')) {
        categories.agreements = true;
      }
      if (errorLower.includes('not match') || errorLower.includes('consistency')) {
        categories.consistency = true;
      }
    });

    return categories;
  }

  /**
   * Save validation results to file
   */
  saveValidationResult(validationResult) {
    try {
      const resultPath = path.join(__dirname, 'validation-result.json');
      fs.writeFileSync(resultPath, JSON.stringify(validationResult, null, 2));
      console.log('Validation result saved to:', resultPath);
    } catch (error) {
      console.error('Failed to save validation result:', error);
    }
  }

  /**
   * Validate domain suffix is supported
   */
  async validateDomainSuffix(suffix) {
    const result = { isValid: false, error: null };

    try {
      // Get supported SLD list
      const supportedSLDs = await sldService.getSupportedSLDs();

      if (!supportedSLDs || !Array.isArray(supportedSLDs)) {
        result.error = 'Unable to validate domain suffix due to SLD list unavailable';
        return result;
      }

      // Check if suffix is supported
      if (!supportedSLDs.includes(suffix)) {
        result.error = `Domain suffix "${suffix}" is not supported. Supported suffixes are: ${supportedSLDs.join(', ')}`;
        return result;
      }

      result.isValid = true;
      return result;

    } catch (error) {
      console.error('Error occurred while validating domain suffix:', error);
      result.error = `Failed to validate domain suffix: ${error.message}`;
      return result;
    }
  }

  /**
   * Validate SLD status
   */
  async validateSLDStatus(sld) {
    try {
      const status = await sldService.getSLDStatus(sld);
      
      if (!status) {
        this.errors.push(`Unable to retrieve status information for SLD "${sld}"`);
        return false;
      }

      if (status.toLowerCase() !== 'ok') {
        this.errors.push(`SLD "${sld}" has status "${status}" which is not available. Only SLDs with status "ok" are accepted`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error occurred while validating SLD status:', error);
      this.errors.push(`Error validating SLD status: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate PR consistency
   */
  async validatePRConsistency(title, filePath) {
    const titleMatch = /^(Add|Update|Remove|Delete) ([a-z0-9-]+\.[a-z0-9-]+)$/i.exec(title);
    if (!titleMatch) return false;

    const [, action, domain] = titleMatch;
    const [sld, tld] = domain.toLowerCase().split('.');
    const expectedPath = `${sld}/${tld}.json`;

    if (filePath.toLowerCase() !== expectedPath) {
      this.errors.push('PR title does not match file path');
      return false;
    }

    // Validate SLD status for Add and Update actions
    if (action.toLowerCase() === 'add' || action.toLowerCase() === 'update') {
      const isValidStatus = await this.validateSLDStatus(sld);
      if (!isValidStatus) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get validation errors
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Clear validation errors
   */
  clearErrors() {
    this.errors = [];
  }
}

// Main execution function
async function main() {
  try {
    console.log('Starting PR validation...');
    const validator = new PRValidator();
    const result = await validator.validatePullRequest();
    
    if (result.isValid) {
      console.log('✅ All validations passed');
      process.exit(0);
    } else {
      console.log('❌ Validation failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('Validation process failed:', error);
    process.exit(1);
  }
}

// If running this script directly
if (require.main === module) {
  main();
}

module.exports = new PRValidator(); 