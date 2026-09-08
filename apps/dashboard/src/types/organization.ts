export type OrganizationStatus = "Active" | "Inactive" | "Pending";

export interface Organization {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  country: string;
  createdAt: string;
  status: OrganizationStatus;
  adminName?: string;
  industry?: string;
  logoUrl?: string;
}

export interface OrganizationFilters {
  search: string;
  status: string;
  country: string;
}
