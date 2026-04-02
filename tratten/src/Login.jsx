import { useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export default function Login({ onLogin }) {
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
      const userRef = doc(db, "users", email.toLowerCase());
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        // User exists, verify PIN
        if (userSnap.data().pin === pin) {
          onLogin(email.toLowerCase());
        } else {
          setError("Incorrect PIN. Try again.");
        }
      } else {
        // New user, register them in our "dict"
        await setDoc(userRef, { pin: pin });
        onLogin(email.toLowerCase());
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
        <h1 className="mb-6 text-2xl font-bold text-gray-800">Welcome to TraTTen</h1>
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