import { useState, useEffect } from "react";
import authenticatedApiClient from "../api/authenticatedApi.js";
import { useSocket } from "../hooks/useSocket";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3002";

// API functions using unified client
const getAllCalls = () =>
  authenticatedApiClient.get("/api/outbound/get-all-calls");

const getRecordingUrl = (callSid) => `${API_BASE}/api/outbound/recording/${callSid}`;

function Home() {
    const { on, off, isConnected } = useSocket();
    const [phoneNumber, setPhoneNumber] = useState("+918717914659");
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState(""); // 'success', 'error', 'info'
    const [isCalling, setIsCalling] = useState(false);
    const [statuses, setStatuses] = useState({});
    const [calls, setCalls] = useState([]);
    const [bookingTest, setBookingTest] = useState({
        loading: false,
        result: null,
        error: null
    });

    const handleNumberChange = (value) => {
        setPhoneNumber(value);
    };

    const makeCalls = async () => {
        const trimmedNumber = phoneNumber.trim();
        if (!trimmedNumber) {
            setMessage("Please enter a phone number.");
            setMessageType("error");
            return;
        }
        try {
            setIsCalling(true);
            setMessage("Initiating call...");
            setMessageType("info");
            
            // Route to agent service call endpoint
            const agentServiceUrl = `http://localhost:3002/call?to=${encodeURIComponent(trimmedNumber)}`;
            const res = await fetch(agentServiceUrl);
            
            if (!res.ok) {
                throw new Error(`Failed to initiate call: ${res.statusText}`);
            }
            
            const data = await res.json();
            const init = {};
            if (data.callSid) {
                init[data.callSid] = "initiated";
            }
            setStatuses((prev) => ({ ...init, ...prev }));
            setMessage(`Call initiated successfully`);
            setMessageType("success");
        } catch (err) {
            setMessage(err.message || "Failed to initiate call");
            setMessageType("error");
        } finally {
            setIsCalling(false);
        }
    };

    const testITMBooking = async () => {
        setBookingTest({ loading: true, result: null, error: null });
        
        try {
            // Disable retries for this long-running operation
            const res = await authenticatedApiClient.post('/api/itm-booking/test-booking', {}, {
                timeout: 360000, // 6 minutes timeout (matches backend timeout)
                metadata: {
                    disableRetries: true // Custom flag to disable retries
                }
            });
            setBookingTest({ 
                loading: false, 
                result: res.data, 
                error: null 
            });
        } catch (err) {
            setBookingTest({ 
                loading: false, 
                result: null, 
                error: err.response?.data?.error || err.message 
            });
        }
    };

    // Load past calls on page load
    useEffect(() => {
        (async () => {
            try {
                const res = await getAllCalls();
                setCalls(res.data);
            } catch (err) {
                console.error("fetch calls error", err);
            }
        })();
    }, []);

    // Realtime updates via socket
    useEffect(() => {
        const handleCallStatus = (data) => {
            setStatuses((prev) => ({ ...prev, [data.callSid]: data.status }));
        };

        const handleAllCalls = (records) => {
            setCalls(records);
        };

        on("call-status", handleCallStatus);
        on("all-calls", handleAllCalls);

        return () => {
            off("call-status", handleCallStatus);
            off("all-calls", handleAllCalls);
        };
    }, [on, off]);

    const getStatusBadgeColor = (status) => {
        const statusLower = status?.toLowerCase() || '';
        if (statusLower.includes('initiated') || statusLower.includes('ringing')) {
            return 'bg-blue-100 text-blue-800 border-blue-200';
        } else if (statusLower.includes('answered') || statusLower.includes('in-progress')) {
            return 'bg-green-100 text-green-800 border-green-200';
        } else if (statusLower.includes('completed') || statusLower.includes('finished')) {
            return 'bg-gray-100 text-gray-800 border-gray-200';
        } else if (statusLower.includes('failed') || statusLower.includes('busy') || statusLower.includes('no-answer')) {
            return 'bg-red-100 text-red-800 border-red-200';
        }
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    };

    const formatCallSid = (sid) => {
        if (!sid) return 'N/A';
        return sid.length > 20 ? `${sid.substring(0, 20)}...` : sid;
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                Robert Voice Agent
                            </h1>
                            <p className="text-gray-600 text-sm">
                                AI-powered voice agent for intelligent customer interactions
                            </p>
                        </div>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border ${
                            isConnected 
                                ? 'bg-green-50 text-green-700 border-green-200' 
                                : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${
                                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                            }`}></div>
                            <span>{isConnected ? 'Service Connected' : 'Service Disconnected'}</span>
                        </div>
                    </div>
                </div>

                {/* Call Initiation Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Initiate Call</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => handleNumberChange(e.target.value)}
                                placeholder="+1234567890"
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Include country code (e.g., +1, +44, +91)
                            </p>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2">
                            <button
                                onClick={makeCalls}
                                disabled={isCalling}
                                className={`px-6 py-3 rounded-lg font-medium text-white transition-all ${
                                    isCalling
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md active:scale-95'
                                }`}
                            >
                                {isCalling ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Initiating...
                                    </span>
                                ) : (
                                    'Start Calls'
                                )}
                            </button>
                        </div>

                        {message && (
                            <div className={`mt-4 p-4 rounded-lg border ${
                                messageType === 'success' 
                                    ? 'bg-green-50 border-green-200 text-green-800'
                                    : messageType === 'error'
                                    ? 'bg-red-50 border-red-200 text-red-800'
                                    : 'bg-blue-50 border-blue-200 text-blue-800'
                            }`}>
                                <div className="flex items-center gap-2">
                                    {messageType === 'success' && (
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                    {messageType === 'error' && (
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                    {messageType === 'info' && (
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                    <span className="text-sm font-medium">{message}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            <div className="mt-6 mb-6 p-4 border-2 border-blue-300 rounded-lg bg-blue-50">
                <h3 className="text-lg font-medium mb-3">🧪 CRM Booking Test</h3>
                <p className="text-sm text-gray-600 mb-3">
                    Test the ITM booking workflow with existing client (email from env)
                </p>
                
                <button
                    onClick={testITMBooking}
                    disabled={bookingTest.loading}
                    className={`px-4 py-2 rounded-md text-white ${
                        bookingTest.loading 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-blue-500 hover:bg-blue-600 cursor-pointer'
                    }`}
                >
                    {bookingTest.loading ? '⏳ Running Booking Test...' : '🚀 Test ITM Booking'}
                </button>
                
                {bookingTest.result && (
                    <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded">
                        <p className="font-medium text-green-800">✅ {bookingTest.result.message}</p>
                        <p className="text-sm text-gray-700 mt-2">
                            <strong>Client Email:</strong> {bookingTest.result.clientEmail}
                        </p>
                        <p className="text-sm text-gray-700">
                            <strong>Session:</strong> {bookingTest.result.sessionDetails?.date} at {bookingTest.result.sessionDetails?.time} ({bookingTest.result.sessionDetails?.location})
                        </p>
                        <p className="text-sm text-gray-700">
                            <strong>Screenshots:</strong> {bookingTest.result.screenshots?.length || 0} captured
                        </p>
                    </div>
                )}
                
                {bookingTest.error && (
                    <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded">
                        <p className="font-medium text-red-800">❌ Error: {bookingTest.error}</p>
                    </div>
                )}
            </div>

                {/* Live Call Status Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">Live Call Status</h2>
                        <span className="text-sm text-gray-500">
                            {Object.keys(statuses).length} active call{Object.keys(statuses).length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    {Object.keys(statuses).length === 0 ? (
                        <div className="text-center py-8">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <p className="mt-2 text-sm text-gray-500">No active calls</p>
                            <p className="text-xs text-gray-400 mt-1">Initiate a call to see real-time status updates</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(statuses).map(([sid, st]) => (
                                <div key={sid} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="flex-shrink-0">
                                            <div className={`w-3 h-3 rounded-full ${
                                                st?.toLowerCase().includes('answered') || st?.toLowerCase().includes('in-progress')
                                                    ? 'bg-green-500 animate-pulse'
                                                    : st?.toLowerCase().includes('completed')
                                                    ? 'bg-gray-400'
                                                    : 'bg-blue-500 animate-pulse'
                                            }`}></div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-mono text-gray-900 truncate" title={sid}>
                                                {formatCallSid(sid)}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">{st}</p>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(st)}`}>
                                        {st}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Calls Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">Recent Calls</h2>
                        <span className="text-sm text-gray-500">
                            {calls.length} total call{calls.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    {calls.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="mt-2 text-sm text-gray-500">No calls yet</p>
                            <p className="text-xs text-gray-400 mt-1">Call history will appear here after you make calls</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {calls.map((call) => (
                                <div key={call.callSid || call._id || Math.random()} className="border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors overflow-hidden">
                                    {/* Call Header */}
                                    <div className="bg-white border-b border-gray-200 px-6 py-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-4 flex-wrap">
                                                    <div>
                                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">From</span>
                                                        <p className="text-sm font-semibold text-gray-900 mt-0.5">{call.from || "Unknown"}</p>
                                                    </div>
                                                    <div className="text-gray-300">|</div>
                                                    <div>
                                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">To</span>
                                                        <p className="text-sm font-semibold text-gray-900 mt-0.5">{call.to || "Unknown"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-500 mb-1">
                                                    {new Date(call.createdAt).toLocaleDateString('en-US', { 
                                                        month: 'short', 
                                                        day: 'numeric', 
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                                <p className="text-xs font-mono text-gray-400" title={call.callSid}>
                                                    {formatCallSid(call.callSid)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="px-6 py-4 space-y-4">
                                        {/* Transcript */}
                                        {call?.transcript?.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                    </svg>
                                                    Transcript
                                                </h4>
                                                <div className="bg-white rounded-lg p-4 border border-gray-200 max-h-96 overflow-y-auto">
                                                    <div className="space-y-3">
                                                        {call.transcript.map((t, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={`flex ${t.role === "agent" ? "justify-start" : "justify-end"}`}
                                                            >
                                                                <div className={`max-w-[75%] rounded-lg px-4 py-2.5 ${
                                                                    t.role === "agent"
                                                                        ? "bg-blue-50 border border-blue-200"
                                                                        : "bg-green-50 border border-green-200"
                                                                }`}>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className={`text-xs font-semibold ${
                                                                            t.role === "agent" ? "text-blue-700" : "text-green-700"
                                                                        }`}>
                                                                            {t.role === "agent" ? "Agent" : "User"}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-sm text-gray-800 leading-relaxed">{t.text}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Summary */}
                                        {call.summary && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    Summary
                                                </h4>
                                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                    <p className="text-sm text-gray-700 leading-relaxed">{call.summary}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Recording */}
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                </svg>
                                                Recording
                                            </h4>
                                            {call.recordingUrl ? (
                                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                    <audio controls className="w-full">
                                                        <source
                                                            src={getRecordingUrl(call.callSid)}
                                                            type="audio/mpeg"
                                                        />
                                                        Your browser does not support audio playback.
                                                    </audio>
                                                </div>
                                            ) : (
                                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                                                    <p className="text-sm text-gray-500">Recording not available</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Home;
