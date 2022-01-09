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
    const strings = [];

    const filtersNames = Object.keys(safeFilters);

    filtersNames.forEach((filterName) => {
      if (filterName === 'year') {
        strings.push(`${filterName}(${columnDate}) = ${safeFilters.year}`);

        return;
      }

      if (filterName === 'month') {
        strings.push(`${filterName}(${columnDate}) = ${safeFilters.month}`);

        return;
      }

      strings.push(`${filterName} = ${safeFilters[filterName]}`);
    });

    if (strings.length) {
      return `WHERE ${strings.join(' AND ')}`;
    } else {
      return null;
    }
  }
}

module.exports = new helpersDAL();
