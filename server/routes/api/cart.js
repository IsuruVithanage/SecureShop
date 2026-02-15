const express = require('express');
const router = express.Router();

// Bring in Models & Utils
const Cart = require('../../models/cart');
const Product = require('../../models/product');
const auth = require('../../middleware/auth');
const store = require('../../utils/store');

router.post('/add', auth, async (req, res) => {
  try {
    const user = req.user._id;
    const items = req.body.products;

    const products = store.caculateItemsSalesTax(items);

    const cart = new Cart({
      user,
      products
    });

    const cartDoc = await cart.save();

    decreaseQuantity(products);

    res.status(200).json({
      success: true,
      cartId: cartDoc.id
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

router.delete('/delete/:cartId', auth, async (req, res) => {
  try {
    const cartId = req.params.cartId;

    if (!mongoose.Types.ObjectId.isValid(cartId)) {
      return res.status(400).json({
        error: 'Invalid Cart ID format.'
      });
    }

    await Cart.deleteOne({ _id: cartId.toString() });

    res.status(200).json({
      success: true
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

router.post('/add/:cartId', auth, async (req, res) => {
  try {
    const cartId = req.params.cartId;
    const product = req.body.product;

    if (!mongoose.Types.ObjectId.isValid(cartId)) {
      return res.status(400).json({
        error: 'Invalid Cart ID format.'
      });
    }

    const query = { _id: cartId.toString() };

    await Cart.updateOne(query, { $push: { products: product.toString() } }).exec();

    res.status(200).json({
      success: true
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

router.delete('/delete/:cartId/:productId', auth, async (req, res) => {
  try {
    const cartId = req.params.cartId;
    const productId = req.params.productId;

    if (
      !mongoose.Types.ObjectId.isValid(cartId) ||
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      return res.status(400).json({
        error: 'Invalid ID format provided.'
      });
    }

    const query = { _id: cartId.toString() };
    const update = { $pull: { products: { product: productId.toString() } } };

    const result = await Cart.updateOne(query, update).exec();

    if (result.nModified === 0) {
      return res.status(404).json({
        message: 'Cart not found or you are not authorized to modify it.'
      });
    }

    res.status(200).json({
      success: true
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

const decreaseQuantity = products => {
  let bulkOptions = products.map(item => {
    return {
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { quantity: -item.quantity } }
      }
    };
  });

  Product.bulkWrite(bulkOptions);
};

module.exports = router;
