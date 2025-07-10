/**
 * Registrant validator module
 */

class RegistrantValidator {
  validate(registrant) {
    const result = { isValid: false, error: null };

    // 1. Type validation
    if (!registrant || typeof registrant !== 'string') {
      result.error = 'registrant field is required and must be a string';
      return result;
    }

    // 2. Email format validation
    // RFC 5322 compliant email regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!emailRegex.test(registrant)) {
      result.error = `registrant must be a valid email address. Current value: "${registrant}"`;
      return result;
    }

    // 3. Additional email validations
    // Check for multiple @ symbols
    if ((registrant.match(/@/g) || []).length !== 1) {
      result.error = `registrant email cannot contain multiple @ symbols. Current value: "${registrant}"`;
      return result;
    }

    // Check domain part has at least one dot
    const [, domain] = registrant.split('@');
    if (!domain.includes('.')) {
      result.error = `registrant email domain must contain at least one dot. Current value: "${registrant}"`;
      return result;
    }

    // Check length limits
    if (registrant.length > 254) {
      result.error = `registrant email is too long (max 254 characters). Current length: ${registrant.length}`;
      return result;
    }

    const localPart = registrant.split('@')[0];
    if (localPart.length > 64) {
      result.error = `registrant email local part is too long (max 64 characters). Current length: ${localPart.length}`;
      return result;
    }

    result.isValid = true;
    return result;
  }
}

module.exports = new RegistrantValidator(); 