'use client';

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export default function WebViewLogin({ userId }) {
  const [frame, setFrame] = useState(null);
  const [socket, setSocket] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001');
    setSocket(s);

    s.on('browser-frame', (data) => {
      setFrame(`data:image/jpeg;base64,${data}`);
    });

    s.on('login-success', () => {
      alert('Login successful! Cookie captured by backend.');
    });

    return () => s.disconnect();
  }, []);

  const handleStart = () => {
    socket.emit('start-login', { userId });
  };

  const handleInteraction = (type, data) => {
    socket.emit('browser-input', { userId, type, data });
  };

  const onCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    handleInteraction('mouse-click', { x, y });
  };

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleStart}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
      >
        Start WebView Login
      </button>
      <div className="relative border-2 border-gray-300">
        {frame ? (
          <img
            src={frame}
            alt="Browser Frame"
            className="cursor-crosshair"
            onClick={onCanvasClick}
            ref={canvasRef}
          />
        ) : (
          <div className="w-[1280px] h-[720px] bg-gray-100 flex items-center justify-center">
            Browser stream will appear here
          </div>
        )}
      </div>
    </div>
  );
}
