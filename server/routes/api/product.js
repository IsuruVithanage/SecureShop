const express = require('express');
const router = express.Router();
const multer = require('multer');
const Mongoose = require('mongoose');

// Bring in Models & Utils
const Product = require('../../models/product');
const Brand = require('../../models/brand');
const Category = require('../../models/category');
const auth = require('../../middleware/auth');
const role = require('../../middleware/role');
const checkAuth = require('../../utils/auth');
const { s3Upload } = require('../../utils/storage');
const {
  getStoreProductsQuery,
  getStoreProductsWishListQuery
} = require('../../utils/queries');
const { ROLES } = require('../../constants');

const storage = multer.memoryStorage();
const upload = multer({ storage });

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// fetch product slug api
router.get('/item/:slug', async (req, res) => {
  try {
    // 1. SANITIZE: Explicitly cast to String
    // This tells SonarQube that 'safeSlug' is definitely a string, not a malicious object.
    const safeSlug = String(req.params.slug);

    if (!safeSlug) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    // 2. USE SAFE VARIABLE in the query
    const productDoc = await Product.findOne({ slug: safeSlug, isActive: true }).populate({
      path: 'brand',
      select: 'name isActive slug'
    });

    if (!productDoc || (productDoc && productDoc?.brand?.isActive === false)) {
      return res.status(404).json({
        message: 'No product found.'
      });
    }

    res.status(200).json({
      product: productDoc
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

// fetch product name search api
router.get('/list/search/:name', async (req, res) => {
  try {
    const name = req.params.name;

    // 1. SANITIZE: Use the helper function you created
    // This prevents ReDoS (S2631) by escaping special characters like * or +
    const safeName = escapeRegex(name);

    // 2. CREATE REGEX: Use the sanitized string, NOT the raw 'name'
    const regex = new RegExp(safeName, 'is');

    // 3. QUERY: Use the safe regex in MongoDB
    const productDoc = await Product.find(
        { name: { $regex: regex }, isActive: true },
        {
          name: 1,
          slug: 1,
          imageUrl: 1,
          price: 1,
          _id: 0
        }
    );

    if (productDoc.length < 0) {
      return res.status(404).json({
        message: 'No product found.'
      });
    }

    res.status(200).json({
      products: productDoc
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

router.get('/list', async (req, res) => {
  try {
    let {
      sortOrder,
      rating,
      max,
      min,
      category,
      brand,
      page = 1,
      limit = 10
    } = req.query;

    // --- FIX START: Sanitize sortOrder ---
    // Prevent NoSQL Injection by rebuilding the sort object safely
    let safeSortOrder = { created: -1 }; // Default sort

    try {
      if (sortOrder) {
        const parsedSort = JSON.parse(sortOrder);
        const allowedSortFields = ['price', 'created', 'name', 'rating'];

        // Reset to empty so we only add valid keys
        let validSort = {};

        Object.keys(parsedSort).forEach(key => {
          if (allowedSortFields.includes(key)) {
            // Force value to be a number (1 or -1) to prevent operator injection
            const val = Number(parsedSort[key]);
            if (val === 1 || val === -1) {
              validSort[key] = val;
            }
          }
        });

        // Only update if we found valid keys
        if (Object.keys(validSort).length > 0) {
          safeSortOrder = validSort;
        }
      }
    } catch (error) {
      console.log('Invalid sortOrder JSON, using default');
      safeSortOrder = { created: -1 };
    }
    // --- FIX END ---

    const basicQuery = getStoreProductsQuery(min, max, rating);

    const userDoc = await checkAuth(req);

    // FIX: Only query Category if provided
    if (category) {
      const categorySlug = String(category); // Explicit cast
      const categoryDoc = await Category.findOne({
        slug: categorySlug,
        isActive: true
      });

      if (categoryDoc) {
        basicQuery.push({
          $match: {
            isActive: true,
            _id: {
              $in: Array.from(categoryDoc.products)
            }
          }
        });
      }
    }

    // FIX: Only query Brand if provided
    if (brand) {
      const brandSlug = String(brand); // Explicit cast
      const brandDoc = await Brand.findOne({
        slug: brandSlug,
        isActive: true
      });

      if (brandDoc) {
        basicQuery.push({
          $match: {
            'brand._id': { $eq: brandDoc._id }
          }
        });
      }
    }

    // Use safeSortOrder in pagination
    let products = null;
    const productsCount = await Product.aggregate(basicQuery);
    const count = productsCount.length;
    const size = count > limit ? page - 1 : 0;
    const currentPage = count > limit ? Number(page) : 1;

    // paginate query
    const paginateQuery = [
      { $sort: safeSortOrder }, // <--- USE THE SANITIZED VARIABLE
      { $skip: size * limit },
      { $limit: limit * 1 }
    ];

    if (userDoc) {
      const wishListQuery = getStoreProductsWishListQuery(userDoc.id).concat(
          basicQuery
      );
      products = await Product.aggregate(wishListQuery.concat(paginateQuery));
    } else {
      products = await Product.aggregate(basicQuery.concat(paginateQuery));
    }

    res.status(200).json({
      products,
      totalPages: Math.ceil(count / limit),
      currentPage,
      count
    });
  } catch (error) {
    console.log('error', error);
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

router.get('/list/select', auth, async (req, res) => {
  try {
    const products = await Product.find({}, 'name');

    res.status(200).json({
      products
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

// add product api
router.post(
  '/add',
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  upload.single('image'),
  async (req, res) => {
    try {
      const sku = req.body.sku;
      const name = req.body.name;
      const description = req.body.description;
      const quantity = req.body.quantity;
      const price = req.body.price;
      const taxable = req.body.taxable;
      const isActive = req.body.isActive;
      const brand = req.body.brand;
      const image = req.file;

      if (!sku) {
        return res.status(400).json({ error: 'You must enter sku.' });
      }

      if (!description || !name) {
        return res
          .status(400)
          .json({ error: 'You must enter description & name.' });
      }

      if (!quantity) {
        return res.status(400).json({ error: 'You must enter a quantity.' });
      }

      if (!price) {
        return res.status(400).json({ error: 'You must enter a price.' });
      }

      const safeSku = String(sku);

      const foundProduct = await Product.findOne({ sku: safeSku });

      if (foundProduct) {
        return res.status(400).json({ error: 'This sku is already in use.' });
      }

      const { imageUrl, imageKey } = await s3Upload(image);

      const product = new Product({
        sku,
        name,
        description,
        quantity,
        price,
        taxable,
        isActive,
        brand,
        imageUrl,
        imageKey
      });

      const savedProduct = await product.save();

      res.status(200).json({
        success: true,
        message: `Product has been added successfully!`,
        product: savedProduct
      });
    } catch (error) {
      return res.status(400).json({
        error: 'Your request could not be processed. Please try again.'
      });
    }
  }
);

// fetch products api
router.get(
  '/',
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  async (req, res) => {
    try {
      let products = [];

      if (req.user.merchant) {
        const brands = await Brand.find({
          merchant: req.user.merchant
        }).populate('merchant', '_id');

        const brandId = brands[0]?.['_id'];

        products = await Product.find({})
          .populate({
            path: 'brand',
            populate: {
              path: 'merchant',
              model: 'Merchant'
            }
          })
          .where('brand', brandId);
      } else {
        products = await Product.find({}).populate({
          path: 'brand',
          populate: {
            path: 'merchant',
            model: 'Merchant'
          }
        });
      }

      res.status(200).json({
        products
      });
    } catch (error) {
      res.status(400).json({
        error: 'Your request could not be processed. Please try again.'
      });
    }
  }
);

// fetch product api
router.get(
  '/:id',
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  async (req, res) => {
    try {
      const productId = req.params.id;

      let productDoc = null;

      if (!Mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(404).json({ message: 'Product not found.' });
      }
      const safeProductId = new Mongoose.Types.ObjectId(productId);

      if (req.user.merchant) {
        const brands = await Brand.find({
          merchant: req.user.merchant
        }).populate('merchant', '_id');

        const brandId = brands[0]['_id'];

        productDoc = await Product.findOne({ _id: safeProductId })
          .populate({
            path: 'brand',
            select: 'name'
          })
          .where('brand', brandId);
      } else {
        productDoc = await Product.findOne({ _id: safeProductId }).populate({
          path: 'brand',
          select: 'name'
        });
      }

      if (!productDoc) {
        return res.status(404).json({
          message: 'No product found.'
        });
      }

      res.status(200).json({
        product: productDoc
      });
    } catch (error) {
      res.status(400).json({
        error: 'Your request could not be processed. Please try again.'
      });
    }
  }
);

router.put('/:id', auth, role.check(ROLES.Admin, ROLES.Merchant), async (req, res) => {
  try {
    const productId = req.params.id;
    const update = req.body.product;
    const query = { _id: productId };
    const { sku, slug } = req.body.product;

    // FIX: Validate ObjectId
    if (!Mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid Product ID' });
    }
    // FIX: Sanitize ID for the query
    const safeQuery = { _id: new Mongoose.Types.ObjectId(productId) };

    // FIX: Sanitize Slug and SKU
    const safeSlug = String(slug);
    const safeSku = String(sku);

    const foundProduct = await Product.findOne({
      $or: [{ slug: safeSlug }, { sku: safeSku }]
    });

    if (foundProduct && foundProduct._id.toString() !== productId) {
      return res.status(400).json({ error: 'Sku or slug is already in use.' });
    }

    await Product.findOneAndUpdate(safeQuery, update, {
      new: true
    });

    res.status(200).json({
      success: true,
      message: 'Product has been updated successfully!'
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

router.put('/:id/active', auth, role.check(ROLES.Admin, ROLES.Merchant), async (req, res) => {
  try {
    const productId = req.params.id;
    const update = req.body.product;

    // FIX: Validate ID first
    if (!Mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid Product ID' });
    }

    // FIX: Create safe query
    const query = { _id: new Mongoose.Types.ObjectId(productId) };

    await Product.findOneAndUpdate(query, update, {
      new: true
    });

    res.status(200).json({
      success: true,
      message: 'Product has been updated successfully!'
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

router.delete(
  '/delete/:id',
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  async (req, res) => {
    try {
      const productId = req.params.id;

      if (!Mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ error: 'Invalid Product ID' });
      }

      const product = await Product.deleteOne({ _id: new Mongoose.Types.ObjectId(productId) });

      res.status(200).json({
        success: true,
        message: `Product has been deleted successfully!`,
        product
      });
    } catch (error) {
      res.status(400).json({
        error: 'Your request could not be processed. Please try again.'
      });
    }
  }
);

module.exports = router;
