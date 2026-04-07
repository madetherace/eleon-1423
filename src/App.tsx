import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { 
  getDocument, 
  getDocuments, 
  setDocument, 
  updateDocument, 
  subscribeToCollection, 
  subscribeToDocument 
} from './lib/firestoreUtils';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Hotel as HotelIcon, 
  Key, 
  Lightbulb, 
  LogOut, 
  User as UserIcon, 
  Calendar, 
  Settings, 
  Plus, 
  CheckCircle, 
  XCircle, 
  MapPin, 
  DoorOpen, 
  DoorClosed,
  ChevronRight,
  Loader2,
  Thermometer,
  Cloud,
  Wind,
  Bluetooth,
  Wifi,
  Cpu,
  RefreshCw,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { format } from 'date-fns';

// --- Types ---
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'guest' | 'admin';
  createdAt: string;
}

interface Hotel {
  id: string;
  name: string;
  location: string;
  description: string;
  imageUrl: string;
}

interface Room {
  id: string;
  hotelId: string;
  roomNumber: string;
  type: string;
  price: number;
  status: 'available' | 'occupied' | 'maintenance';
  lightOn: boolean;
  doorLocked: boolean;
}

interface Booking {
  id: string;
  userId: string;
  hotelId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  status: 'confirmed' | 'checked-in' | 'completed' | 'cancelled';
  createdAt: string;
}

// --- Auth Context ---
interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        let userProfile = await getDocument<UserProfile>('users', firebaseUser.uid);
        if (!userProfile) {
          // Create default profile
          const isAdmin = firebaseUser.email === 'glebsosnovskiy@gmail.com';
          userProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            role: isAdmin ? 'admin' : 'guest',
            createdAt: new Date().toISOString(),
          };
          await setDocument('users', firebaseUser.uid, userProfile);
        }
        setProfile(userProfile);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Room Controller Component ---
