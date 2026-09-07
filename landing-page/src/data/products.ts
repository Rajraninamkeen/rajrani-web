export interface Product {
  id: string;
  name: string;
  tagline: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  weight: string;
  rating: number;
  reviewCount: number;
  image: string;
  category: 'bestseller' | 'spicy' | 'mixtures' | 'healthy' | 'gifts';
  spiceLevel: 1 | 2 | 3 | 4; // 1: Mild, 2: Medium, 3: Spicy, 4: Fiery Hot
  isNew?: boolean;
  isBestseller?: boolean;
  stockLeft: number;
  ingredients: string[];
  regionOrigin: string;
  nutritionalInfo: {
    calories: string;
    protein: string;
    fat: string;
    carbs: string;
  };
  description: string;
  pairingSuggestion: string;
  customerFavTag: string;
}

export interface Review {
  id: string;
  name: string;
  location: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
  verifiedBuyer: boolean;
  productBought: string;
  photoUrl?: string;
  avatar: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'Ingredients' | 'Delivery & Payment' | 'Shelf Life' | 'Offers';
}

export interface Bundle {
  id: string;
  name: string;
  tagline: string;
  price: number;
  originalPrice: number;
  items: string[];
  image: string;
  badge: string;
  savingAmount: number;
  popular?: boolean;
}

