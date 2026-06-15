import Category from "./category.model.js";

export const getAllCategories = async () => {
  return Category.find({ isActive: true }).select("-__v");
};

export const getCategoryBySlug = async (slug) => {
  const category = await Category.findOne({ slug, isActive: true }).select("-__v");
  if (!category) throw new Error("Category not found");
  return category;
};
