import { Router } from 'express';
import { prayers } from '../config/db.js';
import { authenticateUser } from '../middleware/auth.js';

const router = Router();

/* ================== GET ALL PRAYERS ================== */
router.get('/prayers', authenticateUser, async (req, res) => {
  try {
    const allPrayers = await prayers.find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      prayers: allPrayers
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch prayers' });
  }
});

/* ================== POST A PRAYER ================== */
router.post('/prayers', authenticateUser, async (req, res) => {
  try {
    const { text, author } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, message: 'Prayer text is required' });
    }

    // Sanitize: strip HTML tags and limit length
    const sanitizedText = text.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim().slice(0, 250);
    const sanitizedAuthor = (author || 'Anonymous').replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim().slice(0, 100);

    if (!sanitizedText) {
      return res.status(400).json({ success: false, message: 'Prayer text is required' });
    }

    const newPrayer = {
      text: sanitizedText,
      author: sanitizedAuthor,
      createdAt: new Date(),
    };

    await prayers.insertOne(newPrayer);
    res.status(201).json({ success: true, message: 'Prayer posted successfully', prayer: newPrayer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to post prayer' });
  }
});

export default router;
