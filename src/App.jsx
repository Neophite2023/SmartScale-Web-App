import React, { useState, useEffect } from 'react';
import { db, getUser, saveUser, getMeasurements, addMeasurement, deleteMeasurement } from './db';
import { requestScale, subscribeToWeight, calculateBMI, getBMICategory } from './bluetooth';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Scale, History, Settings, Plus, Trash2, User as UserIcon,
  ChevronRight, ArrowLeft, RefreshCw, AlertCircle, Download
} from 'lucide-react';

function App() {
  const [user, setUser] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [latestWeight, setLatestWeight] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [view, setView] = useState('dashboard'); // dashboard, history, onboarding
  const [loading, setLoading] = useState(true);

  // Onboarding form state
  const [form, setForm] = useState({ name: '', height: '', targetWeight: '' });

  useEffect(() => {
    async function init() {
      const existingUser = await getUser();
      if (existingUser) {
        setUser(existingUser);
        const data = await getMeasurements(10);
        setMeasurements(data);
        if (data.length > 0) setLatestWeight(data[0].weight);
        setView('dashboard');
      } else {
        setView('onboarding');
      }
      setLoading(false);
    }
    init();
  }, []);

  const handleOnboarding = async (e) => {
    e.preventDefault();
    const newUser = {
      name: form.name,
      height: parseInt(form.height),
      targetWeight: form.targetWeight ? parseFloat(form.targetWeight) : null
    };
    await saveUser(newUser);
    setUser(newUser);
    setView('dashboard');
  };

  const startWeighing = async () => {
    try {
      setScanning(true);
      const device = await requestScale();

      const cleanup = await subscribeToWeight(device, async (data) => {
        setLatestWeight(data.weight);
        if (data.isStable) {
          const bmi = calculateBMI(data.weight, user.height);
          await addMeasurement({
            userId: user.id,
            weight: data.weight,
            bmi: bmi
          });
          const updatedData = await getMeasurements(10);
          setMeasurements(updatedData);
          cleanup();
          setScanning(false);
        }
      });
    } catch (err) {
      console.error(err);
      setScanning(false);

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

      if (isIOS) {
        alert("⚠️ Na iPhonoch (iOS) Web Bluetooth nefunguje v Chrome ani Safari.\n\nProsím, použi aplikáciu 'Bluefy' (z App Store) alebo použi Android/PC s Chrome.");
      } else if (!navigator.bluetooth) {
        alert("Váš prehliadač nepodporuje Bluetooth. Použite prosím Chrome, Edge alebo Operu.");
      } else {
        alert("Nepodarilo sa pripojiť k váhe. Uistite sa, že je zapnutý Bluetooth a váha je v dosahu.");
      }
    }
  };

  const exportToCSV = () => {
    if (measurements.length === 0) return;

    // Headers and Slovak translation
    const headers = ["Dátum", "Váha (kg)", "BMI", "Kategória"];
    const rows = measurements.map(m => {
      const date = new Date(m.createdAt).toLocaleDateString();
      const weight = m.weight.toFixed(1);
      const bmi = m.bmi.toFixed(1);
      const category = getBMICategory(m.bmi).label;
      return `${date},${weight},${bmi},${category}`;
    });

    // Create CSV content with UTF-8 BOM for Excel compatibility
    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `moje_vahy_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up
  };

  const handleDelete = async (id) => {
    if (confirm("Naozaj chcete zmazať tento záznam?")) {
      await deleteMeasurement(id);
      const updatedData = await getMeasurements(10);
      setMeasurements(updatedData);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[var(--ios-system-background)]">
      <RefreshCw className="w-10 h-10 text-[var(--ios-system-blue)] animate-spin" />
    </div>
  );

  // --- ONBOARDING VIEW ---
  if (view === 'onboarding') return (
    <div className="min-h-screen bg-[var(--ios-system-background)] flex flex-col p-8 pt-20">
      <div className="w-full max-w-sm mx-auto flex flex-col items-center">
        <div className="w-20 h-20 bg-[var(--ios-system-blue)] rounded-[22%] flex items-center justify-center mb-8 shadow-sm">
          <Scale className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-[var(--ios-label)] text-3xl font-extrabold mb-2 text-center">SmartScale</h1>
        <p className="text-[var(--ios-secondary-label)] text-center mb-12">Monitor your progress with Health-style insights.</p>

        <form onSubmit={handleOnboarding} className="w-full space-y-4">
          <div className="bg-[var(--ios-secondary-system-background)] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b-[0.5px] border-[var(--ios-separator)]">
              <input
                required
                className="w-full bg-transparent text-[var(--ios-label)] focus:outline-none placeholder:text-[var(--ios-secondary-label)]"
                placeholder="Name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="px-4 py-3 border-b-[0.5px] border-[var(--ios-separator)]">
              <input
                required type="number"
                className="w-full bg-transparent text-[var(--ios-label)] focus:outline-none placeholder:text-[var(--ios-secondary-label)]"
                placeholder="Height (cm)"
                value={form.height}
                onChange={e => setForm({ ...form, height: e.target.value })}
              />
            </div>
            <div className="px-4 py-3">
              <input
                type="number" step="0.1"
                className="w-full bg-transparent text-[var(--ios-label)] focus:outline-none placeholder:text-[var(--ios-secondary-label)]"
                placeholder="Target Weight (kg)"
                value={form.targetWeight}
                onChange={e => setForm({ ...form, targetWeight: e.target.value })}
              />
            </div>
          </div>
          <button className="w-full bg-[var(--ios-system-blue)] text-white font-semibold py-4 rounded-2xl shadow-sm active:opacity-60 transition-opacity">
            Continue
          </button>
        </form>
      </div>
    </div>
  );

  // --- DASHBOARD VIEW ---
  if (view === 'dashboard') return (
    <div className="min-h-screen bg-[var(--ios-system-background)] text-[var(--ios-label)] font-sans pb-32">
      <header className="px-6 pt-12 pb-6 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Summary</h2>
        </div>
        <button className="w-10 h-10 bg-[var(--ios-secondary-system-background)] rounded-full flex items-center justify-center shadow-sm">
          <UserIcon className="w-5 h-5 text-[var(--ios-system-blue)]" />
        </button>
      </header>

      <main className="px-4 space-y-6">
        {/* Main Status Cell */}
        <div className="bg-[var(--ios-secondary-system-background)] rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[rgba(var(--ios-system-blue-rgb),0.1)] rounded-lg">
                <Scale className="w-5 h-5 text-[var(--ios-system-blue)]" />
              </div>
              <span className="font-semibold text-lg">Weight</span>
            </div>
            <span className="text-[var(--ios-secondary-label)] text-sm">
              {measurements.length > 0 ? new Date(measurements[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No data'}
            </span>
          </div>

          <div className="flex items-baseline gap-1 mb-6">
            <span className="text-5xl font-black">{latestWeight ? latestWeight.toFixed(1) : '--.-'}</span>
            <span className="text-[var(--ios-secondary-label)] font-bold text-xl uppercase">kg</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--ios-tertiary-system-background)] p-4 rounded-xl">
              <p className="text-[var(--ios-secondary-label)] text-[10px] font-bold uppercase mb-1">BMI</p>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${latestWeight ? (
                  getBMICategory(calculateBMI(latestWeight, user.height)).status === 'green' ? 'bg-green-500' :
                    getBMICategory(calculateBMI(latestWeight, user.height)).status === 'blue' ? 'bg-[var(--ios-system-blue)]' :
                      getBMICategory(calculateBMI(latestWeight, user.height)).status === 'orange' ? 'bg-orange-500' : 'bg-red-500'
                ) : 'bg-gray-300'}`}></div>
                <span className="font-bold text-sm">
                  {latestWeight ? getBMICategory(calculateBMI(latestWeight, user.height)).label : '--'}
                </span>
              </div>
            </div>
            <div className="bg-[var(--ios-tertiary-system-background)] p-4 rounded-xl">
              <p className="text-[var(--ios-secondary-label)] text-[10px] font-bold uppercase mb-1">Difference</p>
              <span className="font-bold text-sm text-[var(--ios-system-blue)]">
                {measurements.length > 1 ? (latestWeight - measurements[1].weight).toFixed(1) + " kg" : "--"}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={startWeighing}
          disabled={scanning}
          className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all ${scanning ? 'bg-[var(--ios-secondary-system-background)] text-[var(--ios-secondary-label)]' : 'bg-[var(--ios-system-blue)] text-white font-semibold shadow-sm active:opacity-60'
            }`}
        >
          {scanning ? <RefreshCw className="animate-spin w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {scanning ? "Searching for scale..." : "Record Weight"}
        </button>

        {/* Chart Cell */}
        <div className="bg-[var(--ios-secondary-system-background)] rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg">Trends</h3>
            <button onClick={() => setView('history')} className="text-[var(--ios-system-blue)] text-sm font-medium">
              Show All
            </button>
          </div>

          <div className="h-[200px] w-full">
            {measurements.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={measurements.slice().reverse()}>
                  <CartesianGrid vertical={false} stroke="var(--ios-separator)" strokeDasharray="0" />
                  <XAxis
                    dataKey="createdAt"
                    tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    tick={{ fontSize: 10, fill: 'var(--ios-secondary-label)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={['dataMin - 5', 'dataMax + 5']}
                    tick={{ fontSize: 10, fill: 'var(--ios-secondary-label)' }}
                    axisLine={false}
                    tickLine={false}
                    orientation="right"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--ios-secondary-system-background)', border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    labelStyle={{ color: 'var(--ios-label)', fontWeight: 'bold' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="var(--ios-system-blue)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: 'var(--ios-system-blue)', stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[var(--ios-secondary-label)] gap-2">
                <AlertCircle className="w-8 h-8 opacity-20" />
                <p className="text-sm italic">Need more measurements for trends.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Navigation Bar (iOS Tab Bar Style) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--ios-secondary-system-background)]/80 backdrop-blur-xl border-t border-[var(--ios-separator)] px-6 pt-2 pb-8 flex justify-around items-center">
        <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 ${view === 'dashboard' ? 'text-[var(--ios-system-blue)]' : 'text-[var(--ios-secondary-label)] opacity-90'}`}>
          <Scale className="w-7 h-7" />
          <span className="text-[10px] font-bold">Summary</span>
        </button>
        <button onClick={() => setView('history')} className={`flex flex-col items-center gap-1 ${view === 'history' ? 'text-[var(--ios-system-blue)]' : 'text-[var(--ios-secondary-label)] opacity-90'}`}>
          <History className="w-7 h-7" />
          <span className="text-[10px] font-bold">History</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-[var(--ios-secondary-label)] opacity-90">
          <Settings className="w-7 h-7" />
          <span className="text-[10px] font-bold">Settings</span>
        </button>
      </nav>
    </div>
  );

  // --- HISTORY VIEW ---
  if (view === 'history') return (
    <div className="min-h-screen bg-[var(--ios-system-background)] text-[var(--ios-label)] pb-20">
      <header className="px-6 pt-12 pb-6 flex justify-between items-end">
        <div>
          <button onClick={() => setView('dashboard')} className="flex items-center gap-1 text-[var(--ios-system-blue)] font-medium mb-4">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <h1 className="text-3xl font-bold">History</h1>
        </div>
        <button
          onClick={exportToCSV}
          disabled={measurements.length === 0}
          className="p-3 bg-[var(--ios-secondary-system-background)] rounded-full text-[var(--ios-system-blue)] shadow-sm disabled:opacity-30 active:opacity-60"
          title="Export to CSV"
        >
          <Download className="w-5 h-5" />
        </button>
      </header>

      <div className="px-4">
        <div className="bg-[var(--ios-secondary-system-background)] rounded-2xl overflow-hidden shadow-sm">
          {measurements.map((m, index) => (
            <div key={m.id} className={`p-4 flex justify-between items-center group ${index !== measurements.length - 1 ? 'border-b-[0.5px] border-[var(--ios-separator)]' : ''}`}>
              <div className="flex flex-col">
                <span className="font-semibold text-lg">{m.weight.toFixed(1)} <span className="text-sm font-bold text-[var(--ios-secondary-label)]">kg</span></span>
                <span className="text-[var(--ios-secondary-label)] text-xs">{new Date(m.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>

              <div className="flex items-center gap-3">
                <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${getBMICategory(m.bmi).status === 'green' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  getBMICategory(m.bmi).status === 'blue' ? 'bg-[rgba(var(--ios-system-blue-rgb),0.1)] text-[var(--ios-system-blue)]' :
                    getBMICategory(m.bmi).status === 'orange' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                  BMI {m.bmi.toFixed(1)}
                </div>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="p-2 text-red-500 rounded-full active:bg-red-50 dark:active:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {measurements.length === 0 && (
            <div className="text-center py-20 px-6">
              <Scale className="w-12 h-12 text-[var(--ios-separator)] mx-auto mb-4" />
              <p className="text-[var(--ios-secondary-label)]">No health data found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
