export interface GmapsPlace {
  placeId: string | null;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  googleTypes: string[];
  address: string | null;
  phone: string | null;
  website: string | null;
  businessHours: Record<string, string> | null;
  lastReviewAt: string | null;
  socialHandles: { instagram?: string; facebook?: string; tiktok?: string };
  sourceUrl: string;
}
