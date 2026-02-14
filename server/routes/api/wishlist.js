const express = require('express');
const router = express.Router();

// Bring in Models & Helpers
const Wishlist = require('../../models/wishlist');
const auth = require('../../middleware/auth');

router.post('/', auth, async (req, res) => {
  try {
    const { product, isLiked } = req.body;
    const user = req.user;

    // FIX: Validate Product ID first
    if (!Mongoose.Types.ObjectId.isValid(product)) {
      return res.status(400).json({ error: 'Invalid Product ID' });
    }

    // FIX: Sanitize Product ID
    const safeProductId = new Mongoose.Types.ObjectId(product);

    const update = {
      product: safeProductId,
      isLiked,
      updated: Date.now()
    };

    // FIX: Use the safe ID in the query
    const query = { product: safeProductId, user: user._id };

    const updatedWishlist = await Wishlist.findOneAndUpdate(query, update, {
      new: true,
      upsert: true // Creates the document if it doesn't exist
    });

    res.status(200).json({
      success: true,
      wishlist: updatedWishlist
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

// fetch wishlist api
router.get('/', auth, async (req, res) => {
  try {
    const user = req.user._id;

    const wishlist = await Wishlist.find({ user, isLiked: true })
      .populate({
        path: 'product',
        select: 'name slug price imageUrl'
      })
      .sort('-updated');

    res.status(200).json({
      wishlist
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

module.exports = router;
