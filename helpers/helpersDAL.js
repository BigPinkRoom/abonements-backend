const { abonementsConstants } = require('../components/abonements/constants');

class helpersDAL {
  createSortingString(safeSortings) {
    if (safeSortings.length) {
      const strings = [];

      safeSortings.forEach((sort) => {
        strings.push(`${sort.name} ${sort.type}`);
      });

      return `ORDER BY ${strings.join(', ')}`;
    } else {
      return null;
    }
  }

  createFilteringString(safeFilters, columnDate) {
    console.log('createFilteringString received safeFilters:', JSON.stringify(safeFilters, null, 2));
    const strings = [];

    const filtersNames = Object.keys(safeFilters);

    filtersNames.forEach((filterName) => {
      console.log('Processing filterName:', filterName, 'with value:', safeFilters[filterName]);
      if (filterName === 'year') {
        strings.push(`${filterName}(${columnDate}) = ${safeFilters.year}`);
        return;
      }

      if (filterName === 'month') {
        strings.push(`${filterName}(${columnDate}) = ${safeFilters.month}`);
        return;
      }

      if (filterName === 'surname') {
        strings.push(`clients.surname LIKE '%${safeFilters[filterName]}%'`);
        return;
      }

      if (filterName === 'name') {
        strings.push(`clients.name LIKE '%${safeFilters[filterName]}%'`);
        return;
      }

      if (filterName === 'patronymic') {
        strings.push(`clients.patronymic LIKE '%${safeFilters[filterName]}%'`);
        return;
      }

      if (filterName === 'abonementId') {
        strings.push(`abonements.abonement_id = '${safeFilters[filterName]}'`);
        return;
      }

      if (filterName === 'dateStart') {
        strings.push(`abonements.date_start = '${safeFilters[filterName]}'`);
        return;
      }

      if (filterName === 'dateEnd') {
        strings.push(`abonements.date_end = '${safeFilters[filterName]}'`);
        return;
      }

      if (filterName === 'visitsQuantity') {
        strings.push(`abonements.visits_quantity = '${safeFilters[filterName]}'`);
        return;
      }

      if (filterName === 'visitsLeft') {
        strings.push(`abonements.visits_left = '${safeFilters[filterName]}'`);
        return;
      }

      if (filterName === 'statusId') {
        console.log(
          'Applying statusId filter. Value:',
          safeFilters[filterName],
          'Type:',
          typeof safeFilters[filterName]
        );
        strings.push(`abonements.status_id = ${safeFilters[filterName]}`);
        return;
      }

      //   abonementsConstants.ABONEMENTS_FULL_FILTERS_NAMES.forEach((item) => {});
      //   strings.push(`${filterName} = ${safeFilters[filterName]}`);
    });

    if (strings.length) {
      console.log('strings', `WHERE ${strings.join(' AND ')}`);
      return `WHERE ${strings.join(' AND ')}`;
    } else {
      return null;
    }
  }
}

module.exports = new helpersDAL();
