const escapeHtml = require('escape-html');

class User {
  constructor({ email, password, passwordConfirm, name, surname, patronymic }) {
    this.email = escapeHtml(email);
    this.password = escapeHtml(password);
    this.passwordConfirm = escapeHtml(passwordConfirm);
    this.name = escapeHtml(name);
    this.surname = escapeHtml(surname);
    this.patronymic = escapeHtml(patronymic);
  }
}

module.exports = User;
