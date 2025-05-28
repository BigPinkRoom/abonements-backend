const escapeHtml = require('escape-html');

/**
 * Глобальный обработчик ошибок для Express.js.
 * Должен быть зарегистрирован ПОСЛЕ всех остальных маршрутов и middleware.
 *
 * @param {Error} err - Объект ошибки.
 * @param {import('express').Request} req - Объект запроса Express.
 * @param {import('express').Response} res - Объект ответа Express.
 * @param {import('express').NextFunction} next - Функция для передачи управления следующему middleware (редко используется здесь).
 */
function globalErrorHandler(err, req, res, next) {
  // Важно логировать ВСЕ ошибки, попадающие сюда
  console.error('--- Глобальный обработчик ошибок ---');
  console.error('Время:', new Date().toISOString());
  console.error('Маршрут:', req.originalUrl);
  console.error('Метод:', req.method);
  // Логировать можно больше информации: req.ip, req.headers, req.body (осторожно с чувствительными данными)
  console.error('Ошибка:', err); // Логируем сам объект ошибки (включая стек вызовов)
  console.error('------------------------------------');

  // Определяем HTTP статус
  // Используем статус из ошибки, если он есть (например, из http-errors или кастомных ошибок), иначе 500
  let statusCode =
    typeof err.status === 'number' ? err.status : typeof err.statusCode === 'number' ? err.statusCode : 500;

  // Формируем тело ответа об ошибке
  const responseErrorBody = {
    code: typeof err.code === 'string' ? err.code : 'Error:unexpected', // Код ошибки (для i18n или внутренней логики)
    message: '', // Сообщение для пользователя (может быть перезаписано ниже),
  };

  // Обработка ошибок валидации Joi
  if (err.isJoi) {
    statusCode = 422; // Unprocessable Entity
    responseErrorBody.code = 'Validation:failed';
    responseErrorBody.message = 'Ошибка валидации входных данных.';
    // Добавляем детали по каждому полю
    responseErrorBody.details = err.details.map((d) => ({
      field: d.path.join('.'), // Имя поля (может быть вложенным, например 'address.city')
      code: d.message, // Ваш ключ из схемы Joi (например, 'Email:required')
      // message: d.message // Можно добавить и само сообщение Joi, если нужно
    }));
  } else if (err.message) {
    // Для других типов ошибок используем их сообщение, если оно есть
    // Экранируем сообщение на всякий случай, если оно может содержать пользовательский ввод
    responseErrorBody.message = escapeHtml(err.message);
  } else {
    // Сообщение по умолчанию для совсем непредвиденных случаев
    responseErrorBody.message = 'Произошла внутренняя ошибка сервера.';
  }

  // Если ошибка пришла с полем 'field', добавим его
  if (typeof err.field === 'string') {
    responseErrorBody.field = err.field;
  }

  // Если ошибка содержит details (например, для кастомных ошибок бизнес-логики)
  // и это не ошибка Joi (у которой details уже обработаны)
  if (Array.isArray(err.details) && !err.isJoi) {
    responseErrorBody.details = err.details;
  }

  // В режиме разработки можно добавить стек вызовов в ответ (НЕ ДЛЯ ПРОДАКШЕНА!)
  // if (process.env.NODE_ENV === 'development' && statusCode === 500) {
  //   responseErrorBody.stack = err.stack;
  // }

  // Отправляем стандартизированный JSON ответ
  res.status(statusCode).json({
    error: responseErrorBody,
  });
}

module.exports = globalErrorHandler;
