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
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
        <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-gray-900">TraTten.</h1>
        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Email</label>
            <input 
              type="email" 
              required
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-4 outline-none focus:bg-white focus:ring-2 focus:ring-gray-900 transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">4-Digit PIN</label>
            <input 
              type="password" 
              maxLength="4"
              required
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-4 text-center text-3xl tracking-[0.5em] outline-none focus:bg-white focus:ring-2 focus:ring-gray-900 transition font-mono"
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
            className="w-full rounded-xl bg-gray-900 p-4 mt-2 font-bold text-white transition hover:bg-black active:scale-95 disabled:opacity-50 shadow-lg shadow-gray-900/20"
          >
            {loading ? "Verifying..." : "Enter"}
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
      0% { box-shadow: 0 0 0 rgba(156,163,175,0.1); }
      50% { box-shadow: 0 0 20px rgba(156,163,175,0.4); }
      100% { box-shadow: 0 0 0 rgba(156,163,175,0.1); }
    }
    .today-glow { animation: glowPulse 3s infinite ease-in-out; }
    .trail-active { background: rgba(229,231,235,0.8); }
    .trail-fade { background: rgba(229,231,235,0); transition: background 1.2s ease-out; }
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
    if (data[key] === "office") return "bg-gray-200 text-gray-900";
    if (data[key] === "home") return "bg-gray-700 text-white";
    return "bg-transparent";
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
        // MATCHING THE NEW YYYY-MM-DD KEY FORMAT
        if (key.startsWith(`${year}-${monthIdx}-`)) {
          mMarked++;
          if (data[key] === "office") { mOffice++; totalMarkedOffice++; } 
          else { totalMarkedHome++; }
        }
      });

      // Show stats if the user has marked ANY data for this month
      if (mMarked > 0) {
        monthlyStats.push({
          name: monthObj.toLocaleString("default", { month: "short" }),
          percent: Math.round((mOffice / mMarked) * 100),
        });
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
      
      // NEW YYYY-MM-DD FORMAT
      const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
      if (data[key] === "office") office++;
      if (data[key] === "home") home++;
    });

    if (office + home === 5) {
      const isOffice = office >= home;
      return {
        text: `${Math.max(office, home)}/5 ${isOffice ? "O" : "H"}`,
        color: isOffice ? "bg-gray-200 text-gray-900 shadow-md" : "bg-gray-700 text-white shadow-md",
      };
    }
    return null;
  };

  const renderMonth = (monthObj) => {
    const days = generateDays(monthObj);
    const rows = getRows(days);
    const year = monthObj.getFullYear();

    return (
      <div className="py-4">
        <div className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-400">
          {monthObj.toLocaleString("default", { month: "long" })}
        </div>
        <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-semibold uppercase text-gray-300">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={`${d}-${i}`}>{d}</div>
          ))}
        </div>
        <div className="flex flex-col gap-1 sm:gap-2">
          {rows.map((week, rowIdx) => {
            const overlay = getRowOverlay(week, monthObj, rowIdx);
            return (
              <div key={`${monthObj.getMonth()}-${rowIdx}`} className="relative grid grid-cols-7 gap-1 sm:gap-2 group">
                {overlay && (
                  <div className={`absolute inset-0 z-10 flex items-center justify-center rounded-2xl text-xs font-bold tracking-widest ${overlay.color} opacity-100 group-hover:opacity-0 transition duration-300 pointer-events-none`}>
                    {overlay.text}
                  </div>
                )}
                {week.map((day, idx) => {
                  if (!day) return <div key={`blank-${idx}`} />;
                  
                  // NEW YYYY-MM-DD FORMAT
                  const key = `${year}-${monthObj.getMonth()}-${day}`;
                  const todayCheck = isToday(monthObj, day);
                  const isOpen = selectedDate === key;
                  const weekend = isWeekend(monthObj, day);
                  const trailState = trailMap[key];
                  const hasData = !!data[key];

                  return (
                    <div key={day} className="relative" ref={todayCheck ? todayRef : null}>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (weekend) return;
                          setSelectedDate(isOpen ? null : key);
                        }}
                        onMouseEnter={() => triggerTrail(key)}
                        className={`relative flex h-12 sm:h-14 flex-col items-center justify-center rounded-2xl transition-all duration-200 ease-out active:scale-90
                          ${!hasData && trailState === "active" ? "trail-active" : ""}
                          ${!hasData && trailState === "fade" ? "trail-fade" : ""}
                          ${getColor(key)}
                          ${todayCheck ? "ring-1 ring-gray-400/50 today-glow font-bold" : ""}
                          ${isOpen ? "ring-2 ring-gray-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-10 scale-105" : ""}
                          ${weekend ? "cursor-not-allowed opacity-20 text-gray-400" : "cursor-pointer"}
                          ${!hasData && !isOpen && !weekend ? "hover:bg-gray-100/50" : ""}
                        `}
                      >
                        {todayCheck && (
                          <div className="absolute top-1 text-[5px] uppercase tracking-widest text-gray-900 font-bold">TODAY</div>
                        )}
                        <div className={`text-sm sm:text-base font-medium ${todayCheck ? "text-gray-900" : (hasData ? "" : "text-gray-500")}`}>
                          {day}
                        </div>
                      </div>

                      {isOpen && (
                        <div
                          className="absolute left-1/2 top-0 z-50 flex -translate-x-1/2 -translate-y-12 gap-2 rounded-2xl border border-gray-100 bg-white px-3 py-2 text-xs shadow-[0_20px_40px_rgb(0,0,0,0.1)] backdrop-blur-xl items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleSelect(key, "office")}
                            className="cursor-pointer rounded-xl bg-gray-200 px-4 py-2 text-gray-900 font-semibold shadow-sm hover:scale-105 hover:bg-gray-300 transition"
                          >
                            Office
                          </button>
                          <button
                            onClick={() => handleSelect(key, "home")}
                            className="cursor-pointer rounded-xl bg-gray-700 px-4 py-2 text-white font-semibold shadow-sm hover:scale-105 hover:bg-gray-800 transition"
                          >
                            Home
                          </button>
                          
                          <button
                            onClick={() => handleDelete(key)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-red-500 font-bold hover:bg-gray-50 transition shrink-0"
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
    return <div className="flex h-64 items-center justify-center text-gray-400 font-medium tracking-widest uppercase text-xs">Syncing...</div>;
  }

  return (
    <>
      <style>{styles}</style>
      <div className="max-h-screen overflow-y-auto bg-[#F9FAFB] p-4 sm:p-8" onClick={() => setSelectedDate(null)}>
        
        <div className="max-w-3xl mx-auto w-full">
          {/* STATS DASHBOARD - Top Grid */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-3xl bg-white p-5 border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
              <div className="text-[9px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">WFH Remaining</div>
              <div className="text-3xl font-black text-gray-800 tracking-tight">{stats.remainingWFH} <span className="text-xs font-semibold text-gray-400 tracking-normal">days</span></div>
            </div>

            {stats.monthlyStats.map((m) => (
              <div key={m.name} className="rounded-3xl bg-white p-5 border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                <div className="text-[9px] font-extrabold uppercase tracking-widest text-gray-400 mb-1">Office: {m.name}</div>
                <div className="text-3xl font-black text-gray-800 tracking-tight">{m.percent}%</div>
              </div>
            ))}
          </div>

          {/* Q-PROGRESS BAR - Thin & Long */}
          <div className="mb-10 rounded-2xl bg-white px-5 py-4 border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex items-center gap-4 sm:gap-6">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 whitespace-nowrap">Q-Progress</div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden flex-1">
                <div className="h-full bg-gray-800 rounded-full transition-all duration-1000 ease-out" style={{ width: `${stats.qPercent}%` }}></div>
            </div>
            <div className="text-lg font-black text-gray-800 tracking-tight">{stats.qPercent}%</div>
          </div>

          {/* CALENDAR - Clean & Blended */}
          <div className="flex flex-col gap-6 pb-20">
            {months.map((m, idx) => (
              <div key={`${m.getFullYear()}-${m.getMonth()}-${idx}`} className="p-2 sm:p-4">
                {renderMonth(m)}
              </div>
            ))}
          </div>
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
    <div className="bg-[#F9FAFB] min-h-screen flex flex-col font-sans text-gray-900">
      <div className="flex items-center justify-between bg-white px-6 py-4 shadow-[0_2px_10px_rgb(0,0,0,0.02)] border-b border-gray-100 z-40 relative">
        <span className="font-bold text-gray-800 truncate max-w-[50%] tracking-tight">
          {userEmail.split('@')[0]}
        </span>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsChangingPin(true)}
            className="text-xs text-gray-500 hover:text-gray-900 font-bold tracking-wide uppercase transition"
          >
            Pin
          </button>
          <button 
            onClick={handleLogout}
            className="text-xs text-red-400 hover:text-red-600 font-bold tracking-wide uppercase transition"
          >
            Logout
          </button>
        </div>
      </div>

      {isChangingPin && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-[0_20px_40px_rgb(0,0,0,0.1)] border border-gray-100">
            <h2 className="text-xl font-extrabold mb-6 text-gray-900 tracking-tight">Set New PIN</h2>
            <form onSubmit={handleChangePin} className="space-y-4">
              <input 
                type="password" 
                maxLength="4"
                placeholder="0000"
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-4 text-center text-3xl tracking-[0.5em] outline-none focus:bg-white focus:ring-2 focus:ring-gray-900 transition font-mono"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setIsChangingPin(false); setNewPin(""); }} className="flex-1 rounded-xl bg-gray-100 p-4 font-bold text-gray-600 transition hover:bg-gray-200">Cancel</button>
                <button type="submit" className="flex-1 rounded-xl bg-gray-900 p-4 font-bold text-white transition hover:bg-black shadow-lg shadow-gray-900/20">Save</button>
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