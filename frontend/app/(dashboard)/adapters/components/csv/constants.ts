export type ColumnMapping = {
  name: string; email: string; company: string; role: string;
  industry: string; location: string; phone: string; website: string; bio: string;
};

export const LEAD_FIELDS: (keyof ColumnMapping)[] = [
  'name', 'email', 'company', 'role', 'industry', 'location', 'phone', 'website', 'bio',
];

export const FIELD_ALIASES: Record<keyof ColumnMapping, string[]> = {
  name:     ['name', 'full_name', 'contact_name'],
  email:    ['email', 'email_address'],
  company:  ['company', 'organization', 'employer'],
  role:     ['role', 'title', 'job_title', 'position'],
  industry: ['industry', 'sector'],
  location: ['location', 'city', 'region'],
  phone:    ['phone', 'telephone', 'mobile'],
  website:  ['website', 'linkedin', 'url'],
  bio:      ['bio', 'about', 'summary'],
};

export const MOCK_IMPORT_HISTORY = [
  { id: '1', filename: 'leads_q1_2026.csv',    importedAt: new Date(Date.now() - 86_400_000).toISOString(),      rowCount: 341, status: 'success' as const, skipped: 12 },
  { id: '2', filename: 'prospects_march.xlsx', importedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), rowCount: 89,  status: 'partial' as const, skipped: 4  },
  { id: '3', filename: 'contacts_export.csv',  importedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(), rowCount: 512, status: 'success' as const, skipped: 0  },
];
