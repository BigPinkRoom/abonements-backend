module.exports.abonementsConstants = {
  ABONEMENTS_SORT_NAMES: ['number', 'visits_quantity', 'status', 'date_start', 'date_end', 'user_created_id'],
  ABONEMENTS_SORT_TYPES: ['ASC', 'DESC'],
  ABONEMENTS_FULL_SORT_NAMES: [
    'name',
    'surname',
    'patronymic',
    'birthday',
    'data_create',
    'number',
    'visits_quantity',
    'status',
    'date_start',
    'date_end',
    'user_created_id',
  ],
  ABONEMENTS_FULL_SORT_TYPES: ['ASC', 'DESC'],
  ABONEMENTS_FULL_CLIENT_COLUMNS: [
    'client_id',
    'client_birthday',
    'client_name',
    'client_patronymic',
    'client_surname',
  ],
  ABONEMENTS_FULL_FILTERS: {
    status: [1, 2, 3, 4, 5],
  },
  ABONEMENTS_FULL_FILTERS_TABLES_COLUMNS_ASSOTIATIONS: {
    abonememts: '',
    events: '',
  }
};
