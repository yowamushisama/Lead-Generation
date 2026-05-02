export type ColId =
  | 'role' | 'source' | 'intent' | 'location' | 'industry'
  | 'email' | 'phone' | 'website'
  | 'rating' | 'reviews' | 'businessType' | 'enrichmentStatus' | 'socialHandles'
  | 'created';

export interface ColDef {
  id: ColId;
  label: string;
  width: number;
  defaultOn: boolean;
}

export const OPTIONAL_COLS: ColDef[] = [
  { id: 'role',             label: 'Role',          width: 130, defaultOn: true  },
  { id: 'source',           label: 'Source',        width: 90,  defaultOn: true  },
  { id: 'intent',           label: 'Intent',        width: 100, defaultOn: true  },
  { id: 'created',          label: 'Created',       width: 90,  defaultOn: true  },
  { id: 'rating',           label: 'Rating',        width: 90,  defaultOn: true  },
  { id: 'reviews',          label: 'Reviews',       width: 80,  defaultOn: true  },
  { id: 'businessType',     label: 'Business Type', width: 120, defaultOn: true  },
  { id: 'location',         label: 'Location',      width: 120, defaultOn: false },
  { id: 'industry',         label: 'Industry',      width: 110, defaultOn: false },
  { id: 'email',            label: 'Email',         width: 140, defaultOn: false },
  { id: 'phone',            label: 'Phone',         width: 110, defaultOn: false },
  { id: 'website',          label: 'Website',       width: 130, defaultOn: false },
  { id: 'enrichmentStatus', label: 'Web Status',    width: 90,  defaultOn: false },
  { id: 'socialHandles',    label: 'Socials',       width: 90,  defaultOn: false },
];

export const DEFAULT_VISIBILITY: Record<ColId, boolean> = Object.fromEntries(
  OPTIONAL_COLS.map((c) => [c.id, c.defaultOn]),
) as Record<ColId, boolean>;

export const LEADS_COL_VISIBILITY_KEY = 'leads-column-visibility';
