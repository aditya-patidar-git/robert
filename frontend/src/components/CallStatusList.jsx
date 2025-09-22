function CallStatusList({ statuses }) {
    return (
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
    );
}

export default CallStatusList;
