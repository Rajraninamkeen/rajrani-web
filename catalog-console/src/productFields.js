// Catalog field metadata shared by the seller authoring form (Session 20 backend).
export const SPICE = ['MILD', 'MEDIUM', 'SPICY', 'FIERY'];
export const STOCK = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'];

export const EMPTY_PRODUCT = {
  name: '',
  slug: '',
  categoryId: '',
  brand: '',
  regionOrigin: '',
  tagline: '',
  description: '',
  basePrice: '',
  originalPrice: '',
  weightLabel: '',
  spiceLevel: 'MILD',
  ingredients: [],
  pairingSuggestion: '',
  isBestseller: false,
  isNew: false,
  stockOnHand: 0,
  stockStatus: 'IN_STOCK',
  media: [],
};
