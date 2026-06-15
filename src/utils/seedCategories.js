import mongoose from "mongoose";
import Category from "../modules/categories/category.model.js";
import { env } from "../config/env.js";

const categories = [
  { name: "Sales Automation", slug: "sales-automation", description: "Automate your sales processes and pipelines." },
  { name: "Operations Automation", slug: "operations-automation", description: "Streamline day-to-day business operations." },
  { name: "Marketing Systems", slug: "marketing-systems", description: "Build and automate marketing workflows." },
  { name: "Customer Support", slug: "customer-support", description: "Automate customer support and helpdesk systems." },
  { name: "Recruiting Automation", slug: "recruiting-automation", description: "Automate hiring and recruiting workflows." },
];

const seed = async () => {
  await mongoose.connect(env.MONGO_URI);

  for (const cat of categories) {
    await Category.updateOne({ slug: cat.slug }, { $setOnInsert: cat }, { upsert: true });
  }

  console.log("Categories seeded successfully");
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
