import bcrypt from "bcryptjs";

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export default hashPassword;
