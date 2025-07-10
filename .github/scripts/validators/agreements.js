/**
 * Agreements validator module
 */

class AgreementsValidator {
  validate(agreements) {
    const result = { isValid: false, error: null };

    // 1. Type validation
    if (!agreements || typeof agreements !== 'object' || Array.isArray(agreements)) {
      result.error = 'agree_to_agreements field is required and must be an object';
      return result;
    }

    // 2. Required fields validation
    const requiredAgreements = [
      'registration_and_use_agreement',
      'acceptable_use_policy',
      'privacy_policy'
    ];

    // Check for missing fields
    const missingFields = requiredAgreements.filter(field => !(field in agreements));
    if (missingFields.length > 0) {
      result.error = `agree_to_agreements is missing required fields: ${missingFields.join(', ')}`;
      return result;
    }

    // 3. Check for extra fields
    const extraFields = Object.keys(agreements).filter(field => !requiredAgreements.includes(field));
    if (extraFields.length > 0) {
      result.error = `agree_to_agreements contains unexpected fields: ${extraFields.join(', ')}`;
      return result;
    }

    // 4. Value validation
    for (const agreement of requiredAgreements) {
      const value = agreements[agreement];
      
      // Type check
      if (typeof value !== 'boolean') {
        result.error = `agree_to_agreements.${agreement} must be a boolean. Current value: ${value}`;
        return result;
      }

      // Must be true
      if (value !== true) {
        result.error = `agree_to_agreements.${agreement} must be true. Current value: ${value}`;
        return result;
      }
    }

    result.isValid = true;
    return result;
  }
}

module.exports = new AgreementsValidator(); 