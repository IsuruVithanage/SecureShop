// server/utils/seed.js

const chalk = require("chalk");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { faker } = require("@faker-js/faker");

const setupDB = require("./db"); // Make sure this points to your Mongo connection
const { ROLES } = require("../constants");
const User = require("../models/user");
const Brand = require("../models/brand");
const Product = require("../models/product");
const Category = require("../models/category");

require("dotenv").config({ path: __dirname + "/../.env" });
console.log("Loaded MONGO_URI:", process.env.MONGO_URI);
// Get CLI args
const args = process.argv.slice(2);
const email = args[0];
const password = args[1];

if (!email || !password) {
  console.log(
    chalk.red("❌ Usage: node server/utils/seed.js <email> <password>"),
  );
  process.exit(1);
}

// Constants
const NUM_PRODUCTS = 100;
const NUM_BRANDS = 10;
const NUM_CATEGORIES = 10;

const seedDB = async () => {
  try {
    console.log(chalk.blue("🔹 Seed database started..."));

    // -------------------
    // Admin user
    // -------------------
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      console.log(chalk.yellow("⏳ Seeding admin user..."));
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({
        email,
        password: hashedPassword,
        firstName: "Admin",
        lastName: "User",
        role: ROLES.Admin,
      });
      await user.save();
      console.log(chalk.green("✅ Admin user created."));
    } else {
      console.log(chalk.yellow("⚠ Admin user already exists, skipping."));
    }

    // -------------------
    // Categories
    // -------------------
    let categories = [];
    const categoriesCount = await Category.countDocuments();
    if (categoriesCount >= NUM_CATEGORIES) {
      categories = await Category.find().select("_id");
      console.log(
        chalk.yellow(
          `⚠ ${categoriesCount} categories exist, skipping seeding.`,
        ),
      );
    } else {
      console.log(chalk.yellow("⏳ Seeding categories..."));
      for (let i = 0; i < NUM_CATEGORIES; i++) {
        const category = new Category({
          name: faker.commerce.department(),
          description: faker.lorem.sentence(),
          isActive: true,
        });
        await category.save();
        categories.push(category);
      }
      console.log(chalk.green(`✅ ${NUM_CATEGORIES} categories seeded.`));
    }

    // -------------------
    // Brands
    // -------------------
    const brandsCount = await Brand.countDocuments();
    let brands = [];
    if (brandsCount >= NUM_BRANDS) {
      brands = await Brand.find().select("_id");
      console.log(
        chalk.yellow(`⚠ ${brandsCount} brands exist, skipping seeding.`),
      );
    } else {
      console.log(chalk.yellow("⏳ Seeding brands..."));
      for (let i = 0; i < NUM_BRANDS; i++) {
        const brand = new Brand({
          name: faker.company.name(),
          description: faker.lorem.sentence(),
          isActive: true,
        });
        await brand.save();
        brands.push(brand);
      }
      console.log(chalk.green(`✅ ${NUM_BRANDS} brands seeded.`));
    }

    // If brands array is empty (already existed), fetch IDs
    if (brands.length === 0) brands = await Brand.find().select("_id");

    // -------------------
    // Products
    // -------------------
    const productsCount = await Product.countDocuments();
    if (productsCount >= NUM_PRODUCTS) {
      console.log(
        chalk.yellow(`⚠ ${productsCount} products exist, skipping seeding.`),
      );
    } else {
      console.log(chalk.yellow("⏳ Seeding products..."));
      for (let i = 0; i < NUM_PRODUCTS; i++) {
        const randomCategoryIndex = faker.number.int({
          min: 0,
          max: categories.length - 1,
        });
        const product = new Product({
          sku: faker.string.alphanumeric(10),
          name: faker.commerce.productName(),
          description: faker.lorem.sentence(),
          quantity: faker.number.int({ min: 1, max: 100 }),
          price: faker.commerce.price(),
          taxable: faker.datatype.boolean(),
          isActive: true,
          brand:
            brands[faker.number.int({ min: 0, max: brands.length - 1 })]._id,
          category: categories[randomCategoryIndex]._id,
        });
        await product.save();
        // Associate product with category
        await Category.updateOne(
          { _id: categories[randomCategoryIndex]._id },
          { $push: { products: product._id } },
        );
      }
      console.log(
        chalk.green(
          `✅ ${NUM_PRODUCTS} products seeded and linked to categories.`,
        ),
      );
    }

    console.log(chalk.blue("🎉 Database seeding completed!"));
  } catch (error) {
    console.error(chalk.red("❌ Error while seeding database:"), error);
  } finally {
    await mongoose.connection.close();
    console.log(chalk.blue("🔹 Database connection closed."));
  }
};

// Run
(async () => {
  try {
    await setupDB(); // Connect to Mongo
    await seedDB(); // Seed everything
  } catch (error) {
    console.error(chalk.red("❌ Seeding failed:"), error);
  }
})();
