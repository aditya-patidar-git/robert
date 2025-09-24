import React, { useState, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';

/**
 * Example component demonstrating socket.io usage with the new service
 */
const SocketExample = () => {
  const { isConnected, connectionStatus, emit, on, off } = useSocket();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');

  useEffect(() => {
    // Listen for incoming messages
    const handleMessage = (data) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: data.message,
        timestamp: new Date().toLocaleTimeString(),
        type: 'received'
      }]);
    };

    // Listen for connection status updates
    const handleStatusUpdate = (status) => {
      console.log('Connection status updated:', status);
    };

    // Register event listeners
    on('message', handleMessage);
    on('status_update', handleStatusUpdate);

    // Cleanup on unmount
    return () => {
      off('message', handleMessage);
      off('status_update', handleStatusUpdate);
    };
  }, [on, off]);

  const sendMessage = () => {
    if (!inputMessage.trim()) return;

    const messageData = {
      message: inputMessage,
      timestamp: new Date().toISOString()
    };

    // Emit message to server
    const success = emit('message', messageData, (error) => {
      if (error) {
        console.error('Error sending message:', error);
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: `Error: ${error.message}`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'error'
        }]);
      } else {
        console.log('Message sent successfully');
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: inputMessage,
          timestamp: new Date().toLocaleTimeString(),
          type: 'sent'
        }]);
      }
    });

    if (success) {
      setInputMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Socket.io Example</h2>
        
        {/* Connection Status */}
        <div className="mb-4">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          
          {connectionStatus && (
            <div className="mt-2 text-sm text-gray-600">
              <p>Socket ID: {connectionStatus.socketId || 'N/A'}</p>
              <p>Transport: {connectionStatus.transport || 'N/A'}</p>
              <p>Reconnect Attempts: {connectionStatus.reconnectAttempts}</p>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Messages</h3>
          <div className="h-64 overflow-y-auto border rounded-lg p-4 bg-gray-50">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-center">No messages yet</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`mb-2 p-2 rounded-lg ${
                    msg.type === 'sent'
                      ? 'bg-blue-100 ml-8'
                      : msg.type === 'received'
                      ? 'bg-green-100 mr-8'
                      : 'bg-red-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <p className="text-sm">{msg.text}</p>
                    <span className="text-xs text-gray-500 ml-2">
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!isConnected}
          />
          <button
            onClick={sendMessage}
            disabled={!isConnected || !inputMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>

        {/* Connection Controls */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => emit('ping', {}, (response) => {
              console.log('Pong received:', response);
            })}
            disabled={!isConnected}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:bg-gray-300"
          >
            Ping Server
          </button>
          
          <button
            onClick={() => emit('get_status', {}, (status) => {
              console.log('Server status:', status);
            })}
            disabled={!isConnected}
            className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 disabled:bg-gray-300"
          >
            Get Status
          </button>
        </div>
      </div>
    </div>
  );
};

export default SocketExample;
