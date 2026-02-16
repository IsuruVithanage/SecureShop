const express = require('express');
const router = express.Router();
const Mongoose = require('mongoose');

// Bring in Models & Utils
const Order = require('../../models/order');
const Cart = require('../../models/cart');
const Product = require('../../models/product');
const auth = require('../../middleware/auth');
const mailgun = require('../../services/mailgun');
const store = require('../../utils/store');
const { ROLES, CART_ITEM_STATUS } = require('../../constants');

router.post('/add', auth, async (req, res) => {
  try {
    const cartId = req.body.cartId.toString();
    const user = req.user._id.toString();

    const sourceCart = await Cart.findById(cartId).populate('products.product');

    if (!sourceCart) {
      return res.status(400).json({ error: 'Cart not found.' });
    }

    let serverCalculatedTotal = 0;

    sourceCart.products.forEach(item => {
      if (item.product) {
        if (item.product.price < 0) {
          throw new Error(`Invalid price detected for ${item.product.name}`);
        }
        if (item.quantity <= 0) {
          throw new Error(`Invalid quantity detected for ${item.product.name}`);
        }
        serverCalculatedTotal += item.product.price * item.quantity;
      }
    });

    const order = new Order({
      cart: cartId,
      user,
      total: serverCalculatedTotal
    });

    const orderDoc = await order.save();

    const cartDoc = await Cart.findById(orderDoc.cart._id).populate({
      path: 'products.product',
      populate: {
        path: 'brand'
      }
    });

    const newOrder = {
      _id: orderDoc._id,
      created: orderDoc.created,
      user: orderDoc.user,
      total: orderDoc.total,
      products: cartDoc.products
    };

    await mailgun.sendEmail(order.user.email, 'order-confirmation', newOrder);

    res.status(200).json({
      success: true,
      message: `Your order has been placed successfully!`,
      order: { _id: orderDoc._id }
    });
  } catch (error) {
    res.status(400).json({
      error: error.message || 'Your request could not be processed. Please try again.'
    });
  }
});

