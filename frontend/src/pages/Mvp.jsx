import { useState, useEffect } from "react";
import { makeCall, getAllCalls, getRecordingUrl } from "../api/api";
import socket from "../socket";

function Home() {
    const [numbers, setNumbers] = useState(["+918717914659", "", ""]);
    const [message, setMessage] = useState("");
    const [statuses, setStatuses] = useState({});
    const [calls, setCalls] = useState([]);

    const handleNumberChange = (index, value) => {
        const copy = [...numbers];
        copy[index] = value;
        setNumbers(copy);
    };

    const makeCalls = async () => {
        const toNumbers = numbers.map((n) => n.trim()).filter((n) => n !== "");
        if (toNumbers.length === 0) {
            setMessage("❌ Please enter at least one number.");
            return;
        }
        try {
            setMessage("⏳ Initiating calls...");
            const res = await makeCall(toNumbers);
            const init = {};
            (res.data.calls || []).forEach((c) => {
                init[c.callSid] = "initiated";
            });
            setStatuses((prev) => ({ ...init, ...prev }));
            setMessage(`✅ ${res.data.calls.length} call(s) initiated`);
        } catch (err) {
            setMessage(`❌ ${err.response?.data?.error || err.message}`);
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
        socket.on("call-status", (data) => {
            setStatuses((prev) => ({ ...prev, [data.callSid]: data.status }));
        });

        socket.on("all-calls", (records) => {
            setCalls(records);
        });

        return () => {
            socket.off("call-status");
            socket.off("all-calls");
        };
    }, []);

    return (
        <div className="p-5 font-sans max-w-[1000px] mx-auto">
            <h2 className="text-xl font-semibold mb-4">📞 Robert Voice Agent — MVP</h2>

            <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                    {numbers.map((n, i) => (
                        <input
                            key={i}
                            value={n}
                            onChange={(e) => handleNumberChange(i, e.target.value)}
                            placeholder={`Number ${i + 1} (e.g. +91...)`}
                            className="w-56 p-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    ))}
                </div>
                <button
                    onClick={makeCalls}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 cursor-pointer"
                >
                    Start Calls
                </button>
            </div>

            <div className="mt-2 mb-2">
                <div className="mt-2">
                    <span>{message}</span>
                </div>
            </div>

            <div className="mb-5">
                <h3 className="text-lg font-medium mb-2">📡 Live Call Status</h3>
                {Object.keys(statuses).length === 0 ? (
                    <div className="text-gray-600">No active calls</div>
                ) : (
                    <ul className="space-y-1">
                        {Object.entries(statuses).map(([sid, st]) => (
                            <li key={sid} className="text-sm">
                                <b className="font-mono">{sid}</b> — {st}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">📋 Recent Calls</h3>
                {calls.length === 0 ? (
                    <div className="text-gray-600">No calls yet</div>
                ) : (
                    calls.map((call) =>
                        <div className="p-4 border border-gray-200 rounded-lg mb-5 bg-gray-50">
                            {/* Header */}
                            <div className="flex justify-between">
                                <div>
                                    <div>
                                        <b>From:</b> {call.from || "Unknown"} &nbsp; | &nbsp;
                                        <b>To:</b> {call.to || "Unknown"}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-gray-600 text-xs">
                                        {new Date(call.createdAt).toLocaleString()}
                                    </div>
                                    <div className="mt-1 text-xs">{call.callSid}</div>
                                </div>
                            </div>

                            {/* Transcript */}
                            <div className="mt-4">
                                <b>Transcript:</b>
                                <div className="mt-3">
                                    {call?.transcript?.length > 0 ? (
                                        call.transcript.map((t, idx) => (
                                            <div
                                                key={idx}
                                                className={`flex mb-2 ${t.role === "agent" ? "justify-start" : "justify-end"
                                                    }`}
                                            >
                                                <div
                                                    className={`max-w-[70%] px-3 py-2 rounded-xl text-sm text-gray-800 ${t.role === "agent"
                                                        ? "bg-blue-100"
                                                        : "bg-green-100"
                                                        }`}
                                                >
                                                    <b>
                                                        {t.role === "agent" ? "🤖 Agent" : "👤 User"}:
                                                    </b>{" "}
                                                    {t.text}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-gray-600">No transcript available</div>
                                    )}
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="mt-4">
                                <b>Summary:</b>
                                <div className="mt-2 text-gray-800">
                                    {call.summary || "No summary available"}
                                </div>
                            </div>

                            {/* Recording */}
                            <div className="mt-4">
                                <div className="mb-4"><b>Recording:</b></div>
                                {call.recordingUrl ? (
                                    <audio controls className="w-full">
                                        <source
                                            src={getRecordingUrl(call.callSid)}
                                            type="audio/mpeg"
                                        />
                                        Your browser does not support audio playback.
                                    </audio>
                                ) : (
                                    <div className="text-gray-600">Recording not available</div>
                                )}
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

export default Home;
