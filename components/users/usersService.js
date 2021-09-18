const { usersConstants } = require('./constants');

class UsersService {
  createSafeUser(user) {
    const safeUserData = {
      user_id: user.user_id,
      data_create: user.data_create,
      email: user.email,
      surname: user.surname,
      name: user.name,
      patronymic: user.patronymic,
      user_role: user.role_name,
    };

    return safeUserData;
  }

  checkUserRole(userRole, rolesArray) {
    const check = rolesArray.find((role) => role === userRole);
    return check ? true : false;
  }
}

module.exports = new UsersService();
