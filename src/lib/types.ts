export type UserRole = 'admin' | 'clinic_admin' | 'doctor' | 'assistant' | 'receptionist';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  dynamic_role_id?: string;
  clinic_id: string | null;
  avatar_url: string;
  is_active: boolean;
  created_at: string;
}

export interface Clinic {
  id: string;
  clinic_name: string;
  address: string;
  phone: string;
  email: string;
  created_at: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  contact: string;
  email: string;
  address: string;
  medical_history: string;
  dental_history: string;
  notes: string;
  doctor_id: string | null;
  clinic_id: string | null;
  created_at: string;
  doctor?: UserProfile;
  clinic?: Clinic;
}

export interface PatientFile {
  id: string;
  patient_id: string;
  file_url: string;
  file_type: string;
  file_name: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  clinic_id: string | null;
  created_by?: string | null;
  appointment_date: string;
  appointment_time: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  notes: string;
  created_at: string;
  patient?: Patient;
  doctor?: UserProfile;
  clinic?: Clinic;
  creator?: UserProfile;
}

export interface DentalService {
  id: string;
  service_name: string;
  category: string;
  default_price: number;
  description: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type MedicineType = string;

export interface Medicine {
  id: string;
  medicine_name: string;
  medicine_type: MedicineType;
  strength: string;
  form: string;
  default_dosage: string;
  clinic_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PrescriptionMedicine {
  medicine_name: string;
  medicine_type: string;
  strength: string;
  dose_quantity: string;
  frequency: string;
  duration: string;
  special_instructions: string;
}

export interface Prescription {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  created_by?: string | null;
  treatments: string;
  medicines: PrescriptionMedicine[];
  notes: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  patient?: Patient;
  doctor?: UserProfile;
  creator?: UserProfile;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ClinicServicePrice {
  id: string;
  clinic_id: string;
  service_id: string;
  price: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  patient_id: string;
  clinic_id: string | null;
  doctor_id: string | null;
  created_by?: string | null;
  items: InvoiceItem[];
  doctor_fee: number;
  discount_type?: 'amount' | 'percentage' | null;
  discount_value?: number;
  discount_amount?: number;
  total_amount: number;
  amount_paid: number;
  status: 'unpaid' | 'paid' | 'partial' | 'cancelled';
  created_at: string;
  patient?: Patient;
  doctor?: UserProfile;
  clinic?: Clinic;
  creator?: UserProfile;
}
