import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function configurationError(message) {
  const error = new Error(message);
  error.isConfigurationError = true;
  return error;
}

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith('sk_')) {
    throw configurationError('A chave secreta do Stripe não está configurada corretamente.');
  }
  return new Stripe(key);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) return res.status(401).json({ error: 'Entre com Google' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      throw configurationError('A conexão do Supabase não está configurada corretamente.');
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Sessão inválida' });

    const plan = req.body?.plan;
    if (!['monthly', 'yearly'].includes(plan)) return res.status(400).json({ error: 'Plano inválido' });

    const price = plan === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_YEARLY;
    if (!price?.startsWith('price_')) {
      throw configurationError('O preço do plano Stripe não está configurado corretamente.');
    }

    const stripe = stripeClient();
    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('stripe_customer_id').eq('id', user.id).single();
    if (profileError) throw profileError;

    let customer = profile.stripe_customer_id;
    if (!customer) {
      const createdCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customer = createdCustomer.id;
      await supabase.from('profiles').update({ stripe_customer_id: customer }).eq('id', user.id);
    }

    const origin = process.env.PUBLIC_SITE_URL;
    if (!origin?.startsWith('https://')) {
      throw configurationError('A URL pública do site não está configurada corretamente.');
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription', customer, line_items: [{ price, quantity: 1 }],
      client_reference_id: user.id, metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
      success_url: `${origin}/?checkout=success`, cancel_url: `${origin}/?checkout=cancel`,
    });
    return res.status(200).json({ url: checkout.url });
  } catch (error) {
    console.error('Checkout error:', error);
    const message = error.isConfigurationError
      ? error.message
      : 'Não foi possível iniciar o checkout. Tente novamente em alguns instantes.';
    return res.status(500).json({ error: message });
  }
}
