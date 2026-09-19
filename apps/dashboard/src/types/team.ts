export type ProjectAssigned = "vopx website" | "voice orchestration platform" | "Both";

export interface TeamMember {
  id: string;
  tenantId?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  employeeId?: string;
  officialEmail?: string;
  email?: string;
  personalEmail?: string;
  phone?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  dateOfJoining?: string;
  nationality?: string;
  gender?: "Male" | "Female" | "Other" | string;
  role: string;
  status: string;
  projectAssigned: ProjectAssigned;
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamFilters {
  search: string;
  project: string;
  status: string;
}
