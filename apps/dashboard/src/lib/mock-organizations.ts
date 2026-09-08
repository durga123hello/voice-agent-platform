import { Organization } from '../types/organization';

export const INITIAL_MOCK_ORGANIZATIONS: Organization[] = [
  {
    id: 'org-1',
    name: 'SwarmX AI Systems',
    code: 'ORG-SWMX',
    email: 'contact@swarmx.ai',
    phone: '+974 4488 9900',
    country: 'Qatar',
    createdAt: 'Mon, Jan 15, 2024',
    status: 'Active',
    adminName: 'Sarah Al-Mansoor',
    industry: 'Voice Artificial Intelligence'
  },
  {
    id: 'org-2',
    name: 'Apex Global Telephony',
    code: 'ORG-APEX',
    email: 'admin@apextelecom.com',
    phone: '+1 415 555 0192',
    country: 'United States',
    createdAt: 'Thu, Mar 07, 2024',
    status: 'Active',
    adminName: 'Michael Vance',
    industry: 'Telecommunications & VoIP'
  },
  {
    id: 'org-3',
    name: 'Nordic Cloud Tech',
    code: 'ORG-NRDC',
    email: 'ops@nordiccloud.se',
    phone: '+46 8 123 4567',
    country: 'Sweden',
    createdAt: 'Tue, Apr 23, 2024',
    status: 'Active',
    adminName: 'Henrik Larsson',
    industry: 'Cloud Infrastructure'
  },
  {
    id: 'org-4',
    name: 'Zenith Financial Corp',
    code: 'ORG-ZNTH',
    email: 'security@zenithfin.co.uk',
    phone: '+44 20 7946 0912',
    country: 'United Kingdom',
    createdAt: 'Fri, Jun 14, 2024',
    status: 'Pending',
    adminName: 'Elena Rostova',
    industry: 'Fintech & Banking'
  },
  {
    id: 'org-5',
    name: 'Sahara Logistics Hub',
    code: 'ORG-SHRA',
    email: 'info@saharalog.ae',
    phone: '+971 4 321 8899',
    country: 'United Arab Emirates',
    createdAt: 'Wed, Aug 02, 2024',
    status: 'Inactive',
    adminName: 'Rashid Al-Falasi',
    industry: 'Supply Chain & Logistics'
  }
];
