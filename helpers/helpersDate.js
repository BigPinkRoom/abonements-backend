const { DateTime } = require('luxon');

class helpersDAL {
  createFormatDate(rawDate) {
    const jsDate = new Date(rawDate);
    const luxonDate = DateTime.fromJSDate(jsDate).setZone('utc');

    return luxonDate.toFormat('dd.MM.yy');
  }
}

module.exports = new helpersDAL();
