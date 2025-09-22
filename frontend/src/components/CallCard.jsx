import { getRecordingUrl } from "../api/api";

function CallCard({ call }) {
    return (
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
    );
}

export default CallCard;
