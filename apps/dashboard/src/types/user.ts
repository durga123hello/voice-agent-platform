export type UserRole = 
  | 'Administrator' 
  | 'Technical Manager' 
  | 'Inspector' 
  | 'Operator' 
  | 'Viewer';

export type UserStatus = 'Active' | 'Away' | 'Do Not Disturb';

export interface User {
  id: string;
  tenantId?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  officialEmail?: string;
  personalEmail?: string;
  employeeId?: string;
  role?: UserRole;
  status?: UserStatus;
  members?: string; // Grouping / organization membership
  joinedDate?: string; // E.g., 'Mon, 29 Jun 2026'
  dateOfJoining?: string;
  phone?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  nationality?: string;
  gender?: 'Male' | 'Female' | 'Other';
  avatarUrl?: string;
  signatureUrl?: string;
}

export interface UserFilters {
  search: string;
  role: string;
  status: string;
}