export const PRODUCTS: Product[] = [
  {
    id: 'ratlami-sev',
    name: 'Bilokat Royal Ratlami Sev',
    tagline: 'Signature Clove-Infused Melt-in-Mouth Sev',
    price: 189,
    originalPrice: 240,
    discountPercent: 21,
    weight: '400g Zip-Pouch',
    rating: 4.9,
    reviewCount: 3820,
    image: '/images/bilokat-hero-pack.jpg',
    category: 'spicy',
    spiceLevel: 4,
    isBestseller: true,
    stockLeft: 12,
    regionOrigin: 'Ratlam, Madhya Pradesh',
    ingredients: ['Gram Flour (Besan)', '100% Pure Cold-Pressed Peanut Oil', 'Heirloom Laung (Clove)', 'Kali Mirch (Black Pepper)', 'Ajwain', 'Rock Salt'],
    nutritionalInfo: { calories: '162 kcal / 30g', protein: '4.2g', fat: '9.8g (0g Trans Fat)', carbs: '13.5g' },
    description: 'Craved across all 28 states of India! Handcrafted using the legendary century-old Ratlam recipe with rich clove notes, spicy pepper kick, and zero palm oil.',
    pairingSuggestion: 'Perfect topping for Poha, Sev Tamatar Sabzi, or simply with hot Ginger Masala Chai.',
    customerFavTag: '#1 Best Seller in India'
  },
  {
    id: 'shahi-kaju-mixture',
    name: 'Bilokat Shahi Rajwadi Kaju Blend',
    tagline: 'Rich Roasted Cashews, Almonds & Crisp Flakes',
    price: 299,
    originalPrice: 399,
    discountPercent: 25,
    weight: '350g Zip-Pouch',
    rating: 4.9,
    reviewCount: 2450,
    image: '/images/bilokat-assorted-box.jpg',
    category: 'bestseller',
    spiceLevel: 2,
    isBestseller: true,
    stockLeft: 8,
    regionOrigin: 'Rajwadi Jodhpur Heritage',
    ingredients: ['Jumbo Goa Cashews (25%)', 'California Almonds (15%)', 'Spiced Poha Flakes', 'Melon Seeds', 'Black Raisins', 'Amchur', 'Cold-Pressed Peanut Oil'],
    nutritionalInfo: { calories: '175 kcal / 30g', protein: '5.1g', fat: '11.2g', carbs: '12.0g' },
    description: 'The ultimate royal indulgence. Loaded with premium Whole Roasted Cashews and California Almonds tossed with sweet & savory aromatic spices.',
    pairingSuggestion: 'Must-have for evening party hosting, festive celebrations & luxury cocktail hours.',
    customerFavTag: 'Party Favorite'
  },
  {
    id: 'khatta-meetha-delight',
    name: 'Bilokat Malwa Khatta Meetha Mixture',
    tagline: 'Sweet, Tangy & Irresistibly Crunchy Blend',
    price: 169,
    originalPrice: 220,
    discountPercent: 23,
    weight: '400g Zip-Pouch',
    rating: 4.8,
    reviewCount: 1890,
    image: 'https://images.pexels.com/photos/9557672/pexels-photo-9557672.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
    category: 'mixtures',
    spiceLevel: 1,
    isBestseller: true,
    stockLeft: 19,
    regionOrigin: 'Indore Malwa Special',
    ingredients: ['Crispy Sev', 'Fried Peanuts', 'Sweet Raisins', 'Crispy Rice Flakes', 'Tangy Mango Powder', 'Organic Jaggery Spice Mix'],
    nutritionalInfo: { calories: '150 kcal / 30g', protein: '3.8g', fat: '8.2g', carbs: '15.1g' },
    description: 'The golden balance of tangy dry mango, sweet raisins, and crunchy savory flakes. Loved by kids and grandparents alike!',
    pairingSuggestion: 'Enjoy as a guilt-free 4 PM office snack or movie night accompaniment.',
    customerFavTag: 'All-Age Favorite'
  },
  {
    id: 'bikaneri-aloo-bhujia',
    name: 'Bilokat Bikaneri Royal Aloo Bhujia',
    tagline: 'Super Crisp Potato & Moth Bean Crisps',
    price: 159,
    originalPrice: 199,
    discountPercent: 20,
    weight: '400g Zip-Pouch',
    rating: 4.9,
    reviewCount: 2980,
    image: 'https://images.pexels.com/photos/34217297/pexels-photo-34217297.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
    category: 'spicy',
    spiceLevel: 3,
    isBestseller: true,
    stockLeft: 15,
    regionOrigin: 'Bikaner, Rajasthan',
    ingredients: ['Fresh Potato Starch', 'Moth Bean Flour', 'Ghee Infused Spice Dust', 'Peanut Oil', 'Hing (Asafoetida)', 'Sendha Namak'],
    nutritionalInfo: { calories: '158 kcal / 30g', protein: '3.5g', fat: '9.0g', carbs: '14.2g' },
    description: 'Extruded to paper-thin crispness, fried to light golden hue in pure peanut oil, and dusted with hing and tangy mint pepper.',
    pairingSuggestion: 'Scatter over Uttapam, Parathas, Cheese Toast, or eat straight out of the pack.',
    customerFavTag: 'Crunch Champions'
  },
  {
    id: 'roasted-peri-makhana',
    name: 'Bilokat Roasted Peri-Peri Foxnut (Makhana)',
    tagline: '100% Roasted, Zero Oil, Protein-Packed Crunch',
    price: 249,
    originalPrice: 320,
    discountPercent: 22,
    weight: '150g Jar Pack',
    rating: 4.8,
    reviewCount: 1120,
    image: 'https://images.pexels.com/photos/18301125/pexels-photo-18301125.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
    category: 'healthy',
    spiceLevel: 2,
    isNew: true,
    stockLeft: 23,
    regionOrigin: 'Mithila Bihar Artisanal',
    ingredients: ['Jumbo Foxnuts (Phool Makhana)', 'Cold-Pressed Olive Oil Spray', 'Fiery Peri-Peri Spice Mix', 'Himalayan Pink Salt', 'Garlic & Herb Seasoning'],
    nutritionalInfo: { calories: '110 kcal / 30g', protein: '4.8g', fat: '3.1g', carbs: '16.0g' },
    description: 'Jumbo premium Foxnuts roasted with olive oil spray and dusted with spicy tangy Peri Peri spices. Zero guilt, high fiber & protein.',
    pairingSuggestion: 'Ideal for workout sessions, late-night study marathons & keto diets.',
    customerFavTag: 'Fitness Enthusiast Pick'
  },
  {
    id: 'nylon-sev-gujarati',
    name: 'Bilokat Silk Nylon Sev (Chaat Special)',
    tagline: 'Extra Fine Ultra-Crisp Golden Filament Sev',
    price: 139,
    originalPrice: 175,
    discountPercent: 20,
    weight: '350g Zip-Pouch',
    rating: 4.9,
    reviewCount: 1640,
    image: 'https://images.pexels.com/photos/38453276/pexels-photo-38453276.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
    category: 'mixtures',
    spiceLevel: 1,
    stockLeft: 31,
    regionOrigin: 'Surat, Gujarat',
    ingredients: ['Refined Gram Flour', 'Pure Peanut Oil', 'Turmeric', 'Sea Salt', 'Mild Hing'],
    nutritionalInfo: { calories: '152 kcal / 30g', protein: '4.0g', fat: '8.8g', carbs: '13.8g' },
    description: 'Feather-light, whisper-thin golden nylon sev made specifically for street-style Bhel Puri, Sev Puri, Dahi Puri & Papdi Chaat at home.',
    pairingSuggestion: 'The essential garnish for all home-made Indian street snacks and salads.',
    customerFavTag: 'Chaat Master Must-Have'
  },
  {
    id: 'roasted-diet-chana',
    name: 'Bilokat Hing Jeera Slow-Roasted Chana',
    tagline: 'Crisp Roasted Black Chickpeas with Asafoetida & Cumin',
    price: 149,
    originalPrice: 189,
    discountPercent: 21,
    weight: '400g Zip-Pouch',
    rating: 4.7,
    reviewCount: 940,
    image: 'https://images.pexels.com/photos/36631827/pexels-photo-36631827.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
    category: 'healthy',
    spiceLevel: 2,
    stockLeft: 18,
    regionOrigin: 'Kanpur Desi Roastery',
    ingredients: ['Black Chickpeas (Kala Chana)', 'Roasted Cumin Powder', 'Pure Hing', 'Dry Mango Powder', 'Sendha Namak'],
    nutritionalInfo: { calories: '125 kcal / 30g', protein: '6.8g', fat: '2.4g', carbs: '18.2g' },
    description: 'Sand-roasted black chickpeas loaded with natural plant protein, dietary fiber, and seasoned with digestive cumin and hing.',
    pairingSuggestion: 'Great for diabetics, gym-goers, and high-protein diet snackers.',
    customerFavTag: 'High Protein Hero'
  },
  {
    id: 'festive-royale-box',
    name: 'Bilokat Grand All-India Festive Gift Hamper',
    tagline: 'Luxury Wooden Box with 6 Handpicked Iconic Namkeens',
    price: 899,
    originalPrice: 1299,
    discountPercent: 30,
    weight: '1.8 kg Luxury Box',
    rating: 5.0,
    reviewCount: 880,
    image: '/images/bilokat-assorted-box.jpg',
    category: 'gifts',
    spiceLevel: 2,
    isBestseller: true,
    stockLeft: 5,
    regionOrigin: 'Royal Pan-India Collection',
    ingredients: ['Ratlami Sev', 'Shahi Kaju Blend', 'Khatta Meetha Mixture', 'Bikaneri Aloo Bhujia', 'Peri Peri Makhana', 'Nylon Sev'],
    nutritionalInfo: { calories: 'Varies by pack', protein: 'Assorted', fat: 'Zero Palm Oil', carbs: 'Assorted' },
    description: 'An extraordinary gift box featuring India’s top 6 regional namkeens in air-tight tin containers with custom gold foil greeting card.',
    pairingSuggestion: 'Ideal gift for Weddings, Diwali, Corporate Gifting & Family Gatherings.',
    customerFavTag: 'Top Rated Gift Item'
  }
];

