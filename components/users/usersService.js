class UsersService {
  createSafeUser(user) {
    const safeUserData = {
      user_id: user.users_id,
      data_create: user.data_create,
      email: user.email,
      surname: user.surname,
      name: user.name,
      patronymic: user.patronymic,
      user_role: user.roles_id,
    };

    return safeUserData;
  }
}

module.exports = new UsersService();
