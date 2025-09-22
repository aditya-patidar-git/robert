function NumberInputList({ numbers, onChange }) {
    return (
        <div className="flex flex-wrap gap-2">
            {numbers.map((n, i) => (
                <input
                    key={i}
                    value={n}
                    onChange={(e) => onChange(i, e.target.value)}
                    placeholder={`Number ${i + 1} (e.g. +91...)`}
                    className="w-56 p-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            ))}
        </div>
    );
}

export default NumberInputList;
