import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { cardId, action, lang } = body;

  if (typeof cardId !== 'string' || cardId.length < 8 || cardId.length > 64) {
    return res.status(400).json({ error: 'Invalid cardId' });
  }
  if (!['share', 'download'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${proto}://${host}`;

  const isZh = lang === 'zh';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: isZh ? '解锁这张卡' : 'Unlock this card',
            description: isZh
              ? '一次性 $1,解锁分享与下载这张卡'
              : 'One-time $1 — unlock share & download for this card',
          },
          unit_amount: 100,
        },
        quantity: 1,
      }],
      metadata: { cardId, action },
      success_url: `${baseUrl}/?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?canceled=1`,
      locale: isZh ? 'zh' : 'en',
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('checkout error:', e);
    return res.status(500).json({ error: e.message || 'Stripe error' });
  }
}
