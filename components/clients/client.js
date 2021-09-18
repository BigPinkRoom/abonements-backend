const escapeHtml = require('escape-html');

class Client {
  constructor({ client = null, params = null }) {
    if (client) {
      this.client = {
        surname: escapeHtml(client.surname),
        name: escapeHtml(client.name),
        patronymic: escapeHtml(client.patronymic),
        birthday: escapeHtml(client.birthday),
      };
    }

    if (params) {
      this.params = {
        sortings: params.sortings.map((param) => {
          return {
            name: escapeHtml(param.name),
            type: escapeHtml(param.type),
          };
        }),
      };
    }
  }
}

module.exports = Client;
