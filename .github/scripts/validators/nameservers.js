/**
 * Nameservers validator module
 */

class NameserversValidator {
  validate(nameservers) {
    const result = { isValid: false, error: null };

    // 1. Type validation
    if (!nameservers || !Array.isArray(nameservers)) {
      result.error = 'nameservers field is required and must be an array';
      return result;
    }

    // 2. Length validation
    if (nameservers.length < 2) {
      result.error = `nameservers must have at least 2 entries, currently has ${nameservers.length}`;
      return result;
    }

    if (nameservers.length > 6) {
      result.error = `nameservers allows maximum 6 entries, currently has ${nameservers.length}`;
      return result;
    }

    // 3. Duplicate validation
    const uniqueNameservers = [...new Set(nameservers)];
    if (uniqueNameservers.length !== nameservers.length) {
      result.error = 'nameservers contains duplicate entries';
      return result;
    }

    // 4. Domain format validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/;
    
    for (let i = 0; i < nameservers.length; i++) {
      const ns = nameservers[i];
      
      // Type check for each entry
      if (!ns || typeof ns !== 'string') {
        result.error = `nameservers[${i}] must be a string`;
        return result;
      }

      // No trailing dot
      if (ns.endsWith('.')) {
        result.error = `nameservers[${i}] cannot end with a dot. Current value: "${ns}"`;
        return result;
      }

      // Domain format check
      if (!domainRegex.test(ns)) {
        result.error = `nameservers[${i}] is not a valid domain format. Current value: "${ns}"`;
        return result;
      }

      // Must contain at least one dot (for multi-level domains)
      if (!ns.includes('.')) {
        result.error = `nameservers[${i}] must be a complete domain name (containing dots). Current value: "${ns}"`;
        return result;
      }

      // Check domain levels (2-4 levels allowed)
      const parts = ns.split('.');
      if (parts.length < 2 || parts.length > 4) {
        result.error = `nameservers[${i}] must be a valid domain with 2-4 levels. Current value: "${ns}"`;
        return result;
      }
    }

    result.isValid = true;
    return result;
  }
}

module.exports = new NameserversValidator(); 