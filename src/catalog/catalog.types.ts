// Public catalog response shapes (aligned with the landing-page Product model so
// the frontend can drop-in replace its hardcoded data with these API responses).

export type SpiceLevelNumber = 1 | 2 | 3 | 4;

export interface PublicProduct {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  price: number; // selling price (basePrice)
  originalPrice: number | null;
  discountPercent: number; // computed
  weight: string | null; // weightLabel
  rating: number; // ratingAvg
  reviewCount: number;
  image: string | null; // primary media url
  category: string; // category slug
  spiceLevel: SpiceLevelNumber | null;
  isNew: boolean;
  isBestseller: boolean;
  stockLeft: number;
  inStock: boolean;
  regionOrigin: string | null;
  ingredients: string[];
  nutritionalInfo: Record<string, string> | null;
  pairingSuggestion: string | null;
  customerFavTag: string | null;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface ProductListResult {
  products: PublicProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
