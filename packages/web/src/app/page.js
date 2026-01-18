'use client';

import { useState } from 'react';
import WebViewLogin from '@/components/WebViewLogin';
import api from '@/lib/api';
import axios from 'axios';
import { useSession } from 'next-auth/react';

export default function Dashboard() {
  const { data: session } = useSession();
  const [universeName, setUniverseName] = useState('');
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [universes, setUniverses] = useState([]);
  const [selectedUniverse, setSelectedUniverse] = useState(null);

  useEffect(() => {
    if (session) {
      fetchJobs();
      fetchLogs();
      fetchUniverses();
      const interval = setInterval(() => {
        fetchJobs();
        fetchLogs();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const fetchJobs = async () => {
    const res = await api.get('/api/jobs');
    setJobs(res.data);
  };

  const fetchLogs = async () => {
    const res = await api.get('/api/logs');
    setLogs(res.data);
  };

  const fetchUniverses = async () => {
    try {
      const res = await api.get('/api/roblox/universes');
      setUniverses(res.data);
      if (res.data.length > 0 && !selectedUniverse) {
        setSelectedUniverse(res.data[0]);
      }
    } catch (err) {}
  };

  const handleCreateUniverse = async () => {
    setLoading(true);
    try {
      const res = await api.post('/api/roblox/create-universe', { name: universeName });
      alert(`Universe created: ${res.data.universeId}`);
    } catch (err) {
      alert(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">WebView Login</h2>
        {session?.user?.id ? (
          <WebViewLogin userId={session.user.id} />
        ) : (
          <p>Please login to use WebView login</p>
        )}
      </section>

      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Create Universe</h2>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Universe Name"
            className="border p-2 rounded flex-1"
            value={universeName}
            onChange={(e) => setUniverseName(e.target.value)}
          />
          <button
            onClick={handleCreateUniverse}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Universe'}
          </button>
        </div>
      </section>

      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Batch Upload (.rbxl)</h2>
        <div className="space-y-4">
          <input
            type="file"
            multiple
            accept=".rbxl,.rbxlx"
            onChange={(e) => setFiles(Array.from(e.target.files))}
            className="border p-2 rounded w-full"
          />
          <div className="flex gap-4">
            <select
              className="border p-2 rounded flex-1"
              onChange={(e) => setSelectedUniverse(universes.find(u => u.id === parseInt(e.target.value)))}
              value={selectedUniverse?.id || ''}
            >
              <option value="">Select Universe</option>
              {universes.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.id})</option>
              ))}
            </select>
          </div>
          <button
            onClick={async () => {
              if (files.length === 0) return alert('Select files');
              if (!selectedUniverse) return alert('Select a universe');
              setLoading(true);
              try {
                const uploadedKeys = [];
                for (const file of files) {
                  const { data } = await api.post('/api/r2/presigned-url', {
                    fileName: file.name,
                    contentType: 'application/octet-stream'
                  });
                  await axios.put(data.url, file, { headers: { 'Content-Type': 'application/octet-stream' } });
                  uploadedKeys.push(data.key);
                }

                await api.post('/api/roblox/batch-upload', {
                  universeId: selectedUniverse.id,
                  placeId: selectedUniverse.rootPlaceId,
                  files: uploadedKeys,
                  concurrency: 3
                });
                alert('Batch upload job started!');
                fetchJobs();
              } catch (err) {
                alert('Batch upload failed to start');
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="bg-purple-600 text-white px-4 py-2 rounded disabled:opacity-50 w-full"
          >
            {loading ? 'Starting Batch...' : `Upload ${files.length} Files to ${selectedUniverse?.name || '...'}`}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-white p-6 rounded-lg shadow h-[400px] flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Job History</h2>
          <div className="overflow-y-auto flex-1">
            {jobs.map(job => (
              <div key={job.id} className="border-b py-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-mono">{job.id.substring(0, 8)}</span>
                  <span className={`font-bold ${job.status === 'COMPLETED' ? 'text-green-600' : 'text-orange-600'}`}>
                    {job.status}
                  </span>
                </div>
                <div>{job.type} - {job.details?.completed}/{job.details?.total}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white p-6 rounded-lg shadow h-[400px] flex flex-col">
          <h2 className="text-xl font-semibold mb-4">System Logs</h2>
          <div className="overflow-y-auto flex-1 font-mono text-xs">
            {logs.map(log => (
              <div key={log.id} className="mb-1">
                <span className="text-gray-400">[{new Date(log.createdAt).toLocaleTimeString()}]</span>{' '}
                <span className={log.level === 'ERROR' ? 'text-red-600' : 'text-blue-600'}>{log.level}</span>: {log.message}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