export const REVIEWS: Review[] = [
  {
    id: 'rev-1',
    name: 'Vikramaditya S.',
    location: 'Indore, MP',
    rating: 5,
    title: 'Closest to authentic Indori/Ratlami Sev I have ever tasted outside Ratlam!',
    comment: 'Being an Indori, I am extremely fussy about my Ratlami Sev. Most national brands fail miserably. Bilokat’s clove flavor and crunch is absolute perfection! Ordering my 5th box now.',
    date: '2 days ago',
    verifiedBuyer: true,
    productBought: 'Bilokat Royal Ratlami Sev',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'rev-2',
    name: 'Priya Mukherjee',
    location: 'Kolkata, WB',
    rating: 5,
    title: 'Zero oiliness, zero heartburn! Finally a brand without cheap Palm Oil.',
    comment: 'I checked the ingredient label first—100% pure cold pressed peanut oil! You can taste the purity immediately. No bad aftertaste or oiliness on fingers. Super impressed.',
    date: '4 days ago',
    verifiedBuyer: true,
    productBought: 'Shahi Rajwadi Kaju Blend',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'rev-3',
    name: 'Rajesh & Kavita Sharma',
    location: 'New Delhi',
    rating: 5,
    title: 'Ordered 10 Festive Hampers for Diwali & Corporate Clients - Outstanding!',
    comment: 'The packaging looks like Apple level design for Indian Namkeen! Everyone in our office loved the Shahi Kaju mixture and Makhana. Received delivery in 24 hours in Delhi.',
    date: '1 week ago',
    verifiedBuyer: true,
    productBought: 'Grand All-India Festive Gift Hamper',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'rev-4',
    name: 'Ananya Reddy',
    location: 'Hyderabad, TS',
    rating: 5,
    title: 'The Zip-Lock pouch really keeps it ultra crisp for weeks!',
    comment: 'Even in humid weather, opening the bag after 3 weeks gave the same loud fresh CRUNCH. The Khatta Meetha mixture is my family’s daily tea-time ritual now.',
    date: '1 week ago',
    verifiedBuyer: true,
    productBought: 'Malwa Khatta Meetha Mixture',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
  }
];

