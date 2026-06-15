import User from "../users/user.model.js";
import generateToken from "../../utils/generateToken.js";
import hashPassword from "../../utils/hashPassword.js";
import comparePassword from "../../utils/comparePassword.js";

export const registerUser = async ({ name, email, password, role = "buyer" }) => {
  const normalizedEmail = email.toLowerCase();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new Error("Email already exists");
  }

  const hashedPassword = await hashPassword(password);

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: hashedPassword,
    role,
  });

  const token = generateToken(user);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
    token,
  };
};

export const loginUser = async ({ email, password }) => {
  const normalizedEmail = email.toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  const token = generateToken(user);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
    token,
  };
};

export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId).select("-password");
  if (!user) {
    throw new Error("User not found");
  }

  return user;
};
