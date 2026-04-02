import { useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "./firebase";

// ==========================================
// 1. CLOUD LOGIN COMPONENT
// ==========================================
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (pin.length !== 4) return setError("PIN must be 4 digits");
    
    setLoading(true);
    setError("");

    try {
      const safeEmail = email.toLowerCase();
      const userRef = doc(db, "users", safeEmail);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        if (userSnap.data().pin === pin) {
          onLogin(safeEmail);
        } else {
          setError("Incorrect PIN. Try again.");
        }
      } else {
        await setDoc(userRef, { pin: pin });
        onLogin(safeEmail);
      }
    } catch (err) {
      setError("Failed to connect to server.");
      console.error(err);
    }
    
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl border border-gray-100">
        <h1 className="mb-6 text-2xl font-bold text-gray-800">Welcome to TraTten</h1>
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-400">Email</label>
            <input 
              type="email" 
              required
              className="mt-1 w-full rounded-xl border border-gray-200 p-3 outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-400">4-Digit PIN</label>
            <input 
              type="password" 
              maxLength="4"
              required
              className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-center text-2xl tracking-widest outline-none focus:ring-2 focus:ring-orange-400"
              value={pin}
              onChange={(e) => {
                setError(""); 
                setPin(e.target.value.replace(/\D/g, ""));
              }}
            />
          </div>
          {error && <p className="text-sm font-medium text-red-500">{error}</p>}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full rounded-xl bg-gray-900 p-4 font-bold text-white transition hover:bg-black active:scale-95 disabled:opacity-50"
          >
            {loading ? "Checking..." : "Enter Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 2. MAIN CALENDAR WITH STATS & FIREBASE
// ==========================================
const TRAIL_ACTIVATE_MS = 120;
const TRAIL_CLEAR_MS = 1200;

const getQuarterMonths = () => {
  const now = new Date();
  const month = now.getMonth();
  const quarterStart = Math.floor(month / 3) * 3;
  return [0, 1, 2].map((i) => new Date(now.getFullYear(), quarterStart + i, 1));
};

const generateDays = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const blanks = Array.from({ length: firstDay }, () => null);
  const actualDays = Array.from({ length: days }, (_, i) => i + 1);
  return [...blanks, ...actualDays];
};

const getRows = (days) => {
  const rows = [];
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7));
  }
  return rows;
};