const RoomController = ({ hotelId, roomId }: { hotelId: string, roomId: string }) => {
  const [info, setInfo] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bleStatus, setBleStatus] = useState<'idle' | 'scanning' | 'connected' | 'error'>('idle');

  const fetchInfo = async () => {
    try {
      const res = await fetch('/api/controller/info');
      const data = await res.json();
      setInfo(data);
    } catch (e) {
      setError('Ошибка получения информации');
    }
  };

  const fetchState = async () => {
    try {
      const res = await fetch('/api/controller/state');
      const data = await res.json();
      setState(data);
      setError(null);
    } catch (e) {
      setError('Ошибка связи с контроллером');
    } finally {
      setLoading(false);
    }
  };

  const sendCommand = async (command: number) => {
    try {
      const res = await fetch('/api/controller/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Команда выполнена');
        fetchState();
      } else {
        toast.error('Ошибка: ' + (data.error_message || 'Неизвестная ошибка'));
      }
    } catch (e) {
      toast.error('Ошибка отправки команды');
    }
  };

  useEffect(() => {
    fetchInfo();
    fetchState();
    const interval = setInterval(fetchState, 7000);
    return () => clearInterval(interval);
  }, []);

  const handleBleConnect = async () => {
    if (!info?.ble_name) return;
    setBleStatus('scanning');
    try {
      // @ts-ignore - Web Bluetooth API
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: info.ble_name }],
        optionalServices: [0x00FF]
      });
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(0x00FF);
      const characteristic = await service.getCharacteristic(0xFF02);
      
      // Send token
      const encoder = new TextEncoder();
      await characteristic.writeValue(encoder.encode(info.token));
      
      setBleStatus('connected');
      toast.success('BLE соединение установлено');
    } catch (e) {
      setBleStatus('error');
      toast.error('Ошибка BLE: ' + (e as Error).message);
    }
  };

  if (loading && !state) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-sm text-gray-500 uppercase flex items-center gap-2">
          <Cpu size={16} />
          Состояние комнаты
        </h4>
        <div className="flex items-center gap-2">
           {error ? (
             <span className="text-red-500 text-[10px] font-bold flex items-center gap-1">
               <XCircle size={10} /> OFFLINE
             </span>
           ) : (
             <span className="text-green-500 text-[10px] font-bold flex items-center gap-1">
               <Wifi size={10} /> ONLINE
             </span>
           )}
           <button onClick={() => { setLoading(true); fetchState(); }} className="text-gray-400 hover:text-blue-500">
             <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
           </button>
        </div>
      </div>

      {info && (
        <div className="grid grid-cols-2 gap-2 mb-4 text-[10px] text-gray-400 font-mono bg-white p-2 rounded-lg border border-gray-50">
          <div>IP: {info.ip}</div>
          <div>MAC: {info.mac}</div>
          <div>BLE: {info.ble_name}</div>
          <div className="truncate">TOKEN: {info.token}</div>
        </div>
      )}

      {state && (
        <div className="space-y-4">
          {/* Sensors */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white p-3 rounded-xl border border-gray-50 flex flex-col items-center">
              <Thermometer size={18} className="text-red-400 mb-1" />
              <span className="text-xs font-bold">{state.temperature?.toFixed(1)}°C</span>
              <span className="text-[8px] text-gray-400 uppercase">Temp</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-50 flex flex-col items-center">
              <Cloud size={18} className="text-blue-400 mb-1" />
              <span className="text-xs font-bold">{state.humidity?.toFixed(0)}%</span>
              <span className="text-[8px] text-gray-400 uppercase">Humid</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-50 flex flex-col items-center">
              <Wind size={18} className="text-gray-400 mb-1" />
              <span className="text-xs font-bold">{state.pressure?.toFixed(0)}</span>
              <span className="text-[8px] text-gray-400 uppercase">hPa</span>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-xl border border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb size={18} className={state.light_on === 'On' ? 'text-yellow-400' : 'text-gray-300'} />
                <span className="text-xs font-medium">Свет</span>
              </div>
              <button 
                onClick={() => sendCommand(state.light_on === 'On' ? 1 : 0)}
                className={`w-10 h-5 rounded-full relative transition-colors ${state.light_on === 'On' ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${state.light_on === 'On' ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {state.door_lock === 'Closed' ? <DoorClosed size={18} className="text-gray-400" /> : <DoorOpen size={18} className="text-green-500" />}
                <span className="text-xs font-medium">Замок</span>
              </div>
              <button 
                onClick={() => sendCommand(state.door_lock === 'Closed' ? 2 : 3)}
                className="text-[10px] font-bold text-blue-600 hover:underline"
              >
                {state.door_lock === 'Closed' ? 'ОТКРЫТЬ' : 'ЗАКРЫТЬ'}
              </button>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-50 flex items-center justify-between">
              <span className="text-xs font-medium">Канал 1</span>
              <button 
                onClick={() => sendCommand(state.channel_1 === 'ChannelOn' ? 5 : 4)}
                className={`w-10 h-5 rounded-full relative transition-colors ${state.channel_1 === 'ChannelOn' ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${state.channel_1 === 'ChannelOn' ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-50 flex items-center justify-between">
              <span className="text-xs font-medium">Канал 2</span>
              <button 
                onClick={() => sendCommand(state.channel_2 === 'ChannelOn' ? 7 : 6)}
                className={`w-10 h-5 rounded-full relative transition-colors ${state.channel_2 === 'ChannelOn' ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${state.channel_2 === 'ChannelOn' ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>

          {/* BLE Fallback */}
          <button 
            onClick={handleBleConnect}
            disabled={bleStatus === 'connected' || bleStatus === 'scanning'}
            className={`w-full py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 transition-all ${
              bleStatus === 'connected' ? 'bg-green-50 text-green-600 border border-green-100' : 
              bleStatus === 'scanning' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
              'bg-white text-gray-400 border border-gray-100 hover:border-blue-200 hover:text-blue-500'
            }`}
          >
            <Bluetooth size={12} />
            {bleStatus === 'idle' && 'ПОДКЛЮЧИТЬ ПО BLE (FALLBACK)'}
            {bleStatus === 'scanning' && 'ПОИСК УСТРОЙСТВА...'}
            {bleStatus === 'connected' && 'BLE СОЕДИНЕНИЕ АКТИВНО'}
            {bleStatus === 'error' && 'ОШИБКА BLE - ПОВТОРИТЬ'}
          </button>
        </div>
      )}
    </div>
  );
};

// --- Components ---

const Navbar = () => {
  const { profile, logout } = useAuth();
  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-2 font-bold text-xl text-blue-600">
        <HotelIcon size={28} />
        <span>SmartHotel</span>
      </Link>
      <div className="flex items-center gap-4">
        {profile && (
          <>
            <Link to="/bookings" className="text-gray-600 hover:text-blue-600 flex items-center gap-1">
              <Calendar size={20} />
              <span className="hidden sm:inline">Бронирования</span>
            </Link>
            {profile.role === 'admin' && (
              <Link to="/admin" className="text-gray-600 hover:text-blue-600 flex items-center gap-1">
                <Settings size={20} />
                <span className="hidden sm:inline">Админ</span>
              </Link>
            )}
            <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
              <img src={profile.photoURL} alt={profile.displayName} className="w-8 h-8 rounded-full" />
              <button onClick={logout} className="text-gray-500 hover:text-red-500">
                <LogOut size={20} />
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  );
};

const Home = () => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToCollection<Hotel>('hotels', (data) => {
      setHotels(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Выберите отель</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hotels.map((hotel) => (
          <motion.div 
            key={hotel.id}
            whileHover={{ y: -5 }}
            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <img 
              src={hotel.imageUrl || `https://picsum.photos/seed/${hotel.id}/800/600`} 
              alt={hotel.name} 
              className="w-full h-48 object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="p-5">
              <div className="flex items-center gap-1 text-gray-500 text-sm mb-2">
                <MapPin size={14} />
                <span>{hotel.location}</span>
              </div>
              <h2 className="text-xl font-bold mb-2">{hotel.name}</h2>
              <p className="text-gray-600 text-sm line-clamp-2 mb-4">{hotel.description}</p>
              <Link 
                to={`/hotel/${hotel.id}`}
                className="block w-full text-center bg-blue-600 text-white py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                Посмотреть номера
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const HotelDetails = () => {
  const { id } = useParams();
  const { profile } = useAuth();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getDocument<Hotel>('hotels', id).then(setHotel);
    const unsubscribe = subscribeToCollection<Room>(`hotels/${id}/rooms`, setRooms);
    setLoading(false);
    return unsubscribe;
  }, [id]);

  const handleBook = async (room: Room) => {
    if (!profile || !id) return;
    try {
      const bookingData = {
        userId: profile.uid,
        hotelId: id,
        roomId: room.id,
        checkIn: new Date().toISOString(),
        checkOut: new Date(Date.now() + 86400000).toISOString(), // +1 day
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, 'bookings'), bookingData);
      toast.success('Номер успешно забронирован!');
    } catch (error) {
      toast.error('Ошибка при бронировании');
    }
  };

  if (loading || !hotel) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <Link to="/" className="text-blue-600 hover:underline mb-4 inline-block">← Назад к списку</Link>
        <h1 className="text-4xl font-bold">{hotel.name}</h1>
        <p className="text-gray-500 flex items-center gap-1 mt-2">
          <MapPin size={18} />
          {hotel.location}
        </p>
      </div>

      <h2 className="text-2xl font-bold mb-6">Доступные номера</h2>
      <div className="space-y-4">
        {rooms.map((room) => (
          <div key={room.id} className="bg-white p-6 rounded-2xl border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xl">
                {room.roomNumber}
              </div>
              <div>
                <h3 className="font-bold text-lg">{room.type}</h3>
                <p className="text-gray-500">{room.price} ₽ / ночь</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                room.status === 'available' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {room.status === 'available' ? 'Свободен' : 'Занят'}
              </span>
              <button 
                onClick={() => handleBook(room)}
                disabled={room.status !== 'available'}
                className="bg-blue-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Забронировать
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MyBookings = () => {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const unsubscribe = subscribeToCollection<Booking>(
      'bookings', 
      setBookings, 
      where('userId', '==', profile.uid)
    );
    setLoading(false);
    return unsubscribe;
  }, [profile]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Мои бронирования</h1>
      {bookings.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
          <Calendar className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500">У вас пока нет бронирований</p>
          <Link to="/" className="text-blue-600 font-medium mt-2 inline-block">Найти отель</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map((booking) => (
            <div key={booking.id}>
              <BookingCard booking={booking} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BookingCard = ({ booking }: { booking: Booking }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);

  useEffect(() => {
    getDocument<Hotel>('hotels', booking.hotelId).then(setHotel);
    const unsubscribe = subscribeToDocument<Room>(`hotels/${booking.hotelId}/rooms`, booking.roomId, setRoom);
    return unsubscribe;
  }, [booking]);

  const toggleLight = async () => {
    if (!room || !hotel) return;
    try {
      await updateDocument(`hotels/${hotel.id}/rooms`, room.id, { lightOn: !room.lightOn });
      toast.success(room.lightOn ? 'Свет выключен' : 'Свет включен');
    } catch (e) {
      toast.error('Ошибка управления');
    }
  };

  const toggleDoor = async () => {
    if (!room || !hotel) return;
    try {
      await updateDocument(`hotels/${hotel.id}/rooms`, room.id, { doorLocked: !room.doorLocked });
      toast.success(room.doorLocked ? 'Дверь открыта' : 'Дверь закрыта');
    } catch (e) {
      toast.error('Ошибка управления');
    }
  };

  if (!hotel || !room) return null;

  const isCheckedIn = booking.status === 'checked-in';

  return (
    <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="p-6 border-b border-gray-50 flex justify-between items-start">
        <div>
          <h3 className="font-bold text-xl">{hotel.name}</h3>
          <p className="text-gray-500 text-sm">Номер {room.roomNumber} • {room.type}</p>
          <div className="flex items-center gap-4 mt-3 text-sm font-medium">
             <div className="flex flex-col">
               <span className="text-gray-400 text-xs uppercase">Заезд</span>
               <span>{format(new Date(booking.checkIn), 'dd.MM.yyyy')}</span>
             </div>
             <ChevronRight className="text-gray-300 mt-4" size={16} />
             <div className="flex flex-col">
               <span className="text-gray-400 text-xs uppercase">Выезд</span>
               <span>{format(new Date(booking.checkOut), 'dd.MM.yyyy')}</span>
             </div>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
          booking.status === 'checked-in' ? 'bg-blue-100 text-blue-600' : 
          booking.status === 'confirmed' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
        }`}>
          {booking.status === 'checked-in' ? 'В номере' : 
           booking.status === 'confirmed' ? 'Подтверждено' : booking.status}
        </span>
      </div>

      {isCheckedIn ? (
        <div className="p-6 bg-blue-50 grid grid-cols-2 gap-4">
          <button 
            onClick={toggleDoor}
            className={`flex flex-col items-center justify-center p-6 rounded-2xl transition-all ${
              room.doorLocked ? 'bg-white text-gray-700 shadow-sm' : 'bg-blue-600 text-white shadow-lg scale-105'
            }`}
          >
            {room.doorLocked ? <DoorClosed size={32} /> : <DoorOpen size={32} />}
            <span className="mt-2 font-bold">{room.doorLocked ? 'Открыть дверь' : 'Дверь открыта'}</span>
            <span className="text-[10px] uppercase opacity-60 mt-1">BLE Technology</span>
          </button>
          <button 
            onClick={toggleLight}
            className={`flex flex-col items-center justify-center p-6 rounded-2xl transition-all ${
              !room.lightOn ? 'bg-white text-gray-700 shadow-sm' : 'bg-yellow-400 text-white shadow-lg scale-105'
            }`}
          >
            <Lightbulb size={32} className={room.lightOn ? 'animate-pulse' : ''} />
            <span className="mt-2 font-bold">{room.lightOn ? 'Выключить свет' : 'Включить свет'}</span>
            <span className="text-[10px] uppercase opacity-60 mt-1">Smart Room</span>
          </button>
        </div>
      ) : (
        <div className="p-6 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-500 italic text-sm">
            <Key size={16} />
            Смарт-ключ будет доступен после заезда
          </div>
          {booking.status === 'confirmed' && (
            <button 
              onClick={async () => {
                await updateDocument('bookings', booking.id, { status: 'checked-in' });
                await updateDocument(`hotels/${hotel.id}/rooms`, room.id, { status: 'occupied' });
                toast.success('Добро пожаловать в номер!');
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700"
            >
              Заселиться сейчас
            </button>
          )}
        </div>
      )}
      <RoomController hotelId={hotel.id} roomId={room.id} />
    </div>
  );
};

const AdminDashboard = () => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    subscribeToCollection<Hotel>('hotels', (data) => {
      setHotels(data);
      if (data.length > 0 && !selectedHotel) setSelectedHotel(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedHotel) return;
    const unsubscribe = subscribeToCollection<Room>(`hotels/${selectedHotel}/rooms`, setRooms);
    return unsubscribe;
  }, [selectedHotel]);

  const addSampleData = async () => {
    try {
      const hotelId = 'hotel-1';
      await setDocument('hotels', hotelId, {
        name: 'Grand Plaza Hotel',
        location: 'Москва, ул. Тверская, 1',
        description: 'Роскошный отель в самом центре города с видом на Кремль.',
        imageUrl: 'https://picsum.photos/seed/hotel1/1200/800'
      });

      const rooms = [
        { id: 'room-101', roomNumber: '101', type: 'Standard', price: 5000, status: 'available', lightOn: false, doorLocked: true },
        { id: 'room-102', roomNumber: '102', type: 'Deluxe', price: 8000, status: 'available', lightOn: false, doorLocked: true },
        { id: 'room-201', roomNumber: '201', type: 'Suite', price: 15000, status: 'occupied', lightOn: true, doorLocked: false },
      ];

      for (const room of rooms) {
        await setDocument(`hotels/${hotelId}/rooms`, room.id, { ...room, hotelId });
      }

      toast.success('Тестовые данные добавлены');
    } catch (e) {
      toast.error('Ошибка добавления данных');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Панель администратора</h1>
        <button onClick={addSampleData} className="text-sm text-blue-600 hover:underline">Добавить тестовые данные</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-2">
          <h2 className="text-sm font-bold text-gray-400 uppercase mb-4">Отели</h2>
          {hotels.map(h => (
            <button 
              key={h.id}
              onClick={() => setSelectedHotel(h.id)}
              className={`w-full text-left p-3 rounded-xl transition-colors ${
                selectedHotel === h.id ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'
              }`}
            >
              {h.name}
            </button>
          ))}
          <button className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all">
            <Plus size={18} />
            Добавить отель
          </button>
        </div>

        <div className="lg:col-span-3">
          <h2 className="text-sm font-bold text-gray-400 uppercase mb-4">Статус номеров</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rooms.map(room => (
              <div key={room.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg">№{room.roomNumber}</span>
                    <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded-md uppercase">{room.type}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      {room.lightOn ? <Lightbulb size={12} className="text-yellow-500" /> : <Lightbulb size={12} className="text-gray-300" />}
                      {room.lightOn ? 'Свет вкл' : 'Свет выкл'}
                    </span>
                    <span className="flex items-center gap-1">
                      {room.doorLocked ? <DoorClosed size={12} className="text-gray-400" /> : <DoorOpen size={12} className="text-green-500" />}
                      {room.doorLocked ? 'Закрыто' : 'Открыто'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`block px-3 py-1 rounded-full text-[10px] font-bold uppercase mb-2 ${
                    room.status === 'available' ? 'bg-green-100 text-green-600' : 
                    room.status === 'occupied' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                  }`}>
                    {room.status === 'available' ? 'Свободен' : 
                     room.status === 'occupied' ? 'Занят' : 'Сервис'}
                  </span>
                  <button className="text-blue-600 text-xs font-bold hover:underline">Изменить</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Login = () => {
  const { login } = useAuth();
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-blue-200">
        <HotelIcon size={40} />
      </div>
      <h1 className="text-4xl font-bold mb-4">SmartHotel Access</h1>
      <p className="text-gray-500 max-w-md mb-12">
        Управляйте своим проживанием со смартфона: бронирование, BLE-ключи и умный номер в одном приложении.
      </p>
      <button 
        onClick={login}
        className="flex items-center gap-3 bg-white border border-gray-200 px-8 py-4 rounded-2xl font-bold shadow-sm hover:shadow-md transition-all active:scale-95"
      >
        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
        Войти через Google
      </button>
    </div>
  );
};

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  if (!user) return <Login />;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/hotel/:id" element={<HotelDetails />} />
          <Route path="/bookings" element={<MyBookings />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>
      <Toaster position="bottom-center" />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
