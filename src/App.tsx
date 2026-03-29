/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  auth, db 
} from './firebase';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  where,
  addDoc, 
  serverTimestamp,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  Bell, 
  CreditCard, 
  FileText, 
  Home, 
  LogOut, 
  Plus, 
  Settings, 
  Users, 
  User,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'resident';
  nik?: string;
  kk?: string;
  whatsapp?: string;
  birthPlace?: string;
  birthDate?: string;
  gender?: 'Laki-laki' | 'Perempuan';
  occupation?: string;
  maritalStatus?: 'Belum Kawin' | 'Kawin' | 'Cerai Hidup' | 'Cerai Mati';
  address?: string;
  phone?: string;
  houseNumber?: string;
  houseBlock?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: Timestamp;
}

interface Payment {
  id: string;
  userId: string;
  amount: number;
  month: string;
  year: number;
  status: 'pending' | 'paid';
  createdAt: Timestamp;
}

interface LetterRequest {
  id: string;
  userId: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  createdAt: Timestamp;
}

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<FirestoreErrorInfo | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      try {
        if (event.error?.message) {
          const parsed = JSON.parse(event.error.message);
          if (parsed.operationType && parsed.authInfo) {
            setHasError(true);
            setErrorInfo(parsed);
          }
        }
      } catch (e) {
        // Not a JSON error or not our specific error
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-red-100">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Akses Ditolak</h2>
          <p className="text-gray-600 mb-6">
            Anda tidak memiliki izin yang cukup untuk melakukan aksi ini atau terjadi kesalahan konfigurasi.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            Muat Ulang Aplikasi
          </button>
          {errorInfo && (
            <details className="mt-4 text-xs text-gray-400">
              <summary>Detail Teknis</summary>
              <pre className="mt-2 whitespace-pre-wrap bg-slate-50 p-2 rounded border border-slate-200 overflow-x-auto">
                {JSON.stringify(errorInfo, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
    <motion.div 
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mb-4"
    />
    <p className="text-slate-600 font-medium">Menghubungkan ke RT Digital...</p>
  </div>
);

const Login = () => {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-8 text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Home className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">RT Digital</h1>
          <p className="text-gray-500 mb-8">Sistem Informasi & Administrasi Warga Modern</p>
          
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-gray-100 rounded-2xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-blue-200 transition-all shadow-sm"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Masuk dengan Google
          </button>
          
          <p className="mt-8 text-xs text-gray-400">
            Dengan masuk, Anda menyetujui Ketentuan Layanan & Kebijakan Privasi kami.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const CompleteProfileModal = ({ profile, onComplete, isAdmin }: { profile?: UserProfile, onComplete: (data: Partial<UserProfile>) => void, isAdmin?: boolean }) => {
  const [name, setName] = useState(profile?.name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [nik, setNik] = useState(profile?.nik || '');
  const [kk, setKk] = useState(profile?.kk || '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || '');
  const [birthPlace, setBirthPlace] = useState(profile?.birthPlace || '');
  const [birthDate, setBirthDate] = useState(profile?.birthDate || '');
  const [gender, setGender] = useState<UserProfile['gender']>(profile?.gender || 'Laki-laki');
  const [occupation, setOccupation] = useState(profile?.occupation || '');
  const [maritalStatus, setMaritalStatus] = useState<UserProfile['maritalStatus']>(profile?.maritalStatus || 'Belum Kawin');
  const [address, setAddress] = useState(profile?.address || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [houseNumber, setHouseNumber] = useState(profile?.houseNumber || '');
  const [houseBlock, setHouseBlock] = useState(profile?.houseBlock || '');
  const [role, setRole] = useState<UserProfile['role']>(profile?.role || 'resident');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nik.length !== 16 || kk.length !== 16) {
      setError('NIK dan KK harus 16 digit');
      return;
    }
    if (whatsapp.length < 10) {
      setError('Nomor WhatsApp tidak valid');
      return;
    }
    onComplete({ 
      name, email, nik, kk, whatsapp, birthPlace, birthDate, 
      gender, occupation, maritalStatus, address, phone, houseNumber,
      houseBlock, role
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 my-8"
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Lengkapi Profil Warga</h2>
            <p className="text-slate-500 text-sm">Mohon lengkapi data kependudukan Anda untuk keperluan administrasi RT.</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {!profile && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Informasi Dasar</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nama Lengkap</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Nama Lengkap Warga"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="email@contoh.com"
                    required
                  />
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Identitas Utama</h3>
              {isAdmin && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Role User</label>
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    required
                  >
                    <option value="resident">Warga (Resident)</option>
                    <option value="admin">Pengurus (Admin)</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">NIK (16 Digit)</label>
                <input 
                  type="text" 
                  maxLength={16}
                  value={nik}
                  onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="3201..."
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nomor KK (16 Digit)</label>
                <input 
                  type="text" 
                  maxLength={16}
                  value={kk}
                  onChange={(e) => setKk(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="3201..."
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Jenis Kelamin</label>
                <select 
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  required
                >
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Pekerjaan</label>
                <input 
                  type="text" 
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Contoh: Karyawan Swasta"
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Kelahiran & Status</h3>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tempat Lahir</label>
                <input 
                  type="text" 
                  value={birthPlace}
                  onChange={(e) => setBirthPlace(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Contoh: Jakarta"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tanggal Lahir</label>
                <input 
                  type="date" 
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Status Perkawinan</label>
                <select 
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  required
                >
                  <option value="Belum Kawin">Belum Kawin</option>
                  <option value="Kawin">Kawin</option>
                  <option value="Cerai Hidup">Cerai Hidup</option>
                  <option value="Cerai Mati">Cerai Mati</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">WhatsApp</label>
                <input 
                  type="tel" 
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="0812..."
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Telepon Lain (Opsional)</label>
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="021..."
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Domisili</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Blok</label>
                <input 
                  type="text" 
                  value={houseBlock}
                  onChange={(e) => setHouseBlock(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Contoh: A"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">No. Rumah</label>
                <input 
                  type="text" 
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Contoh: 12"
                  required
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Alamat Lengkap</label>
                <textarea 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-20 resize-none"
                  placeholder="Jl. Merdeka No. 123..."
                  required
                />
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

          <div className="flex gap-4">
            <button 
              type="submit"
              className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              Simpan Data Warga
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const ProfileView = ({ profile, onUpdate }: { profile: UserProfile, onUpdate: (data: Partial<UserProfile>) => void }) => {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Edit Profil Saya</h2>
          <button 
            onClick={() => setIsEditing(false)}
            className="px-6 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-colors"
          >
            Batal
          </button>
        </div>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-8">
            <CompleteProfileModal 
              profile={profile} 
              isAdmin={profile.role === 'admin'}
              onComplete={(data) => {
                onUpdate(data);
                setIsEditing(false);
              }} 
            />
          </div>
        </div>
      </div>
    );
  }

  const InfoItem = ({ label, value }: { label: string, value?: string }) => (
    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
      <p className="text-xs font-bold text-slate-400 uppercase mb-1">{label}</p>
      <p className="text-slate-900 font-semibold">{value || '-'}</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-slate-900">Profil Saya</h2>
        <button 
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <Settings className="w-5 h-5" /> Edit Profil
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-12 text-white">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-4xl font-bold">
              {profile.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-3xl font-bold mb-1">{profile.name}</h3>
              <p className="text-blue-100 flex items-center gap-2">
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider">
                  {profile.role === 'admin' ? 'Ketua RT' : 'Warga'}
                </span>
                • {profile.email}
              </p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <InfoItem label="Blok" value={profile.houseBlock} />
            <InfoItem label="No. Rumah" value={profile.houseNumber} />
            <InfoItem label="NIK" value={profile.nik} />
            <InfoItem label="Nomor KK" value={profile.kk} />
            <InfoItem label="Tempat Lahir" value={profile.birthPlace} />
            <InfoItem label="Tanggal Lahir" value={profile.birthDate} />
            <InfoItem label="Jenis Kelamin" value={profile.gender} />
            <InfoItem label="Pekerjaan" value={profile.occupation} />
            <InfoItem label="Status Perkawinan" value={profile.maritalStatus} />
            <InfoItem label="WhatsApp" value={profile.whatsapp} />
          </div>
          
          <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
            <p className="text-xs font-bold text-blue-400 uppercase mb-1">Alamat Lengkap</p>
            <p className="text-blue-900 font-semibold">{profile.address || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ResidentDetailModal = ({ resident, onClose, onEdit, isAdmin }: { resident: UserProfile, onClose: () => void, onEdit?: () => void, isAdmin?: boolean }) => {
  const InfoItem = ({ label, value }: { label: string, value?: string }) => (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</p>
      <p className="text-slate-900 font-semibold text-sm">{value || '-'}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{resident.name}</h2>
            <p className="text-slate-500 text-sm">{resident.email}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem label="Blok" value={resident.houseBlock} />
            <InfoItem label="No. Rumah" value={resident.houseNumber} />
            <InfoItem label="NIK" value={resident.nik} />
            <InfoItem label="Nomor KK" value={resident.kk} />
            <InfoItem label="Tempat Lahir" value={resident.birthPlace} />
            <InfoItem label="Tanggal Lahir" value={resident.birthDate} />
            <InfoItem label="Jenis Kelamin" value={resident.gender} />
            <InfoItem label="Pekerjaan" value={resident.occupation} />
            <InfoItem label="Status Perkawinan" value={resident.maritalStatus} />
            <InfoItem label="WhatsApp" value={resident.whatsapp} />
            <InfoItem label="Nomor HP Lain" value={resident.phone} />
            <InfoItem label="Role" value={resident.role.toUpperCase()} />
          </div>
          
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Alamat Lengkap</p>
            <p className="text-blue-900 font-semibold text-sm">{resident.address || '-'}</p>
          </div>

          <div className="text-[10px] text-slate-400 text-right">
            Terdaftar pada: {resident.createdAt?.toDate().toLocaleString('id-ID')}
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          {isAdmin && onEdit && (
            <button 
              onClick={onEdit}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
            >
              Edit Data
            </button>
          )}
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
          >
            Tutup
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const CreateAnnouncementModal = ({ onClose, profile }: { onClose: () => void, profile: UserProfile }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await addDoc(collection(db, 'announcements'), {
        title,
        content,
        authorId: profile.uid,
        createdAt: serverTimestamp()
      });
      onClose();
    } catch (err) {
      setError('Gagal membuat pengumuman. Pastikan Anda memiliki akses admin.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900">Buat Pengumuman Baru</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Judul</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Masukkan judul pengumuman..."
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Isi Pengumuman</label>
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[200px]"
              placeholder="Tulis isi pengumuman di sini..."
              required
            />
          </div>

          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Publikasikan Pengumuman'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const CreatePaymentModal = ({ resident, onClose, onSuccess }: { resident: UserProfile, onClose: () => void, onSuccess: () => void }) => {
  const [amount, setAmount] = useState('20000');
  const [month, setMonth] = useState(new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date()));
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await addDoc(collection(db, 'payments'), {
        userId: resident.uid,
        amount: Number(amount),
        month,
        year: Number(year),
        status: 'pending',
        createdAt: serverTimestamp()
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError('Gagal membuat tagihan. Pastikan Anda memiliki akses admin.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900">Buat Tagihan Baru</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100">
          <p className="text-xs font-bold text-blue-400 uppercase mb-1">Warga</p>
          <p className="text-blue-900 font-bold">{resident.name}</p>
          <p className="text-blue-700 text-xs">{resident.address}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Jumlah Iuran (Rp)</label>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Bulan</label>
              <select 
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tahun</label>
              <input 
                type="number" 
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Buat Tagihan'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Data States
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [letterRequests, setLetterRequests] = useState<LetterRequest[]>([]);
  const [residents, setResidents] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResident, setSelectedResident] = useState<UserProfile | null>(null);
  const [isAddingResident, setIsAddingResident] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [selectedResidentForPayment, setSelectedResidentForPayment] = useState<UserProfile | null>(null);
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);
  const [editingResident, setEditingResident] = useState<UserProfile | null>(null);

  const exportResidentsToCSV = () => {
    const headers = ['No.', 'Nama', 'Blok', 'No. Rumah', 'NIK', 'KK', 'Email', 'WhatsApp', 'Gender', 'Pekerjaan', 'Status Perkawinan', 'Alamat', 'Tanggal Daftar'];
    
    // Use filtered residents to match what's on screen
    const filteredResidents = residents.filter(res => 
      res.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      res.nik?.includes(searchTerm) ||
      res.houseNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      res.houseBlock?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      res.address?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const rows = filteredResidents.map((res, index) => [
      (index + 1).toString(),
      res.name,
      res.houseBlock || '',
      res.houseNumber || '',
      res.nik || '',
      res.kk || '',
      res.email,
      res.whatsapp || res.phone || '',
      res.gender || '',
      res.occupation || '',
      res.maritalStatus || '',
      res.address || '',
      res.createdAt?.toDate().toLocaleDateString('id-ID') || '-'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map((cell, index) => {
        const escaped = String(cell).replace(/"/g, '""');
        // Force NIK (index 4), KK (index 5), and WhatsApp (index 7) to be strings in Excel
        // Using the ="value" format for cleaner Excel integration and to prevent scientific notation
        if ((index === 4 || index === 5 || index === 7) && escaped.length > 0) {
          return `="${escaped}"`;
        }
        return `"${escaped}"`;
      }).join(','))
    ].join('\r\n');
    
    // Add BOM (\ufeff) so Excel recognizes UTF-8 encoding
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `data_warga_rt_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Test connection
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (e) {
          // Ignore connection test errors as per guidelines
        }

        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            // Create new profile
            const isAdmin = u.email === 'handikacibinong@gmail.com';
            const newProfile: UserProfile = {
              uid: u.uid,
              name: u.displayName || 'Warga Baru',
              email: u.email || '',
              role: isAdmin ? 'admin' : 'resident',
              createdAt: Timestamp.now()
            };
            await setDoc(doc(db, 'users', u.uid), newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Real-time Listeners
  useEffect(() => {
    if (!profile) return;

    const qAnnouncements = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'announcements');
    });

    const qPayments = profile.role === 'admin' 
      ? query(collection(db, 'payments'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'payments'), where('userId', '==', profile.uid), orderBy('createdAt', 'desc'));
    
    const unsubPayments = onSnapshot(qPayments, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'payments');
    });

    const qLetters = profile.role === 'admin'
      ? query(collection(db, 'letterRequests'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'letterRequests'), where('userId', '==', profile.uid), orderBy('createdAt', 'desc'));

    const unsubLetters = onSnapshot(qLetters, (snapshot) => {
      setLetterRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LetterRequest)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'letterRequests');
    });

    if (profile.role === 'admin') {
      const unsubResidents = onSnapshot(collection(db, 'users'), (snapshot) => {
        setResidents(snapshot.docs.map(doc => doc.data() as UserProfile));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
      return () => {
        unsubAnnouncements();
        unsubPayments();
        unsubLetters();
        unsubResidents();
      };
    }

    return () => {
      unsubAnnouncements();
      unsubPayments();
      unsubLetters();
    };
  }, [profile]);

  if (loading) return <LoadingScreen />;
  if (!user || !profile) return <Login />;

  const handleLogout = () => signOut(auth);

  const NavItem = ({ id, icon: Icon, label }: { id: string, icon: any, label: string }) => (
    <button 
      onClick={() => { setActiveTab(id); setIsSidebarOpen(false); }}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
        activeTab === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-semibold">{label}</span>
      {activeTab === id && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />}
    </button>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar Desktop */}
        <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-slate-200 p-6 fixed h-full">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Home className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">RT Digital</h1>
          </div>

          <nav className="flex-1 space-y-2">
            <NavItem id="home" icon={Home} label="Beranda" />
            {profile.role === 'resident' && <NavItem id="profile" icon={User} label="Profil Saya" />}
            <NavItem id="announcements" icon={Bell} label="Pengumuman" />
            <NavItem id="payments" icon={CreditCard} label="Iuran Warga" />
            <NavItem id="letters" icon={FileText} label="Surat Pengantar" />
            {profile.role === 'admin' && <NavItem id="residents" icon={Users} label="Data Warga" />}
          </nav>

          <div className="mt-auto pt-6 border-t border-slate-100">
            <div className="flex items-center gap-3 mb-6 px-2">
              <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt="Avatar" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{profile.name}</p>
                <p className="text-xs text-slate-500 capitalize">{profile.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-semibold"
            >
              <LogOut className="w-5 h-5" />
              Keluar
            </button>
          </div>
        </aside>

        {/* Mobile Header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">RT Digital</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleLogout}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Keluar"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Complete Profile Modal for Residents */}
        {profile.role === 'resident' && (!profile.nik || !profile.kk || !profile.whatsapp || !profile.birthDate) && (
          <CompleteProfileModal 
            profile={profile} 
            isAdmin={profile.role === 'admin'}
            onComplete={async (data) => {
              const updatedProfile = { ...profile, ...data };
              try {
                await setDoc(doc(db, 'users', profile.uid), updatedProfile);
                setProfile(updatedProfile);
              } catch (error) {
                handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
              }
            }} 
          />
        )}

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] lg:hidden"
              />
              <motion.aside 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                className="fixed top-0 left-0 bottom-0 w-80 bg-white z-[70] p-6 flex flex-col lg:hidden"
              >
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                      <Home className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900">RT Digital</h1>
                  </div>
                  <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <nav className="flex-1 space-y-2">
                  <NavItem id="home" icon={Home} label="Beranda" />
                  {profile.role === 'resident' && <NavItem id="profile" icon={User} label="Profil Saya" />}
                  <NavItem id="announcements" icon={Bell} label="Pengumuman" />
                  <NavItem id="payments" icon={CreditCard} label="Iuran Warga" />
                  <NavItem id="letters" icon={FileText} label="Surat Pengantar" />
                  {profile.role === 'admin' && <NavItem id="residents" icon={Users} label="Data Warga" />}
                </nav>
                <div className="mt-auto pt-6 border-t border-slate-100">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-semibold"
                  >
                    <LogOut className="w-5 h-5" />
                    Keluar
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 lg:ml-72 pt-20 lg:pt-8 p-4 lg:p-10 max-w-6xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Halo, {profile.name}! 👋</h2>
                    <p className="text-slate-500">Selamat datang di portal RT Digital Anda.</p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all shadow-sm self-start md:self-center"
                  >
                    <LogOut className="w-5 h-5" />
                    Keluar Aplikasi
                  </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
                      <Bell className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Pengumuman Terbaru</p>
                    <p className="text-2xl font-bold text-slate-900">{announcements.length}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 text-emerald-600">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Status Iuran</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {payments.some(p => p.status === 'pending') ? 'Ada Tagihan' : 'Lunas'}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-4 text-amber-600">
                      <FileText className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Permohonan Surat</p>
                    <p className="text-2xl font-bold text-slate-900">{letterRequests.length}</p>
                  </div>
                </div>

                {profile.role === 'resident' && (
                  <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                      <div className="relative">
                        <img src={user.photoURL || ''} className="w-24 h-24 rounded-2xl border-4 border-white shadow-lg" alt="Avatar" />
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 border-4 border-white rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        </div>
                      </div>
                      <div className="flex-1 text-center md:text-left">
                        <h3 className="text-2xl font-bold text-slate-900 mb-1">{profile.name}</h3>
                        <p className="text-slate-500 text-sm mb-4">NIK: {profile.nik || 'Belum diisi'} • {profile.address || 'Alamat belum diisi'}</p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-3">
                          <button 
                            onClick={() => setActiveTab('profile')}
                            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                          >
                            Lihat Profil Lengkap
                          </button>
                          <button 
                            onClick={() => setIsEditingProfile(true)}
                            className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                          >
                            Edit Data
                          </button>
                        </div>
                      </div>
                    </div>
                    <User className="absolute -right-12 -bottom-12 w-48 h-48 text-slate-50 opacity-5" />
                  </section>
                )}

                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-900">Pengumuman Terkini</h3>
                    <button onClick={() => setActiveTab('announcements')} className="text-blue-600 font-semibold text-sm flex items-center gap-1">
                      Lihat Semua <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    {announcements.map(ann => (
                      <div key={ann.id} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-200 transition-colors shadow-sm">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-bold text-slate-900">{ann.title}</h4>
                          {profile.role === 'admin' && (
                            <button 
                              onClick={() => {
                                const message = encodeURIComponent(`*PENGUMUMAN RT*\n\n*${ann.title}*\n\n${ann.content}`);
                                const waLink = `https://wa.me/?text=${message}`;
                                window.open(waLink, '_blank');
                              }}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Siarkan ke WhatsApp"
                            >
                              <Plus className="w-4 h-4 rotate-45" />
                            </button>
                          )}
                        </div>
                        <p className="text-slate-600 text-sm line-clamp-2 mb-4">{ann.content}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          {ann.createdAt?.toDate().toLocaleDateString('id-ID')}
                        </div>
                      </div>
                    ))}
                    {announcements.length === 0 && (
                      <div className="text-center py-12 bg-slate-100 rounded-2xl border border-dashed border-slate-300">
                        <p className="text-slate-400">Belum ada pengumuman.</p>
                      </div>
                    )}
                  </div>
                </section>
              </motion.div>
            )}

            {activeTab === 'profile' && profile.role === 'resident' && (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Profil Saya</h2>
                    <p className="text-slate-500 text-sm">Kelola informasi kependudukan Anda untuk keperluan administrasi RT.</p>
                  </div>
                  <div className="flex flex-wrap gap-3 self-start md:self-center">
                    <button 
                      onClick={() => setIsEditingProfile(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                    >
                      <User className="w-5 h-5" />
                      Edit Profil
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all shadow-sm"
                    >
                      <LogOut className="w-5 h-5" />
                      Keluar
                    </button>
                  </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
                      <div className="relative inline-block mb-4">
                        <img src={user.photoURL || ''} className="w-32 h-32 rounded-full border-4 border-white shadow-xl mx-auto" alt="Avatar" />
                        <div className="absolute bottom-1 right-1 w-8 h-8 bg-emerald-500 border-4 border-white rounded-full" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">{profile.name}</h3>
                      <p className="text-slate-500 text-sm mb-4">{profile.email}</p>
                      <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider">
                        Warga RT Digital
                      </span>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Kontak Cepat</h4>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                            <Plus className="w-5 h-5 rotate-45" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">WhatsApp</p>
                            <p className="text-sm font-bold text-slate-900">{profile.whatsapp || '-'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">Telepon</p>
                            <p className="text-sm font-bold text-slate-900">{profile.phone || '-'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                      <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Data Kependudukan
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase mb-1">NIK (Nomor Induk Kependudukan)</p>
                          <p className="text-slate-900 font-mono font-bold">{profile.nik || 'Belum diisi'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase mb-1">Nomor Kartu Keluarga (KK)</p>
                          <p className="text-slate-900 font-mono font-bold">{profile.kk || 'Belum diisi'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase mb-1">Tempat, Tanggal Lahir</p>
                          <p className="text-slate-900 font-bold">
                            {profile.birthPlace || '-'}, {profile.birthDate || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase mb-1">Jenis Kelamin</p>
                          <p className="text-slate-900 font-bold">{profile.gender || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase mb-1">Pekerjaan</p>
                          <p className="text-slate-900 font-bold">{profile.occupation || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-bold uppercase mb-1">Status Perkawinan</p>
                          <p className="text-slate-900 font-bold">{profile.maritalStatus || '-'}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-xs text-slate-400 font-bold uppercase mb-1">Alamat Lengkap</p>
                          <p className="text-slate-900 font-bold">{profile.address || 'Belum diisi'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl shadow-blue-200 relative overflow-hidden">
                      <div className="relative z-10">
                        <h4 className="text-xl font-bold mb-2">Butuh Bantuan Administrasi?</h4>
                        <p className="text-blue-100 text-sm mb-6 max-w-md">
                          Anda dapat mengajukan surat pengantar atau menanyakan status iuran langsung melalui portal ini.
                        </p>
                        <div className="flex gap-3">
                          <button onClick={() => setActiveTab('letters')} className="px-6 py-2 bg-white text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors">
                            Ajukan Surat
                          </button>
                          <button onClick={() => setActiveTab('payments')} className="px-6 py-2 bg-blue-500 text-white rounded-xl font-bold text-sm hover:bg-blue-400 transition-colors">
                            Cek Iuran
                          </button>
                        </div>
                      </div>
                      <FileText className="absolute -right-8 -bottom-8 w-48 h-48 text-blue-500 opacity-20" />
                    </div>
                  </div>
                </div>

                {isEditingProfile && (
                  <CompleteProfileModal 
                    profile={profile} 
                    isAdmin={profile.role === 'admin'}
                    onComplete={async (data) => {
                      try {
                        await setDoc(doc(db, 'users', profile.uid), {
                          ...profile,
                          ...data,
                          updatedAt: serverTimestamp()
                        });
                        setProfile({ ...profile, ...data } as UserProfile);
                        setIsEditingProfile(false);
                      } catch (error) {
                        handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
                      }
                    }} 
                  />
                )}
              </motion.div>
            )}

            {activeTab === 'announcements' && (
              <motion.div 
                key="announcements"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-slate-900">Pengumuman</h2>
                  {profile.role === 'admin' && (
                    <button 
                      onClick={() => setIsCreatingAnnouncement(true)}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-md shadow-blue-100"
                    >
                      <Plus className="w-4 h-4" /> Buat Baru
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {announcements.map(ann => (
                    <div key={ann.id} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-xl font-bold text-slate-900">{ann.title}</h3>
                        {profile.role === 'admin' && (
                          <button 
                            onClick={() => {
                              const message = encodeURIComponent(`*PENGUMUMAN RT*\n\n*${ann.title}*\n\n${ann.content}`);
                              const waLink = `https://wa.me/?text=${message}`;
                              window.open(waLink, '_blank');
                            }}
                            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-100"
                          >
                            <Plus className="w-4 h-4 rotate-45" /> Siarkan ke WA
                          </button>
                        )}
                      </div>
                      <p className="text-slate-600 leading-relaxed mb-6 whitespace-pre-wrap">{ann.content}</p>
                      <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <Clock className="w-4 h-4" />
                          {ann.createdAt?.toDate().toLocaleString('id-ID')}
                        </div>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">RT Info</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'payments' && (
              <motion.div 
                key="payments"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-slate-900">Iuran Warga</h2>
                  {profile.role === 'admin' && (
                    <button 
                      onClick={() => setActiveTab('residents')}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold shadow-md"
                    >
                      <Plus className="w-4 h-4" /> Tagihan Baru
                    </button>
                  )}
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Bulan</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Jumlah</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.map(pay => (
                          <tr key={pay.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-900">{pay.month} {pay.year}</p>
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              Rp {pay.amount.toLocaleString('id-ID')}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                                pay.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                              }`}>
                                {pay.status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                {pay.status === 'paid' ? 'Lunas' : 'Belum Bayar'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {pay.status === 'pending' && profile.role === 'resident' && (
                                <button className="text-blue-600 font-bold text-sm hover:underline">Bayar Sekarang</button>
                              )}
                              {profile.role === 'admin' && pay.status === 'pending' && (
                                <button 
                                  onClick={async () => {
                                    // In a real app, update status to paid
                                    alert("Fitur konfirmasi pembayaran admin");
                                  }}
                                  className="text-emerald-600 font-bold text-sm hover:underline"
                                >
                                  Konfirmasi
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {payments.length === 0 && (
                    <div className="p-12 text-center text-slate-400">Belum ada data iuran.</div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'letters' && (
              <motion.div 
                key="letters"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-slate-900">Surat Pengantar</h2>
                  {profile.role === 'resident' && (
                    <button 
                      onClick={async () => {
                        const type = prompt("Jenis Surat (Domisili/Kematian/Nikah):");
                        if (type) {
                          try {
                            await addDoc(collection(db, 'letterRequests'), {
                              userId: profile.uid,
                              type,
                              status: 'pending',
                              createdAt: serverTimestamp()
                            });
                          } catch (error) {
                            handleFirestoreError(error, OperationType.CREATE, 'letterRequests');
                          }
                        }
                      }}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold shadow-md"
                    >
                      <Plus className="w-4 h-4" /> Ajukan Surat
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {letterRequests.map(req => (
                    <div key={req.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <h4 className="font-bold text-slate-900">{req.type}</h4>
                        </div>
                        <p className="text-xs text-slate-400 mb-4">Diajukan: {req.createdAt?.toDate().toLocaleDateString('id-ID')}</p>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 
                          req.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {req.status.toUpperCase()}
                        </span>
                      </div>
                      {profile.role === 'admin' && req.status === 'pending' && (
                        <div className="flex flex-col gap-2">
                          <button className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg">Setujui</button>
                          <button className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg">Tolak</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {letterRequests.length === 0 && (
                  <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
                    <p className="text-slate-400">Belum ada pengajuan surat.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'residents' && profile.role === 'admin' && (
              <motion.div 
                key="residents"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-slate-900">Data Warga</h2>
                    <div className="flex gap-2">
                      <button 
                        onClick={exportResidentsToCSV}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                      >
                        <FileText className="w-4 h-4" /> Export CSV
                      </button>
                      <button 
                        onClick={() => setIsAddingResident(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Tambah Warga
                      </button>
                    </div>
                  </div>
                  <div className="relative flex-1 max-w-md">
                    <input 
                      type="text"
                      placeholder="Cari nama, NIK, atau alamat..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <Users className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Nama</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">No. Rumah</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">NIK / KK</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Kontak</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {residents
                          .filter(res => 
                            res.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            res.nik?.includes(searchTerm) ||
                            res.houseNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            res.address?.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .map(res => (
                          <tr key={res.uid} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-900">{res.name}</p>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${res.role === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                {res.role}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                                {res.houseBlock ? `${res.houseBlock}-${res.houseNumber}` : (res.houseNumber || '-')}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs text-slate-600 font-mono">NIK: {res.nik || '-'}</p>
                              <p className="text-xs text-slate-400 font-mono">KK: {res.kk || '-'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs text-slate-600">{res.email}</p>
                              {res.whatsapp && (
                                <button 
                                  onClick={() => window.open(`https://wa.me/${res.whatsapp.replace(/^0/, '62')}`, '_blank')}
                                  className="flex items-center gap-1 text-emerald-600 text-xs font-bold mt-1 hover:underline"
                                >
                                  <Plus className="w-3 h-3 rotate-45" /> {res.whatsapp}
                                </button>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${res.maritalStatus ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-600'}`}>
                                {res.maritalStatus || 'Profil Belum Lengkap'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={() => setSelectedResidentForPayment(res)}
                                  className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-bold hover:bg-blue-700 transition-all shadow-sm"
                                >
                                  Tagih
                                </button>
                                <button 
                                  onClick={() => setEditingResident(res)}
                                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold hover:bg-slate-200 transition-all"
                                >
                                  Edit
                                </button>
                                <button 
                                  onClick={() => setSelectedResident(res)}
                                  className="text-blue-600 font-bold text-xs hover:underline"
                                >
                                  Detail
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {residents.length === 0 && (
                    <div className="p-12 text-center text-slate-400">Belum ada data warga.</div>
                  )}
                </div>

                {selectedResident && (
                  <ResidentDetailModal 
                    resident={selectedResident} 
                    onClose={() => setSelectedResident(null)} 
                    isAdmin={profile?.role === 'admin'}
                    onEdit={() => {
                      setEditingResident(selectedResident);
                      setSelectedResident(null);
                    }}
                  />
                )}

                {editingResident && (
                  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-900">Edit Data Warga</h2>
                        <button onClick={() => setEditingResident(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                          <X className="w-5 h-5 text-slate-400" />
                        </button>
                      </div>
                      <div className="p-6 overflow-y-auto">
                        <CompleteProfileModal 
                          profile={editingResident}
                          isAdmin={profile?.role === 'admin'}
                          onComplete={async (data) => {
                            try {
                              // Sanitize data to only include allowed fields from the document
                              const { uid, email, createdAt } = editingResident;
                              const updatedData = {
                                uid,
                                email,
                                createdAt,
                                ...data,
                                updatedAt: serverTimestamp()
                              };
                              
                              await setDoc(doc(db, 'users', uid), updatedData);
                              setEditingResident(null);
                            } catch (error) {
                              handleFirestoreError(error, OperationType.WRITE, `users/${editingResident.uid}`);
                            }
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                )}

                {isAddingResident && (
                  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-900">Tambah Data Warga Manual</h2>
                        <button onClick={() => setIsAddingResident(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                          <X className="w-5 h-5 text-slate-400" />
                        </button>
                      </div>
                      <div className="p-6 overflow-y-auto">
                        <CompleteProfileModal 
                          isAdmin={profile?.role === 'admin'}
                          onComplete={async (data) => {
                            const newUid = `manual_${Date.now()}`;
                            try {
                              await setDoc(doc(db, 'users', newUid), {
                                ...data,
                                uid: newUid,
                                role: data.role || 'resident',
                                createdAt: serverTimestamp(),
                                updatedAt: serverTimestamp()
                              });
                              setIsAddingResident(false);
                            } catch (error) {
                              handleFirestoreError(error, OperationType.WRITE, `users/${newUid}`);
                            }
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        {selectedResidentForPayment && (
          <CreatePaymentModal 
            resident={selectedResidentForPayment}
            onClose={() => setSelectedResidentForPayment(null)}
            onSuccess={() => {
              setActiveTab('payments');
            }}
          />
        )}
        {isCreatingAnnouncement && profile && (
          <CreateAnnouncementModal 
            profile={profile}
            onClose={() => setIsCreatingAnnouncement(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