export const FAQS: FAQItem[] = [
  {
    id: 'faq-1',
    question: 'Why is Bilokat Namkeen healthier than supermarket brands?',
    answer: 'Unlike commercial mass brands that cook in cheap, refined palm oil or hydrogenated fats, Bilokat uses 100% pure cold-pressed Peanut Oil and Olive Oil spray. Our snacks are 0% Trans-Fat, low cholesterol, and made in hygienic small artisanal batches.',
    category: 'Ingredients'
  },
  {
    id: 'faq-2',
    question: 'How long does Bilokat Namkeen stay fresh & crispy?',
    answer: 'Our state-of-the-art 3-Layer Nitrogen-Flushed Zip-Lock Pouches lock in 100% freshness for up to 9 months. Even after opening, simply seal the zip-lock tight to preserve that satisfying loud crunch!',
    category: 'Shelf Life'
  },
  {
    id: 'faq-3',
    question: 'Where do you deliver and what are the delivery charges?',
    answer: 'We deliver across 18,500+ pincodes all over India via express air couriers (BlueDart & Delhivery). Delivery is 100% FREE on all orders above ₹399. Orders below ₹399 incur a flat ₹40 shipping fee.',
    category: 'Delivery & Payment'
  },
  {
    id: 'faq-4',
    question: 'Is Cash on Delivery (COD) available?',
    answer: 'Yes! Cash on Delivery is available across 98% of Indian pincodes. You can also pay seamlessly via UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, or NetBanking.',
    category: 'Delivery & Payment'
  },
  {
    id: 'faq-5',
    question: 'Can I customize a Namkeen Gift Box or bulk corporate order?',
    answer: 'Absolutely! Use our interactive "Build Your Snack Box" feature on the website or click the "Corporate / WhatsApp Quick Order" button to connect directly with our gifting concierge team.',
    category: 'Offers'
  }
];

export const BUNDLES: Bundle[] = [
  {
    id: 'starter-trio',
    name: 'The Essential Chai-Nashta Trio',
    tagline: 'Ratlami Sev (400g) + Khatta Meetha (400g) + Aloo Bhujia (400g)',
    price: 499,
    originalPrice: 659,
    items: ['Royal Ratlami Sev 400g', 'Malwa Khatta Meetha 400g', 'Bikaneri Aloo Bhujia 400g'],
    image: '/images/bilokat-assorted-box.jpg',
    badge: 'Save ₹160',
    savingAmount: 160
  },
  {
    id: 'royal-feast',
    name: 'Bilokat Grand Feast 6-Pack',
    tagline: 'All Best Sellers + Free Handcrafted Clay Kulhad Set',
    price: 899,
    originalPrice: 1249,
    items: ['Ratlami Sev', 'Shahi Kaju Blend', 'Khatta Meetha', 'Aloo Bhujia', 'Peri Peri Makhana', 'Nylon Sev'],
    image: '/images/bilokat-hero-pack.jpg',
    badge: 'MOST POPULAR - Save 28%',
    savingAmount: 350,
    popular: true
  },
  {
    id: 'health-snacker',
    name: 'Guilt-Free High Protein Combo',
    tagline: '2x Peri Peri Makhana Jars + 2x Hing Jeera Roasted Chana',
    price: 649,
    originalPrice: 818,
    items: ['2x Peri Peri Makhana Jars', '2x Hing Jeera Roasted Chana'],
    image: 'https://images.pexels.com/photos/18301125/pexels-photo-18301125.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
    badge: 'Zero Guilt',
    savingAmount: 169
  }
];