function QuarterlyCalendar({ userEmail }) {
  const styles = `
    @keyframes glowPulse {
      0% { box-shadow: 0 0 0 rgba(34,197,94,0.2); }
      50% { box-shadow: 0 0 18px rgba(34,197,94,0.5); }
      100% { box-shadow: 0 0 0 rgba(34,197,94,0.2); }
    }
    @keyframes hoverPulse {
      0% { box-shadow: 0 0 0 rgba(59,130,246,0.15); }
      50% { box-shadow: 0 0 10px rgba(59,130,246,0.35); }
      100% { box-shadow: 0 0 0 rgba(59,130,246,0.15); }
    }
    .today-glow { animation: glowPulse 3s infinite ease-in-out; }
    .hover-breathe:hover { animation: hoverPulse 2s infinite ease-in-out; }
    .trail-active { background: rgba(37,99,235,0.35); }
    .trail-fade { background: rgba(37,99,235,0); transition: background 1.2s ease-out; }
  `;

  const [selectedDate, setSelectedDate] = useState(null);
  const [data, setData] = useState({});
  const [trailMap, setTrailMap] = useState({});
  const [isLoadingData, setIsLoadingData] = useState(true);

  const today = new Date();
  const todayRef = useRef(null);
  const timeoutRefs = useRef([]);
  const months = getQuarterMonths();

  useEffect(() => {
    async function fetchCalendarData() {
      if (!userEmail) return;
      const calendarRef = doc(db, "calendars", userEmail);
      const docSnap = await getDoc(calendarRef);
      if (docSnap.exists()) { setData(docSnap.data()); }
      setIsLoadingData(false);
    }
    fetchCalendarData();
  }, [userEmail]);

  useEffect(() => {
    if (todayRef.current && !isLoadingData) {
      todayRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isLoadingData]);

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current = [];
    };
  }, []);

  const triggerTrail = (key) => {
    if (data[key]) return;
    setTrailMap((prev) => {
      if (prev[key]) return prev;
      return { ...prev, [key]: "active" };
    });
    const activateTimer = setTimeout(() => {
      setTrailMap((prev) => {
        if (!prev[key]) return prev;
        return { ...prev, [key]: "fade" };
      });
    }, TRAIL_ACTIVATE_MS);
    const clearTimer = setTimeout(() => {
      setTrailMap((prev) => {
        if (!prev[key]) return prev;
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }, TRAIL_CLEAR_MS);
    timeoutRefs.current.push(activateTimer, clearTimer);
  };

  const handleSelect = async (dateKey, type) => {
    setData((prev) => ({ ...prev, [dateKey]: type }));
    setSelectedDate(null);
    try {
      const calendarRef = doc(db, "calendars", userEmail);
      await setDoc(calendarRef, { [dateKey]: type }, { merge: true });
    } catch (err) { console.error("Failed to save to cloud", err); }
  };

  // NEW DELETE FUNCTION
  const handleDelete = async (dateKey) => {
    setData((prev) => {
      const newData = { ...prev };
      delete newData[dateKey];
      return newData;
    });
    setSelectedDate(null);
    try {
      const calendarRef = doc(db, "calendars", userEmail);
      await updateDoc(calendarRef, { [dateKey]: deleteField() });
    } catch (err) { console.error("Failed to delete from cloud", err); }
  };

  const getColor = (key) => {
    if (data[key] === "office") return "bg-blue-100";
    if (data[key] === "home") return "bg-orange-100";
    return "bg-white";
  };

  const isToday = (monthObj, day) => {
    return (
      today.getDate() === day &&
      today.getMonth() === monthObj.getMonth() &&
      today.getFullYear() === monthObj.getFullYear()
    );
  };

  const isWeekend = (monthObj, day) => {
    const d = new Date(monthObj.getFullYear(), monthObj.getMonth(), day);
    const dayNum = d.getDay();
    return dayNum === 0 || dayNum === 6;
  };

  const getStats = () => {
    let totalMarkedOffice = 0;
    let totalMarkedHome = 0;
    let totalWeekdaysInQuarter = 0;
    const monthlyStats = [];

    months.forEach((monthObj) => {
      let mOffice = 0;
      let mMarked = 0;
      const monthIdx = monthObj.getMonth();
      const year = monthObj.getFullYear();
      
      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dayOfWeek = new Date(year, monthIdx, d).getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { totalWeekdaysInQuarter++; }
      }

      Object.keys(data).forEach((key) => {
        if (key.startsWith(`${monthIdx}-`)) {
          mMarked++;
          if (data[key] === "office") { mOffice++; totalMarkedOffice++; } 
          else { totalMarkedHome++; }
        }
      });

      if (monthIdx <= today.getMonth() || year > today.getFullYear()) {
        if (mMarked > 0) {
          monthlyStats.push({
            name: monthObj.toLocaleString("default", { month: "short" }),
            percent: Math.round((mOffice / mMarked) * 100),
          });
        }
      }
    });

    const totalAllowedWFH = Math.floor(totalWeekdaysInQuarter * 0.34);
    const remainingWFH = Math.max(0, totalAllowedWFH - totalMarkedHome);
    const qDays = months.reduce((acc, m) => acc + new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(), 0);
    const startOfQ = months[0];
    const diffTime = Math.max(0, today - startOfQ);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const qPercent = Math.min(100, Math.round((diffDays / qDays) * 100));

    return { monthlyStats, remainingWFH, qPercent };
  };

  const stats = getStats();

  const getRowOverlay = (week, monthObj, rowIdx) => {
    let office = 0;
    let home = 0;
    const year = monthObj.getFullYear();
    const month = monthObj.getMonth();
    const firstDay = new Date(year, month, 1).getDay();

    week.forEach((day, i) => {
      let dateObj = null;
      if (day) { dateObj = new Date(year, month, day); } 
      else if (rowIdx === 0) {
        const prevDay = i - firstDay + 1;
        dateObj = new Date(year, month, prevDay);
      } else { return; }
      
      const dayNum = dateObj.getDay();
      if (dayNum === 0 || dayNum === 6) return; 
      const key = `${dateObj.getMonth()}-${dateObj.getDate()}`;
      if (data[key] === "office") office++;
      if (data[key] === "home") home++;
    });

    if (office + home === 5) {
      const isOffice = office >= home;
      return {
        text: `${Math.max(office, home)}/5 ${isOffice ? "O" : "H"}`,
        color: isOffice ? "bg-blue-100" : "bg-orange-100",
      };
    }
    return null;
  };

  const renderMonth = (monthObj) => {
    const days = generateDays(monthObj);
    const rows = getRows(days);

    return (
      <div className="p-2">
        <div className="mb-2 text-sm font-medium text-gray-700">
          {monthObj.toLocaleString("default", { month: "long" })}
        </div>
        <div className="mb-1 grid grid-cols-7 text-center text-xs text-gray-400">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={`${d}-${i}`}>{d}</div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((week, rowIdx) => {
            const overlay = getRowOverlay(week, monthObj, rowIdx);
            return (
              <div key={`${monthObj.getMonth()}-${rowIdx}`} className="relative grid grid-cols-7 gap-2 group">
                {overlay && (
                  <div className={`absolute inset-0 z-10 flex items-center justify-center rounded-xl text-black font-medium ${overlay.color} opacity-100 group-hover:opacity-0 transition pointer-events-none`}>
                    {overlay.text}
                  </div>
                )}
                {week.map((day, idx) => {
                  if (!day) return <div key={`blank-${idx}`} />;
                  const key = `${monthObj.getMonth()}-${day}`;
                  const todayCheck = isToday(monthObj, day);
                  const isOpen = selectedDate === key;
                  const weekend = isWeekend(monthObj, day);
                  const trailState = trailMap[key];

                  return (
                    <div key={day} className="relative" ref={todayCheck ? todayRef : null}>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (weekend) return;
                          setSelectedDate(isOpen ? null : key);
                        }}
                        onMouseEnter={() => triggerTrail(key)}
                        className={`hover-breathe relative flex h-14 flex-col items-center justify-center rounded-2xl border text-sm transition-all duration-200 ease-out active:scale-95
                          ${!data[key] && trailState === "active" ? "trail-active" : ""}
                          ${!data[key] && trailState === "fade" ? "trail-fade" : ""}
                          ${getColor(key)}
                          ${todayCheck ? "border-green-600 shadow-lg today-glow" : "border-gray-200"}
                          ${isOpen ? "ring-2 ring-yellow-500 bg-yellow-50 shadow-xl" : ""}
                          ${weekend ? "cursor-not-allowed opacity-30" : "cursor-pointer"}
                        `}
                      >
                        {todayCheck && (
                          <div className="absolute top-1 text-[6px] uppercase tracking-wide text-green-700">TODAY</div>
                        )}
                        <div className={`text-lg ${todayCheck ? "text-green-700" : ""}`}>{day}</div>
                      </div>

                      {isOpen && (
                        <div
                          className="absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-12 gap-2 rounded-xl border bg-white/90 px-3 py-2 text-xs shadow-2xl backdrop-blur-md items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleSelect(key, "office")}
                            className="cursor-pointer rounded-lg bg-blue-500 px-3 py-1.5 text-white font-medium shadow-md hover:scale-105 transition"
                          >
                            Office
                          </button>
                          <button
                            onClick={() => handleSelect(key, "home")}
                            className="cursor-pointer rounded-lg bg-orange-400 px-3 py-1.5 text-white font-medium shadow-md hover:scale-105 transition"
                          >
                            Home
                          </button>
                          
                          {/* DELETE BUTTON */}
                          <button
                            onClick={() => handleDelete(key)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-white text-red-500 font-bold shadow-sm hover:bg-red-50 transition"
                            title="Delete entry"
                          >
                            D
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoadingData) {
    return <div className="flex h-64 items-center justify-center text-gray-500 font-medium italic">Syncing cloud...</div>;
  }

  return (
    <>
      <style>{styles}</style>
      <div className="max-h-screen overflow-y-auto bg-white p-4" onClick={() => setSelectedDate(null)}>
        
        {/* STATS DASHBOARD */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-blue-50 p-4 border border-blue-100 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">WFH Remaining</div>
            <div className="text-2xl font-black text-blue-900">{stats.remainingWFH} <span className="text-sm font-medium">days</span></div>
            <div className="text-[9px] text-blue-400 mt-1">To maintain 66% Office</div>
          </div>

          <div className="rounded-2xl bg-green-50 p-4 border border-green-100 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-green-600">Q-Progress</div>
            <div className="text-2xl font-black text-green-900">{stats.qPercent}%</div>
            <div className="h-1.5 w-full bg-green-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-green-600" style={{ width: `${stats.qPercent}%` }}></div>
            </div>
          </div>

          {stats.monthlyStats.map((m) => (
            <div key={m.name} className="rounded-2xl bg-gray-50 p-4 border border-gray-100 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Office: {m.name}</div>
              <div className="text-2xl font-black text-gray-900">{m.percent}%</div>
              <div className="text-[9px] text-gray-400 mt-1">Based on marked days</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 pb-20">
          {months.map((m, idx) => (
            <div key={`${m.getFullYear()}-${m.getMonth()}-${idx}`}>{renderMonth(m)}</div>
          ))}
        </div>
      </div>
    </>
  );
}

// ==========================================
// 3. MAIN APP WRAPPER (MANAGES STATE & TOP BAR)
// ==========================================
export default function App() {
  const [userEmail, setUserEmail] = useState(null);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPin, setNewPin] = useState("");

  useEffect(() => {
    const savedSession = localStorage.getItem("tratten_active_session");
    if (savedSession) { setUserEmail(savedSession); }
  }, []);

  const handleLogin = (email) => {
    localStorage.setItem("tratten_active_session", email);
    setUserEmail(email);
  };

  const handleLogout = () => {
    localStorage.removeItem("tratten_active_session");
    setUserEmail(null);
  };

  const handleChangePin = async (e) => {
    e.preventDefault();
    if (newPin.length !== 4) return alert("PIN must be 4 digits");
    try {
      const userRef = doc(db, "users", userEmail);
      await updateDoc(userRef, { pin: newPin });
      alert("PIN updated successfully!");
      setIsChangingPin(false);
      setNewPin("");
    } catch (err) { alert("Failed to update PIN"); }
  };

  if (!userEmail) { return <Login onLogin={handleLogin} />; }

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <div className="flex items-center justify-between bg-white p-4 shadow-sm border-b z-40 relative">
        <span className="font-semibold text-gray-700 truncate max-w-[50%]">
          {userEmail.split('@')[0]}
        </span>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsChangingPin(true)}
            className="text-sm text-gray-600 hover:text-gray-900 font-medium bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md transition"
          >
            Change PIN
          </button>
          <button 
            onClick={handleLogout}
            className="text-sm text-red-500 hover:text-red-700 font-medium bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md transition"
          >
            Logout
          </button>
        </div>
      </div>

      {isChangingPin && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Set New PIN</h2>
            <form onSubmit={handleChangePin} className="space-y-4">
              <input 
                type="password" 
                maxLength="4"
                placeholder="New 4-digit PIN"
                className="w-full rounded-xl border border-gray-200 p-3 text-center text-xl tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setIsChangingPin(false); setNewPin(""); }} className="flex-1 rounded-lg bg-gray-100 p-3 font-semibold text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 rounded-lg bg-blue-600 p-3 font-semibold text-white">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-hidden relative z-0">
         <QuarterlyCalendar userEmail={userEmail} />
      </div>
    </div>
  );
}