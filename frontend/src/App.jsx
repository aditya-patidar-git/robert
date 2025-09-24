// App.js
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Mvp from "./pages/Mvp";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <Routes>
      {/* Default route */}
      <Route path="/" element={<Home />} />
      <Route path="/mvp" element={<Mvp />} />
      
      {/* Placeholder routes for testing */}
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}

export default App;
