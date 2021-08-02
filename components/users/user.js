const escapeHtml = require('escape-html');

class User {
  constructor(userParams) {
    for (let paramName in userParams) {
      if (paramName) {
        this[paramName] = escapeHtml(userParams[paramName]);
      }
    }
  }
}

module.exports = User;
