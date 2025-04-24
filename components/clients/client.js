const escapeHtml = require('escape-html');

class Client {
  constructor({ clients = null, relatives = null, telephones = null, search = null, params = null }) {
    if (clients && Array.isArray(clients)) {
      this.clients = clients.map((client) => {
        return {
          surname: escapeHtml(client.surname),
          name: escapeHtml(client.name),
          patronymic: escapeHtml(client.patronymic),
          birthday: escapeHtml(client.birthday),
        };
      });
    }

    if (relatives && Array.isArray(relatives)) {
      this.relatives = relatives.map((relative) => {
        return {
          name: escapeHtml(relative),
        };
      });
    }

    if (telephones && Array.isArray(telephones)) {
      this.telephones = telephones.map((telephone) => {
        return {
          telephone: escapeHtml(telephone),
        };
      });
    }

    if (search) {
      this.search = search;

      return {
        search: escapeHtml(search),
      };
    }
  }
}

module.exports = Client;
