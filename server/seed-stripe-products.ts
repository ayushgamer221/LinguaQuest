import { getUncachableStripeClient } from './stripeClient';

const SUBSCRIPTION_PRODUCTS = [
  {
    name: 'Rookie',
    description: 'Beginner lessons, daily quests, and basic speaking exercises',
    price: 400,
    features: ['Beginner lessons', 'Daily quests', 'Basic speaking exercises']
  },
  {
    name: 'Intermediate',
    description: 'All Rookie features plus grammar challenges and monthly quests',
    price: 800,
    features: ['All Rookie features', 'Grammar challenges', 'Monthly quests', 'Progress analytics']
  },
  {
    name: 'Expert',
    description: 'Advanced learning with AI conversation practice and certificates',
    price: 1600,
    features: ['All previous features', 'AI conversation practice', 'Certificates', 'Vocabulary trainer']
  },
  {
    name: 'Master',
    description: 'Complete mastery program with all features unlocked',
    price: 2000,
    features: ['Everything unlocked', 'Personal dashboard', 'Advanced speaking', 'Priority features']
  }
];

export async function seedStripeProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    console.log('Seeding Stripe products...');

    for (const product of SUBSCRIPTION_PRODUCTS) {
      const existingProducts = await stripe.products.search({
        query: `name:'${product.name}'`
      });

      if (existingProducts.data.length > 0) {
        const existingProduct = existingProducts.data[0];
        console.log(`Product "${product.name}" exists, checking price...`);
        
        const prices = await stripe.prices.list({
          product: existingProduct.id,
          active: true
        });
        
        const currentPrice = prices.data[0];
        if (currentPrice && currentPrice.unit_amount !== product.price) {
          await stripe.prices.update(currentPrice.id, { active: false });
          
          await stripe.prices.create({
            product: existingProduct.id,
            unit_amount: product.price,
            currency: 'usd',
            recurring: { interval: 'month' }
          });
          console.log(`Updated price for ${product.name}: $${product.price / 100}/month`);
        } else {
          console.log(`Price for ${product.name} is correct, skipping...`);
        }
        continue;
      }

      const stripeProduct = await stripe.products.create({
        name: product.name,
        description: product.description,
        metadata: {
          features: JSON.stringify(product.features)
        }
      });

      await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: product.price,
        currency: 'usd',
        recurring: { interval: 'month' }
      });

      console.log(`Created product: ${product.name} - $${product.price / 100}/month`);
    }

    console.log('Stripe products seeded successfully!');
  } catch (error: any) {
    console.error('Error seeding Stripe products:', error.message);
  }
}

seedStripeProducts().then(() => process.exit(0));
