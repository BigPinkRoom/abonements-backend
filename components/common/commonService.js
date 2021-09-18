class CommonService {
  checkUserRole(userRole, rolesArray) {
    const check = rolesArray.find((role) => role === userRole);
    return check ? true : false;
  }
}

module.exports = new CommonService();
