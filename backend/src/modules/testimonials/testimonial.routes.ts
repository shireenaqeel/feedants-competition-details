import { Router } from 'express';
import { z } from 'zod';
import { publicBaseUrl } from '../../lib/http.js';
import { LANGUAGES, t } from '../../lib/i18n.js';
import { mediaUrl } from '../../lib/media.js';
import { TestimonialModel } from '../../models/testimonial.model.js';

export const testimonialRouter = Router();

const query = z.object({
  lang: z.enum(LANGUAGES).default('en'),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

testimonialRouter.get('/', async (req, res) => {
  const { lang, limit } = query.parse(req.query);
  const items = await TestimonialModel.find({ isPublished: true }).sort({ createdAt: -1 }).limit(limit).lean();
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    testimonials: items.map((x) => ({
      id: String(x._id),
      userName: x.userName,
      avatarUrl: mediaUrl(x.avatarUrl, publicBaseUrl(req)),
      text: t(x.text, lang),
      rating: x.rating ?? null,
    })),
  });
});
