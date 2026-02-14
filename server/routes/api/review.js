const express = require('express');
const router = express.Router();

// Bring in Models & Helpers
const Review = require('../../models/review');
const Product = require('../../models/product');
const auth = require('../../middleware/auth');
const { REVIEW_STATUS } = require('../../constants');
const {Types} = require("mongoose/lib/schema");

router.post('/add', auth, async (req, res) => {
  try {
    const user = req.user;

    const review = new Review({
      ...req.body,
      user: user._id
    });

    const reviewDoc = await review.save();

    res.status(200).json({
      success: true,
      message: `Your review has been added successfully and will appear when approved!`,
      review: reviewDoc
    });
  } catch (error) {
    return res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

// fetch all reviews api
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find()
      .sort('-created')
      .populate({
        path: 'user',
        select: 'firstName'
      })
      .populate({
        path: 'product',
        select: 'name slug imageUrl'
      })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Review.countDocuments();

    res.status(200).json({
      reviews,
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

router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;

    const safeSlug = String(slug);

    const productDoc = await Product.findOne({ slug: safeSlug });

    const hasNoBrand =
        productDoc?.brand === null || productDoc?.brand?.isActive === false;

    if (!productDoc || hasNoBrand) {
      return res.status(404).json({
        message: 'No product found.'
      });
    }

    const reviews = await Review.find({
      product: productDoc._id,
      status: REVIEW_STATUS.Approved
    }).populate('user');

    res.status(200).json({
      reviews
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const reviewId = req.params.id;
    const update = req.body;

    if (!Mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ error: 'Invalid Review ID' });
    }

    const query = { _id: new Mongoose.Types.ObjectId(reviewId) };

    await Review.findOneAndUpdate(query, update, {
      new: true
    });

    res.status(200).json({
      success: true,
      message: 'Review has been successfully updated!'
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

router.put('/approve/:reviewId', auth, async (req, res) => {
  try {
    const reviewId = req.params.reviewId;

    if (!Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ error: 'Invalid Review ID' });
    }
    const query = { _id: new Mongoose.Types.ObjectId(reviewId) };

    const update = {
      status: REVIEW_STATUS.Approved,
      isActive: true
    };

    await Review.findOneAndUpdate(query, update, {
      new: true
    });

    res.status(200).json({
      success: true,
      message: 'Review has been successfully approved!'
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

// reject review
router.put('/reject/:reviewId', auth, async (req, res) => {
  try {
    const reviewId = req.params.reviewId;

    // FIX: Validate & Sanitize
    if (!Mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ error: 'Invalid Review ID' });
    }
    const query = { _id: new Mongoose.Types.ObjectId(reviewId) };

    const update = {
      status: REVIEW_STATUS.Rejected
    };

    await Review.findOneAndUpdate(query, update, {
      new: true
    });

    res.status(200).json({
      success: true,
      message: 'Review has been successfully rejected!'
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

router.delete('/delete/:id', auth, async (req, res) => {
  try {
    const reviewId = req.params.id;

    // FIX: Validate & Sanitize
    if (!Mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ error: 'Invalid Review ID' });
    }

    const safeReviewId = new Mongoose.Types.ObjectId(reviewId);

    const review = await Review.deleteOne({ _id: safeReviewId });

    res.status(200).json({
      success: true,
      message: `Review has been deleted successfully!`,
      review
    });
  } catch (error) {
    res.status(400).json({
      error: 'Your request could not be processed. Please try again.'
    });
  }
});

module.exports = router;