// search orders api
router.get('/search', auth, async (req, res) => {
  try {
    const { search } = req.query;

    if (!Mongoose.Types.ObjectId.isValid(search)) {
      return res.status(200).json({
        orders: []
      });
    }

    let ordersDoc = null;

    if (req.user.role === ROLES.Admin) {
      ordersDoc = await Order.find({
        _id: Mongoose.Types.ObjectId(search)
      }).populate({
        path: 'cart',
        populate: {
          path: 'products.product',
          populate: {
            path: 'brand'
          }
        }
      });
    } else {
      const user = req.user._id;
      ordersDoc = await Order.find({
        _id: Mongoose.Types.ObjectId(search),
        user
      }).populate({
        path: 'cart',
        populate: {
          path: 'products.product',
          populate: {
            path: 'brand'
          }
        }
      });
    }

    ordersDoc = ordersDoc.filter(order => order.cart);

    if (ordersDoc.length > 0) {
      const newOrders = ordersDoc.map(o => {
        return {
          _id: o._id,
          total: parseFloat(Number(o.total.toFixed(2))),
          created: o.created,
          products: o.cart?.products
        };
      });

      let orders = newOrders.map(o => store.caculateTaxAmount(o));
      orders.sort((a, b) => b.created - a.created);
      res.status(200).json({
        orders
      });
    } else {
      res.status(200).json({
        orders: []
      });
    }
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

// fetch orders api
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const ordersDoc = await Order.find()
      .sort('-created')
      .populate({
        path: 'cart',
        populate: {
          path: 'products.product',
          populate: {
            path: 'brand'
          }
        }
      })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Order.countDocuments();
    const orders = store.formatOrders(ordersDoc);

    res.status(200).json({
      orders,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      count
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

// fetch my orders api
router.get('/me', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const user = req.user._id;
    const query = { user };

    const ordersDoc = await Order.find(query)
      .sort('-created')
      .populate({
        path: 'cart',
        populate: {
          path: 'products.product',
          populate: {
            path: 'brand'
          }
        }
      })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Order.countDocuments(query);
    const orders = store.formatOrders(ordersDoc);

    res.status(200).json({
      orders,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      count
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

// fetch order api
router.get('/:orderId', auth, async (req, res) => {
  try {
    const orderId = req.params.orderId;

    let orderDoc = null;

    if (!Mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        error: 'Invalid Order ID'
      });
    }

    const safeId = new Mongoose.Types.ObjectId(orderId);

    if (req.user.role === ROLES.Admin) {
      orderDoc = await Order.findOne({
        _id: safeId
      }).populate({
        path: 'cart',
        populate: {
          path: 'products.product',
          populate: {
            path: 'brand'
          }
        }
      });
    } else {
      const user = req.user._id;
      orderDoc = await Order.findOne({
        _id: safeId,
        user
      }).populate({
        path: 'cart',
        populate: {
          path: 'products.product',
          populate: {
            path: 'brand'
          }
        }
      });
    }

    if (!orderDoc || !orderDoc.cart) {
      return res.status(404).json({
        message: `Cannot find order with the id: ${orderId}.`
      });
    }

    let order = {
      _id: orderDoc._id,
      total: orderDoc.total,
      created: orderDoc.created,
      totalTax: 0,
      products: orderDoc?.cart?.products,
      cartId: orderDoc.cart._id
    };

    order = store.caculateTaxAmount(order);

    res.status(200).json({
      order
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

router.delete('/cancel/:orderId', auth, async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // 1. VALIDATE
    if (!Mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid Order ID' });
    }

    // 2. SANITIZE
    const safeId = new Mongoose.Types.ObjectId(orderId);

    // 3. USE SAFE ID
    const order = await Order.findOne({ _id: safeId });

    // Add null check to prevent crash if order not found
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const foundCart = await Cart.findOne({ _id: order.cart });

    if (foundCart) {
      increaseQuantity(foundCart.products);
      await Cart.deleteOne({ _id: order.cart });
    }

    // Use safeId here as well
    await Order.deleteOne({ _id: safeId });

    res.status(200).json({
      success: true
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

router.put('/status/item/:itemId', auth, async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const orderId = req.body.orderId;
    const cartId = req.body.cartId;
    const status = req.body.status || CART_ITEM_STATUS.Cancelled;

    // 1. VALIDATE & SANITIZE: itemId (The main blocker)
    if (!Mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ error: 'Invalid Item ID' });
    }
    const safeItemId = new Mongoose.Types.ObjectId(itemId);

    // 2. USE SAFE ID in the query
    // This fixes the specific SonarQube error on line 317
    const foundCart = await Cart.findOne({ 'products._id': safeItemId });

    if (!foundCart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    // Find the product in the array (convert to string for safe comparison)
    const foundCartProduct = foundCart.products.find(p => p._id.toString() === safeItemId.toString());

    if (!foundCartProduct) {
      return res.status(404).json({ error: 'Product not found in cart' });
    }

    await Cart.updateOne(
        { 'products._id': safeItemId },
        {
          'products.$.status': status
        }
    );

    if (status === CART_ITEM_STATUS.Cancelled) {
      await Product.updateOne(
          { _id: foundCartProduct.product },
          { $inc: { quantity: foundCartProduct.quantity } }
      );

      // Validate other IDs before using them in deleteOne (Best Practice)
      if (cartId && Mongoose.Types.ObjectId.isValid(cartId)) {
        const safeCartId = new Mongoose.Types.ObjectId(cartId);
        const cart = await Cart.findOne({ _id: safeCartId });

        if (cart) {
          const items = cart.products.filter(
              item => item.status === CART_ITEM_STATUS.Cancelled
          );

          // All items are cancelled => Cancel order
          if (cart.products.length === items.length) {
            // Secure the orderId deletion as well
            if (orderId && Mongoose.Types.ObjectId.isValid(orderId)) {
              await Order.deleteOne({ _id: new Mongoose.Types.ObjectId(orderId) });
            }
            await Cart.deleteOne({ _id: safeCartId });

            return res.status(200).json({
              success: true,
              orderCancelled: true,
              message: `${
                  req.user.role === ROLES.Admin ? 'Order' : 'Your order'
              } has been cancelled successfully`
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Item has been cancelled successfully!'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Item status has been updated successfully!'
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

const increaseQuantity = products => {
  let bulkOptions = products.map(item => {
    return {
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { quantity: item.quantity } }
      }
    };
  });

  Product.bulkWrite(bulkOptions);
};

module.exports = router;
