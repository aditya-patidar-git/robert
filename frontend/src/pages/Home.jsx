import { useState, useEffect } from "react";
import { makeCall, getAllCalls } from "../api/api";
import socket from "../socket";
import NumberInputList from "../components/NumberInputList";
import MessageBar from "../components/MessageBar";
import CallStatusList from "../components/CallStatusList";
import CallCard from "../components/CallCard";

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
                <NumberInputList numbers={numbers} onChange={handleNumberChange} />
                <button
                    onClick={makeCalls}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 cursor-pointer"
                >
                    Start Calls
                </button>
            </div>

            <div className="mt-2 mb-2">
                <MessageBar message={message} />
            </div>

            <CallStatusList statuses={statuses} />

            <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">📋 Recent Calls</h3>
                {calls.length === 0 ? (
                    <div className="text-gray-600">No calls yet</div>
                ) : (
                    calls.map((c) => <CallCard key={c.callSid} call={c} />)
                )}
            </div>
        </div>
    );
}

export default Home;
